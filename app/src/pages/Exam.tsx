import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowLeft, ArrowRight, LayoutGrid, Clock, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import { useQuizData } from '@/hooks/useQuizData';
import { useSpeech } from '@/hooks/useSpeech';
import type { VoiceType } from '@/hooks/useSpeech';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import Layout from '@/components/Layout';
import OptionCard from '@/components/OptionCard';
import QuestionHeader from '@/components/QuestionHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import QuestionAnalysis from '@/components/QuestionAnalysis';
import SpeakButton from '@/components/SpeakButton';
import type { Question } from '@/types/quiz';

gsap.registerPlugin();

const EXAM_DURATION = 90 * 60; // 90 minutes in seconds
const EXAM_STATE_KEY = 'hzp_exam_state';
const EXAM_QUESTIONS_COUNT = 100;
const SINGLE_CHOICE_COUNT = 30;  // 30% 选择题
const TRUE_FALSE_COUNT = 70;     // 70% 判断题

interface ExamState {
  isActive: boolean;
  questions: number[];
  answers: Record<number, string>;
  startTime: number;
  timeRemaining: number;
  currentIndex: number;
}

interface ExamResultData {
  examQuestions: Question[];
  userAnswers: Record<number, string>;
  timeUsed: number;
  score: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  singleChoiceCorrect: number;
  trueFalseCorrect: number;
}

function formatTimeLong(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Exam() {
  const navigate = useNavigate();
  const { questions: allQuestions, loading } = useQuizData();
  const [examState, setExamState] = useLocalStorage<ExamState | null>(EXAM_STATE_KEY, null);

  // Core exam state
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(EXAM_DURATION);
  const [examStarted, setExamStarted] = useState(false);
  const [examFinished, setExamFinished] = useState(false);

  // UI state
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showRules, setShowRules] = useState(true);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const answerSheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasInitRef = useRef(false);

  // Speech synthesis
  const { speak, speakQueue, stop, autoPlay, toggleAutoPlay } = useSpeech();
  const isFirstMount = useRef(true);
  const prevIndexRef = useRef(-1);

  // Generate exam questions — 70% true/false + 30% single choice, keep original order
  const generateQuestions = useCallback(() => {
    if (allQuestions.length === 0) return;

    const singleChoice = allQuestions.filter(q => q.type === 'single');
    const trueFalse = allQuestions.filter(q => q.type === 'truefalse');

    // Take first N questions in original order (no shuffle)
    const selectedSingle = singleChoice.slice(0, SINGLE_CHOICE_COUNT);
    const selectedTrueFalse = trueFalse.slice(0, TRUE_FALSE_COUNT);

    // Combine: true/false first, then single choice, maintaining original order within each group
    const combined = [...selectedTrueFalse, ...selectedSingle];

    setExamQuestions(combined);
  }, [allQuestions]);

  // Restore or generate exam — runs ONCE when questions load
  useEffect(() => {
    if (loading || allQuestions.length === 0 || hasInitRef.current) return;
    hasInitRef.current = true;

    // Check for existing active exam state
    if (examState?.isActive && examState.questions.length === EXAM_QUESTIONS_COUNT) {
      const restoredQuestions = examState.questions
        .map(id => allQuestions.find(q => q.id === id))
        .filter((q): q is Question => q !== undefined);

      if (restoredQuestions.length === EXAM_QUESTIONS_COUNT) {
        setExamQuestions(restoredQuestions);
        setUserAnswers(examState.answers || {});
        setTimeRemaining(examState.timeRemaining);
        setCurrentIndex(examState.currentIndex);
        setExamStarted(true);
        setShowRules(false);
        startTimeRef.current = examState.startTime;
        return;
      }
    }

    // Generate new questions
    generateQuestions();
  }, [loading, allQuestions, examState, generateQuestions]);

  // Timer logic
  useEffect(() => {
    if (!examStarted || examFinished) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Auto-submit
          setExamFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examStarted, examFinished]);

  // Persist exam state
  useEffect(() => {
    if (!examStarted || examFinished || examQuestions.length === 0) return;

    const state: ExamState = {
      isActive: true,
      questions: examQuestions.map(q => q.id),
      answers: userAnswers,
      startTime: startTimeRef.current,
      timeRemaining,
      currentIndex,
    };
    setExamState(state);
  }, [userAnswers, timeRemaining, currentIndex, examStarted, examFinished, examQuestions, setExamState]);

  // Auto-submit on time expiry
  useEffect(() => {
    if (timeRemaining === 0 && examStarted && !examFinished) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, examStarted, examFinished]);

  // Auto-read question when it changes (female voice)
  useEffect(() => {
    if (!examStarted || examFinished || !autoPlay) return;
    const q = examQuestions[currentIndex];
    if (!q) return;

    // Skip on first mount
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    // Only read when index actually changes
    if (prevIndexRef.current === currentIndex) return;
    prevIndexRef.current = currentIndex;

    let text = q.question;
    if (q.type === 'truefalse') {
      text += '，选项：A 正确，B 错误';
    } else if (q.options) {
      const opts = Object.entries(q.options).map(([k, v]) => `${k} ${v}`).join('，');
      text += '，选项：' + opts;
    }

    stop();
    setTimeout(() => speak(text, 'female'), 400);
  }, [currentIndex, examQuestions, examStarted, examFinished, autoPlay, speak, stop]);

  // GSAP animations
  useGSAP(() => {
    if (contentRef.current && examStarted) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, { dependencies: [currentIndex, examStarted] });

  // Start exam
  const handleStartExam = () => {
    setShowRules(false);
    setExamStarted(true);
    startTimeRef.current = Date.now();
    setTimeRemaining(EXAM_DURATION);
    setCurrentIndex(0);
    setUserAnswers({});
  };

  // Cancel and go back
  const handleCancelExam = () => {
    setExamState(null);
    navigate('/');
  };

  // Select answer + speak feedback
  const handleSelectAnswer = (answer: string) => {
    const q = examQuestions[currentIndex];
    if (!q) return;
    setUserAnswers(prev => ({ ...prev, [q.id]: answer }));

    // Auto-play feedback
    if (autoPlay) {
      let correct = false;
      if (q.type === 'truefalse') {
        correct = (answer === 'A') === (q.answer === true);
      } else {
        correct = answer === String(q.answer);
      }

      const queue: { text: string; voiceType: VoiceType }[] = [];
      if (correct) {
        queue.push({ text: '回答正确！', voiceType: 'male' });
      } else {
        queue.push({ text: '回答错误。', voiceType: 'male' });
        if (q.type === 'truefalse') {
          queue.push({ text: `正确答案是：${q.answer === true ? '正确' : '错误'}`, voiceType: 'female' });
        } else {
          queue.push({ text: `正确答案是：${q.answer}`, voiceType: 'female' });
        }
      }

      setTimeout(() => {
        speakQueue(queue.map(item => ({ ...item, rate: 1.1 })));
      }, 300);
    }
  };

  // Navigate
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const handleNext = () => {
    if (currentIndex < EXAM_QUESTIONS_COUNT - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Jump to question from answer sheet
  const handleJumpToQuestion = (index: number) => {
    setCurrentIndex(index);
    setShowAnswerSheet(false);
  };

  // Submit exam
  const handleSubmit = useCallback(() => {
    if (examFinished) return;
    setExamFinished(true);

    if (timerRef.current) clearInterval(timerRef.current);

    const timeUsed = EXAM_DURATION - timeRemaining;

    // Calculate score
    let correctCount = 0;
    let singleChoiceCorrect = 0;
    let trueFalseCorrect = 0;
    const wrongQuestions: Question[] = [];

    examQuestions.forEach(q => {
      const userAnswer = userAnswers[q.id];
      if (userAnswer === undefined) return; // unanswered

      // Check answer based on question type
      let isCorrect = false;
      if (q.type === 'truefalse') {
        // A = true, B = false
        const userBool = userAnswer === 'A';
        isCorrect = userBool === q.answer;
      } else {
        // Single choice: compare letter
        isCorrect = userAnswer === String(q.answer);
      }

      if (isCorrect) {
        correctCount++;
        if (q.type === 'single') singleChoiceCorrect++;
        else trueFalseCorrect++;
      } else {
        wrongQuestions.push(q);
      }
    });

    const score = correctCount;
    const wrongCount = EXAM_QUESTIONS_COUNT - correctCount - (EXAM_QUESTIONS_COUNT - Object.keys(userAnswers).length);
    const unansweredCount = EXAM_QUESTIONS_COUNT - Object.keys(userAnswers).length;

    const resultData: ExamResultData = {
      examQuestions,
      userAnswers,
      timeUsed,
      score,
      correctCount,
      wrongCount,
      unansweredCount,
      singleChoiceCorrect,
      trueFalseCorrect,
    };

    // Clear exam state
    setExamState(null);

    // Navigate to result
    navigate('/exam-result', { state: resultData });
  }, [examFinished, timeRemaining, examQuestions, userAnswers, navigate, setExamState]);

  // Exit exam

  const handleConfirmExit = () => {
    // Save current state
    if (examQuestions.length > 0) {
      const state: ExamState = {
        isActive: true,
        questions: examQuestions.map(q => q.id),
        answers: userAnswers,
        startTime: startTimeRef.current,
        timeRemaining,
        currentIndex,
      };
      setExamState(state);
    }
    setShowExitConfirm(false);
    navigate('/');
  };

  // Timer display color and animation
  const getTimerStyles = (): React.CSSProperties => {
    if (timeRemaining < 5 * 60) {
      return { color: '#F87171' };
    }
    if (timeRemaining < 15 * 60) {
      return { color: '#FB923C' };
    }
    return { color: '#D4F935' };
  };

  const isTimerWarning = timeRemaining < 15 * 60;
  const isTimerDanger = timeRemaining < 5 * 60;

  const currentQuestion = examQuestions[currentIndex];
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === EXAM_QUESTIONS_COUNT - 1;
  const answeredCount = Object.keys(userAnswers).length;

  if (loading) {
    return (
      <Layout title="模拟考试">
        <div className="flex items-center justify-center px-6" style={{ minHeight: '60vh' }}>
          <p className="text-body-lg text-text-secondary">加载题库中...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="模拟考试" showFooter={false}>
      {/* Timer Bar - Fixed below navbar */}
      {examStarted && !examFinished && (
        <div
          className="fixed left-0 right-0 z-40 flex items-center justify-center gap-2 px-4"
          style={{
            top: 64,
            height: 40,
            backgroundColor: 'rgba(3, 6, 21, 0.9)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid #1E2A3E',
          }}
        >
          <Clock size={16} style={getTimerStyles()} />
          <span
            className={`text-body font-bold font-mono ${isTimerDanger ? 'animate-pulse' : isTimerWarning ? 'animate-pulse' : ''}`}
            style={getTimerStyles()}
          >
            剩余 {formatTimeLong(timeRemaining)}
          </span>
          {isTimerDanger && (
            <AlertTriangle size={16} className="text-error-400 animate-pulse" />
          )}
        </div>
      )}

      {/* Exam Rules Dialog */}
      {showRules && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(3, 6, 21, 0.8)' }}
        >
          <div
            className="w-full max-w-md rounded-radius-lg bg-space-900 p-6"
            style={{ border: '1px solid #1E2A3E' }}
          >
            <h2 className="text-title text-text-primary mb-4 text-center">模拟考试</h2>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3 rounded-radius-md bg-space-800 p-4">
                <span className="text-lime-400 font-bold">1</span>
                <p className="text-body text-text-secondary">抽取 100 道题目（{SINGLE_CHOICE_COUNT} 道单选题 + {TRUE_FALSE_COUNT} 道判断题），按题库顺序</p>
              </div>
              <div className="flex items-start gap-3 rounded-radius-md bg-space-800 p-4">
                <span className="text-lime-400 font-bold">2</span>
                <p className="text-body text-text-secondary">考试限时 90 分钟，倒计时结束后自动交卷</p>
              </div>
              <div className="flex items-start gap-3 rounded-radius-md bg-space-800 p-4">
                <span className="text-lime-400 font-bold">3</span>
                <p className="text-body text-text-secondary">每题 1 分，满分 100 分，60 分及格</p>
              </div>
              <div className="flex items-start gap-3 rounded-radius-md bg-space-800 p-4">
                <span className="text-lime-400 font-bold">4</span>
                <p className="text-body text-text-secondary">交卷前可随时修改答案，交卷后无法修改</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelExam}
                className="flex-1 rounded-radius-md border-2 border-space-600 py-3 text-body text-text-secondary transition-all duration-200 hover:border-accent-blue hover:text-accent-blue"
                style={{ minHeight: 48 }}
              >
                取消
              </button>
              <button
                onClick={handleStartExam}
                className="flex-1 rounded-radius-md py-3 text-body font-bold text-text-inverse transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                style={{ minHeight: 48, backgroundColor: '#D4F935' }}
              >
                开始考试
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {examStarted && currentQuestion && (
        <div
          ref={contentRef}
          className="relative mx-auto w-full px-6 pb-32"
          style={{ maxWidth: 800, paddingTop: examStarted ? 40 : 24 }}
        >
          {/* Question Header */}
          <QuestionHeader
            question={currentQuestion}
            currentIndex={currentIndex}
            totalQuestions={EXAM_QUESTIONS_COUNT}
          />

          {/* Question Text */}
          <div
            className="mb-8 rounded-radius-lg bg-space-800 p-6"
            style={{ border: '1px solid #1E2A3E' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-text-muted">第 {currentIndex + 1} 题 · 模拟考试</span>
              <div className="flex items-center gap-2">
                {/* Auto-play toggle */}
                <button
                  onClick={toggleAutoPlay}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all"
                  style={{
                    backgroundColor: autoPlay ? 'rgba(212, 249, 53, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${autoPlay ? '#D4F935' : '#1E2A3E'}`,
                    color: autoPlay ? '#D4F935' : '#94A3B8',
                  }}
                  title={autoPlay ? '关闭自动朗读' : '开启自动朗读'}
                >
                  {autoPlay ? <Volume2 size={12} /> : <VolumeX size={12} />}
                  <span>{autoPlay ? '自动读题' : '朗读关'}</span>
                </button>
                <SpeakButton question={currentQuestion} />
              </div>
            </div>
            <p className="text-body-lg text-text-primary" style={{ lineHeight: 1.8 }}>
              {currentQuestion.question}
            </p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-4">
            {currentQuestion.type === 'single' && currentQuestion.options && (
              <>
                {Object.entries(currentQuestion.options).map(([key, value], idx) => (
                  <OptionCard
                    key={key}
                    label={key}
                    text={value}
                    state={userAnswers[currentQuestion.id] === key ? 'selected' : 'default'}
                    onClick={() => handleSelectAnswer(key)}
                    index={idx}
                  />
                ))}
              </>
            )}
            {currentQuestion.type === 'truefalse' && (
              <>
                <OptionCard
                  label="A"
                  text="正确"
                  state={userAnswers[currentQuestion.id] === 'A' ? 'selected' : 'default'}
                  onClick={() => handleSelectAnswer('A')}
                  index={0}
                />
                <OptionCard
                  label="B"
                  text="错误"
                  state={userAnswers[currentQuestion.id] === 'B' ? 'selected' : 'default'}
                  onClick={() => handleSelectAnswer('B')}
                  index={1}
                />
              </>
            )}
          </div>

          {/* AI Analysis - show when user has answered this question */}
          {userAnswers[currentQuestion.id] && (
            <div className="mt-6">
              <QuestionAnalysis
                question={currentQuestion}
                selectedLabel={userAnswers[currentQuestion.id]}
                isCorrect={
                  currentQuestion.type === 'truefalse'
                    ? (userAnswers[currentQuestion.id] === 'A') === (currentQuestion.answer === true)
                    : userAnswers[currentQuestion.id] === String(currentQuestion.answer)
                }
              />
            </div>
          )}

          {/* Spacer for fixed bottom bar */}
          <div style={{ height: 120 }} />
        </div>
      )}

      {/* Bottom Action Bar */}
      {examStarted && !examFinished && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 px-6 py-4"
          style={{
            backgroundColor: 'rgba(3, 6, 21, 0.95)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <button
            onClick={handlePrev}
            disabled={isFirstQuestion}
            className="flex items-center justify-center gap-2 rounded-radius-md border-2 border-space-600 px-4 py-3 text-body text-text-secondary transition-all duration-200 hover:border-accent-blue hover:text-accent-blue disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ minHeight: 48, flex: '0 0 auto' }}
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">上一题</span>
          </button>

          <button
            onClick={() => setShowAnswerSheet(true)}
            className="flex items-center justify-center gap-2 rounded-radius-md border-2 border-space-600 px-4 py-3 text-body text-text-secondary transition-all duration-200 hover:border-accent-blue hover:text-accent-blue"
            style={{ minHeight: 48, flex: '0 0 auto' }}
          >
            <LayoutGrid size={18} />
            <span>答题卡</span>
          </button>

          {isLastQuestion ? (
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-radius-md py-3 text-body font-bold text-text-inverse transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ minHeight: 48, backgroundColor: '#F97316' }}
            >
              交卷
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex flex-1 items-center justify-center gap-2 rounded-radius-md py-3 text-body font-bold text-text-inverse transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ minHeight: 48, backgroundColor: '#D4F935' }}
            >
              <span>下一题</span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      )}

      {/* Answer Sheet Dialog */}
      {showAnswerSheet && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          style={{ backgroundColor: 'rgba(3, 6, 21, 0.7)' }}
          onClick={() => setShowAnswerSheet(false)}
        >
          <div
            ref={answerSheetRef}
            className="w-full rounded-t-radius-lg bg-space-900 sm:rounded-radius-lg"
            style={{
              maxWidth: 480,
              maxHeight: '80vh',
              border: '1px solid #1E2A3E',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4">
              <h2 className="text-subtitle text-text-primary">答题卡</h2>
              <button
                onClick={() => setShowAnswerSheet(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-space-800 hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            {/* Stats */}
            <div className="px-6 pb-4">
              <p className="text-body text-text-secondary">
                已答 <span className="text-lime-400 font-bold">{answeredCount}</span> / {EXAM_QUESTIONS_COUNT} 题
              </p>
            </div>

            {/* Question Grid */}
            <div className="px-6 pb-4">
              <div className="grid grid-cols-10 gap-2">
                {examQuestions.map((q, idx) => {
                  const isAnswered = userAnswers[q.id] !== undefined;
                  const isCurrent = idx === currentIndex;

                  let btnStyle: React.CSSProperties = {
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  };

                  if (isCurrent) {
                    btnStyle = {
                      ...btnStyle,
                      backgroundColor: 'rgba(212, 249, 53, 0.1)',
                      border: '2px solid #D4F935',
                      color: '#D4F935',
                    };
                  } else if (isAnswered) {
                    btnStyle = {
                      ...btnStyle,
                      backgroundColor: 'rgba(96, 165, 250, 0.2)',
                      border: '1px solid #60A5FA',
                      color: '#60A5FA',
                    };
                  } else {
                    btnStyle = {
                      ...btnStyle,
                      backgroundColor: '#1E2A3E',
                      border: '1px solid #2E3F5C',
                      color: '#94A3B8',
                    };
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => handleJumpToQuestion(idx)}
                      className="flex items-center justify-center transition-all duration-150 hover:bg-space-600"
                      style={btnStyle}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <div className="p-6 pt-2">
              <button
                onClick={() => {
                  setShowAnswerSheet(false);
                  setShowSubmitConfirm(true);
                }}
                className="w-full rounded-radius-md py-4 text-body-lg font-bold text-text-inverse transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: '#D4F935', minHeight: 56 }}
              >
                交卷
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation */}
      <ConfirmDialog
        open={showSubmitConfirm}
        title="确定交卷？"
        message={`已作答 ${answeredCount} / ${EXAM_QUESTIONS_COUNT} 题，${EXAM_QUESTIONS_COUNT - answeredCount > 0 ? `还有 ${EXAM_QUESTIONS_COUNT - answeredCount} 题未作答，` : ''}交卷后将无法修改答案。`}
        confirmLabel="确认交卷"
        cancelLabel="继续作答"
        confirmVariant="primary"
        onConfirm={() => {
          setShowSubmitConfirm(false);
          handleSubmit();
        }}
        onCancel={() => setShowSubmitConfirm(false)}
      />

      {/* Exit Confirmation */}
      <ConfirmDialog
        open={showExitConfirm}
        title="退出考试"
        message="考试正在进行中，确定要退出吗？当前进度将保存，您可以稍后继续。"
        confirmLabel="保存并退出"
        cancelLabel="继续考试"
        confirmVariant="error"
        onConfirm={handleConfirmExit}
        onCancel={() => setShowExitConfirm(false)}
      />
    </Layout>
  );
}

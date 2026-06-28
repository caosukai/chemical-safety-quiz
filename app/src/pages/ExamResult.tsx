import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Home, RotateCcw, BookX, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import Layout from '@/components/Layout';
import OptionCard from '@/components/OptionCard';
import { useExamHistory } from '@/hooks/useLocalStorage';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Question } from '@/types/quiz';
import type { ExamRecord } from '@/types/quiz';

gsap.registerPlugin();

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

interface WrongQuestionItem {
  question: Question;
  userAnswer: string;
  correctAnswer: string;
}

function formatTimeUsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}分${String(s).padStart(2, '0')}秒`;
}

export default function ExamResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const resultData = location.state as ExamResultData | null;
  const [_examHistory, setExamHistory] = useExamHistory();
  const [, setWrongQuestions] = useLocalStorage<number[]>('hzp_wrong_questions', []);

  const [addedToWrongBook, setAddedToWrongBook] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [scoreDisplay, setScoreDisplay] = useState(0);

  const scoreRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const breakdownRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const hasSavedRef = useRef(false);

  // Redirect if no state
  useEffect(() => {
    if (!resultData) {
      navigate('/');
    }
  }, [resultData, navigate]);

  if (!resultData) return null;

  const {
    examQuestions,
    userAnswers,
    timeUsed,
    score,
    correctCount,
    wrongCount,
    unansweredCount,
    singleChoiceCorrect,
    trueFalseCorrect,
  } = resultData;

  const totalSingleChoice = examQuestions.filter(q => q.type === 'single').length;
  const totalTrueFalse = examQuestions.filter(q => q.type === 'truefalse').length;
  const accuracy = Math.round((correctCount / examQuestions.length) * 100);

  // Determine pass/fail and colors
  const isPassed = score >= 60;
  const scoreColor = score >= 90 ? '#4ADE80' : isPassed ? '#D4F935' : '#F87171';

  // Build wrong questions list with proper answer comparison
  const wrongQuestionItems: WrongQuestionItem[] = examQuestions
    .filter(q => {
      const userAnswer = userAnswers[q.id];
      if (userAnswer === undefined) return false;
      // Proper answer check
      if (q.type === 'truefalse') {
        const userBool = userAnswer === 'A'; // A=true, B=false
        return userBool !== q.answer;
      }
      return userAnswer !== String(q.answer);
    })
    .map(q => ({
      question: q,
      userAnswer: userAnswers[q.id],
      correctAnswer: q.type === 'truefalse'
        ? (q.answer === true ? 'A' : 'B')
        : String(q.answer),
    }));

  // Save to history (once)
  useEffect(() => {
    if (hasSavedRef.current) return;
    hasSavedRef.current = true;

    const record: ExamRecord = {
      id: Date.now().toString(),
      date: Date.now(),
      score,
      totalQuestions: examQuestions.length,
      correctCount,
      timeUsed,
      questions: examQuestions.map(q => q.id),
    };

    setExamHistory(prev => [record, ...prev].slice(0, 50));
  }, []);

  // GSAP Animations
  useGSAP(() => {
    // Score count-up animation
    const scoreObj = { value: 0 };
    gsap.to(scoreObj, {
      value: score,
      duration: 1,
      ease: 'power2.out',
      onUpdate: () => {
        setScoreDisplay(Math.round(scoreObj.value));
      },
    });

    // Conclusion text fade in
    gsap.fromTo(
      '.exam-conclusion',
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, delay: 1, duration: 0.3, ease: 'power2.out' }
    );

    // Stats cards stagger
    if (statsRef.current) {
      const cards = statsRef.current.querySelectorAll('.stat-card');
      gsap.fromTo(
        cards,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, delay: 1.2, stagger: 0.1, duration: 0.3, ease: 'back.out(1.7)' }
      );
    }

    // Breakdown section
    if (breakdownRef.current) {
      gsap.fromTo(
        breakdownRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, delay: 1.4, duration: 0.4, ease: 'power2.out' }
      );
    }

    // Progress bars animation
    const progressBars = document.querySelectorAll('.progress-bar-fill');
    progressBars.forEach((bar) => {
      const targetWidth = (bar as HTMLElement).dataset.width;
      gsap.fromTo(
        bar,
        { width: '0%' },
        { width: targetWidth, delay: 1.5, duration: 0.8, ease: 'power2.out' }
      );
    });

    // Wrong questions list
    if (reviewRef.current) {
      const items = reviewRef.current.querySelectorAll('.wrong-item');
      gsap.fromTo(
        items,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, delay: 1.8, stagger: 0.05, duration: 0.3, ease: 'power2.out' }
      );
    }

    // Action buttons
    if (actionsRef.current) {
      gsap.fromTo(
        actionsRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, delay: 2, duration: 0.3, ease: 'power2.out' }
      );
    }
  });

  const handleAddToWrongBook = () => {
    if (addedToWrongBook) return;

    const wrongIds = wrongQuestionItems.map(item => item.question.id);

    setWrongQuestions(prev => {
      const combined = [...new Set([...prev, ...wrongIds])];
      return combined;
    });

    setAddedToWrongBook(true);
  };

  const handleRetakeExam = () => {
    navigate('/exam');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const toggleExpand = (questionId: number) => {
    setExpandedQuestion(prev => (prev === questionId ? null : questionId));
  };

  return (
    <Layout title="考试结果">
      <div className="relative mx-auto w-full px-6 pb-12" style={{ maxWidth: 720, paddingTop: 40 }}>
        {/* Score Display */}
        <div className="flex flex-col items-center" ref={scoreRef}>
          <div className="flex items-baseline gap-2">
            <span
              className="font-bold"
              style={{
                fontSize: '5rem',
                lineHeight: 1,
                color: scoreColor,
                textShadow: `0 0 40px ${scoreColor}33`,
              }}
            >
              {scoreDisplay}
            </span>
            <span className="text-subtitle text-text-secondary">分</span>
          </div>

          <div
            className="exam-conclusion mt-4 flex items-center gap-2"
            style={{ opacity: 0 }}
          >
            {isPassed ? (
              <>
                <CheckCircle2 size={24} style={{ color: scoreColor }} />
                <span className="text-subtitle font-medium" style={{ color: scoreColor }}>
                  考试通过
                </span>
              </>
            ) : (
              <>
                <XCircle size={24} style={{ color: scoreColor }} />
                <span className="text-subtitle font-medium" style={{ color: scoreColor }}>
                  考试未通过
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div
          ref={statsRef}
          className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
          style={{ maxWidth: 480, margin: '32px auto 0' }}
        >
          <div
            className="stat-card flex flex-col items-center rounded-radius-lg bg-space-800 p-6"
            style={{ border: '1px solid #1E2A3E' }}
          >
            <span className="text-title font-bold" style={{ color: scoreColor }}>
              {correctCount}/{examQuestions.length}
            </span>
            <span className="text-body mt-2 text-text-secondary">得分</span>
          </div>

          <div
            className="stat-card flex flex-col items-center rounded-radius-lg bg-space-800 p-6"
            style={{ border: '1px solid #1E2A3E' }}
          >
            <span className="text-title font-bold text-lime-400">{accuracy}%</span>
            <span className="text-body mt-2 text-text-secondary">正确率</span>
          </div>

          <div
            className="stat-card flex flex-col items-center rounded-radius-lg bg-space-800 p-6"
            style={{ border: '1px solid #1E2A3E' }}
          >
            <span className="text-title font-bold text-accent-blue">
              {formatTimeUsed(timeUsed)}
            </span>
            <span className="text-body mt-2 text-text-secondary">用时</span>
          </div>
        </div>

        {/* Additional Stats Row */}
        <div className="mt-4 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-body text-text-secondary">正确</span>
            <span className="text-body font-bold text-success-400">{correctCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-body text-text-secondary">错误</span>
            <span className="text-body font-bold text-error-400">{wrongCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-body text-text-secondary">未答</span>
            <span className="text-body font-bold text-warning-400">{unansweredCount}</span>
          </div>
        </div>

        {/* Question Type Breakdown */}
        <div
          ref={breakdownRef}
          className="mt-6 rounded-radius-lg bg-space-800 p-6"
          style={{ border: '1px solid #1E2A3E' }}
        >
          <h3 className="text-subtitle text-text-primary mb-4">各题型分布</h3>

          {/* Single Choice */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-body text-text-secondary">
                单选题: {singleChoiceCorrect}/{totalSingleChoice} 正确
              </span>
              <span className="text-body text-text-secondary">
                {totalSingleChoice > 0 ? Math.round((singleChoiceCorrect / totalSingleChoice) * 100) : 0}%
              </span>
            </div>
            <div
              className="w-full overflow-hidden rounded-full"
              style={{ height: 12, backgroundColor: '#1E2A3E' }}
            >
              <div
                className="progress-bar-fill h-full rounded-full"
                style={{
                  backgroundColor: '#4ADE80',
                  width: '0%',
                }}
                data-width={`${totalSingleChoice > 0 ? (singleChoiceCorrect / totalSingleChoice) * 100 : 0}%`}
              />
            </div>
          </div>

          {/* True/False */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-body text-text-secondary">
                判断题: {trueFalseCorrect}/{totalTrueFalse} 正确
              </span>
              <span className="text-body text-text-secondary">
                {totalTrueFalse > 0 ? Math.round((trueFalseCorrect / totalTrueFalse) * 100) : 0}%
              </span>
            </div>
            <div
              className="w-full overflow-hidden rounded-full"
              style={{ height: 12, backgroundColor: '#1E2A3E' }}
            >
              <div
                className="progress-bar-fill h-full rounded-full"
                style={{
                  backgroundColor: '#60A5FA',
                  width: '0%',
                }}
                data-width={`${totalTrueFalse > 0 ? (trueFalseCorrect / totalTrueFalse) * 100 : 0}%`}
              />
            </div>
          </div>
        </div>

        {/* Wrong Questions Review */}
        {wrongQuestionItems.length > 0 && (
          <div
            ref={reviewRef}
            className="mt-6 rounded-radius-lg bg-space-800 p-6"
            style={{ border: '1px solid #1E2A3E' }}
          >
            <h3 className="text-subtitle text-error-400 mb-4">
              错题回顾（{wrongQuestionItems.length} 道）
            </h3>

            <div className="flex max-h-[400px] flex-col gap-3 overflow-y-auto pr-1">
              {wrongQuestionItems.map((item) => {
                const isExpanded = expandedQuestion === item.question.id;
                const answerMap: Record<string, string> = {
                  'A': '正确',
                  'B': '错误',
                  'true': '正确',
                  'false': '错误',
                };

                const displayCorrect = item.question.type === 'truefalse'
                  ? answerMap[item.correctAnswer] || item.correctAnswer
                  : item.correctAnswer;
                const displayUser = item.question.type === 'truefalse'
                  ? answerMap[item.userAnswer] || item.userAnswer
                  : item.userAnswer;

                return (
                  <div key={item.question.id} className="wrong-item">
                    <button
                      onClick={() => toggleExpand(item.question.id)}
                      className="flex w-full items-center gap-3 rounded-radius-md bg-space-900 p-4 text-left transition-colors hover:bg-space-700"
                      style={{ border: '1px solid #1E2A3E' }}
                    >
                      <span className="text-sm text-text-secondary">#{item.question.id}</span>
                      <span className="flex-1 truncate text-body text-text-primary">
                        {item.question.question.length > 25
                          ? item.question.question.slice(0, 25) + '...'
                          : item.question.question}
                      </span>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-error-400">你的: {displayUser}</span>
                        <span className="text-text-muted">·</span>
                        <span className="text-success-400">正确: {displayCorrect}</span>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div
                        className="mt-2 rounded-radius-md bg-space-900 p-4"
                        style={{ border: '1px solid #1E2A3E' }}
                      >
                        <p className="text-body-lg text-text-primary mb-4" style={{ lineHeight: 1.8 }}>
                          {item.question.question}
                        </p>

                        <div className="flex flex-col gap-3">
                          {item.question.type === 'single' && item.question.options && (
                            Object.entries(item.question.options).map(([key, value]) => {
                              const isCorrect = key === item.correctAnswer;
                              const isUserWrong = key === item.userAnswer && !isCorrect;

                              let state: 'default' | 'selected' | 'correct' | 'wrong' = 'default';
                              if (isCorrect) state = 'correct';
                              else if (isUserWrong) state = 'wrong';

                              return (
                                <OptionCard
                                  key={key}
                                  label={key}
                                  text={value}
                                  state={state}
                                  disabled
                                />
                              );
                            })
                          )}

                          {item.question.type === 'truefalse' && (
                            <>
                              <OptionCard
                                label="A"
                                text="正确"
                                state={item.correctAnswer === 'A' ? 'correct' : item.userAnswer === 'A' ? 'wrong' : 'default'}
                                disabled
                              />
                              <OptionCard
                                label="B"
                                text="错误"
                                state={item.correctAnswer === 'B' || item.correctAnswer === 'false' ? 'correct' : item.userAnswer === 'B' ? 'wrong' : 'default'}
                                disabled
                              />
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div ref={actionsRef} className="mt-8 flex flex-col gap-4 sm:flex-row">
          <button
            onClick={handleGoHome}
            className="flex flex-1 items-center justify-center gap-2 rounded-radius-md border-2 border-space-600 py-4 text-body-lg text-text-secondary transition-all duration-200 hover:border-accent-blue hover:text-accent-blue"
            style={{ minHeight: 56 }}
          >
            <Home size={20} />
            返回首页
          </button>

          {wrongQuestionItems.length > 0 && (
            <button
              onClick={handleAddToWrongBook}
              disabled={addedToWrongBook}
              className="flex flex-1 items-center justify-center gap-2 rounded-radius-md py-4 text-body-lg font-bold text-text-inverse transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                minHeight: 56,
                backgroundColor: addedToWrongBook ? '#4ADE80' : '#EF4444',
              }}
            >
              {addedToWrongBook ? (
                <>
                  <CheckCircle2 size={20} />
                  已加入错题本
                </>
              ) : (
                <>
                  <BookX size={20} />
                  错题加入错题本
                </>
              )}
            </button>
          )}

          <button
            onClick={handleRetakeExam}
            className="flex flex-1 items-center justify-center gap-2 rounded-radius-md py-4 text-body-lg font-bold text-text-inverse transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{ minHeight: 56, backgroundColor: '#D4F935' }}
          >
            <RotateCcw size={20} />
            再考一次
          </button>
        </div>

        {/* Footer spacer */}
        <div style={{ height: 40 }} />
      </div>
    </Layout>
  );
}

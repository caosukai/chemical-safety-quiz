import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { CheckCircle2, XCircle, ChevronDown, Check, ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import type { Question, AnswerRecord } from '@/types/quiz';
import { useQuizData } from '@/hooks/useQuizData';
import { useSpeech } from '@/hooks/useSpeech';
import type { VoiceType } from '@/hooks/useSpeech';
import {
  useLocalStorage,
  useWrongQuestions,
  useAnswerHistory,
  useUserProgress,
  computeProgress,
  STORAGE_KEYS,
} from '@/hooks/useLocalStorage';
import Layout from '@/components/Layout';
import OptionCard from '@/components/OptionCard';
import QuestionHeader from '@/components/QuestionHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import QuestionAnalysis from '@/components/QuestionAnalysis';
import SpeakButton from '@/components/SpeakButton';

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

type PracticeModeType = 'sequential' | 'random';
type QuestionTypeFilter = 'all' | 'single' | 'truefalse';

interface PracticeModeProps {
  mode: PracticeModeType;
  title: string;
  typeFilter?: QuestionTypeFilter;
}

interface SessionStats {
  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
}

export default function PracticeMode({ mode, title, typeFilter = 'all' }: PracticeModeProps) {
  const navigate = useNavigate();
  const { questions: allQuestions, loading, error } = useQuizData();
  const [, setWrongQuestions] = useWrongQuestions();
  const [answerHistory, setAnswerHistory] = useAnswerHistory();
  const [, setUserProgress] = useUserProgress();
  const [sequentialProgress, setSequentialProgress] = useLocalStorage(
    STORAGE_KEYS.SEQUENTIAL_PROGRESS,
    { currentIndex: 0, totalAnswered: 0 }
  );

  // Filter questions by type
  const questions = useMemo(() => {
    if (typeFilter === 'all') return allQuestions;
    return allQuestions.filter(q => q.type === typeFilter);
  }, [allQuestions, typeFilter]);

  // Session-ordered questions (original or shuffled)
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);

  // Core state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    totalAnswered: 0,
    correctCount: 0,
    wrongCount: 0,
  });
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  // Refs for GSAP animations
  const questionContainerRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Speech synthesis
  const { speak, speakQueue, stop, autoPlay, toggleAutoPlay } = useSpeech();
  const isFirstMount = useRef(true);

  // Initialize session questions
  const hasInitRef = useRef(false);
  useEffect(() => {
    if (questions.length === 0 || hasInitRef.current) return;
    hasInitRef.current = true;

    if (mode === 'random') {
      setSessionQuestions(shuffleArray(questions));
      setCurrentIndex(0);
    } else {
      setSessionQuestions([...questions]);
      setCurrentIndex(sequentialProgress.currentIndex);
    }
  }, [questions, mode, sequentialProgress.currentIndex]);

  // Derive current question
  const currentQuestion: Question | null = sessionQuestions[currentIndex] ?? null;

  // Check previous answers for current question
  const previousAnswers = useMemo(() => {
    if (!currentQuestion) return [];
    return answerHistory.filter(r => r.questionId === currentQuestion.id);
  }, [answerHistory, currentQuestion]);
  const hasAnsweredBefore = previousAnswers.length > 0;
  const lastAnswer = hasAnsweredBefore ? previousAnswers[previousAnswers.length - 1] : null;

  // Compute accuracy percentage
  const accuracy = useMemo(() => {
    if (stats.totalAnswered === 0) return 0;
    return Math.round((stats.correctCount / stats.totalAnswered) * 100);
  }, [stats]);

  // Get option entries for current question
  const optionEntries = useMemo(() => {
    if (!currentQuestion) return [];
    if (currentQuestion.type === 'truefalse') {
      return [
        ['A', '正确'],
        ['B', '错误'],
      ] as [string, string][];
    }
    if (currentQuestion.options) {
      return Object.entries(currentQuestion.options) as [string, string][];
    }
    return [];
  }, [currentQuestion]);

  // Get correct option label
  const correctLabel = useMemo(() => {
    if (!currentQuestion) return '';
    if (currentQuestion.type === 'truefalse') {
      return currentQuestion.answer === true ? 'A' : 'B';
    }
    return currentQuestion.answer as string;
  }, [currentQuestion]);

  // Handle option selection
  const handleSelectOption = useCallback(
    (label: string) => {
      if (showResult || !currentQuestion) return;

      setSelectedOption(label);
      setShowResult(true);

      // Determine if correct
      let correct = false;
      if (currentQuestion.type === 'truefalse') {
        const selectedBool = label === 'A'; // A=true, B=false
        correct = selectedBool === currentQuestion.answer;
      } else {
        correct = label === currentQuestion.answer;
      }
      setIsCorrect(correct);

      // Update stats
      setStats((prev) => ({
        totalAnswered: prev.totalAnswered + 1,
        correctCount: prev.correctCount + (correct ? 1 : 0),
        wrongCount: prev.wrongCount + (correct ? 0 : 1),
      }));

      // Save wrong questions
      if (!correct) {
        setWrongQuestions((prev) => {
          if (prev.includes(currentQuestion.id)) return prev;
          return [...prev, currentQuestion.id];
        });
      }

      // Record answer in answer history
      const newRecord: AnswerRecord = {
        questionId: currentQuestion.id,
        selected: label,
        isCorrect: correct,
        timestamp: Date.now(),
      };
      setAnswerHistory(prev => [...prev, newRecord]);
      // Update progress
      setUserProgress(computeProgress([...answerHistory, newRecord], allQuestions));

      // Save answer record to localStorage
      try {
        const existing = window.localStorage.getItem(STORAGE_KEYS.ANSWERS);
        const answers = existing ? JSON.parse(existing) : {};
        answers[currentQuestion.id] = {
          selectedOption: label,
          isCorrect: correct,
          timestamp: Date.now(),
        };
        window.localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(answers));
      } catch {
        // ignore
      }

      // Save sequential progress
      if (mode === 'sequential') {
        setSequentialProgress({
          currentIndex: currentIndex + 1,
          totalAnswered: stats.totalAnswered + 1,
        });
      }

      // Show feedback animation
      setTimeout(() => {
        setShowExplanation(true);
      }, 300);
    },
    [showResult, currentQuestion, currentIndex, mode, stats, setWrongQuestions, setSequentialProgress, answerHistory, setAnswerHistory, setUserProgress, allQuestions]
  );

  // Handle next question
  const handleNext = useCallback(() => {
    if (!currentQuestion) return;

    const isLast = currentIndex >= sessionQuestions.length - 1;

    if (isLast) {
      // Show completion dialog
      setShowCompleteDialog(true);
      return;
    }

    // Animate out current question
    if (questionContainerRef.current) {
      gsap.to(questionContainerRef.current, {
        opacity: 0,
        y: -20,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          // Reset state and advance
          setSelectedOption(null);
          setShowResult(false);
          setIsCorrect(false);
          setShowExplanation(false);
          setCurrentIndex((prev) => prev + 1);

          // Animate in new question
          gsap.fromTo(
            questionContainerRef.current,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
          );
        },
      });
    } else {
      setSelectedOption(null);
      setShowResult(false);
      setIsCorrect(false);
      setShowExplanation(false);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentQuestion, currentIndex, sessionQuestions.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentQuestion || showCompleteDialog) return;

      if (!showResult) {
        // Option selection
        if (currentQuestion.type === 'single') {
          const keyMap: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };
          const upperKey = e.key.toLowerCase();
          if (upperKey in keyMap) {
            handleSelectOption(keyMap[upperKey]);
          }
        } else if (currentQuestion.type === 'truefalse') {
          if (e.key === '1') handleSelectOption('A');
          if (e.key === '2') handleSelectOption('B');
        }
      } else {
        // Next question shortcuts
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
          e.preventDefault();
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, showResult, showCompleteDialog, handleSelectOption, handleNext]);

  // Auto-read question when it changes (female voice)
  useEffect(() => {
    if (!currentQuestion || !autoPlay) return;
    // Skip on first mount to avoid reading immediately on page load
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    // Build speech text for the question
    let text = currentQuestion.question;
    if (currentQuestion.type === 'truefalse') {
      text += '，选项：A 正确，B 错误';
    } else if (currentQuestion.options) {
      const opts = Object.entries(currentQuestion.options)
        .map(([k, v]) => `${k} ${v}`)
        .join('，');
      text += '，选项：' + opts;
    }

    // Stop any ongoing speech and read the new question (female voice)
    stop();
    setTimeout(() => {
      speak(text, 'female');
    }, 400);
  }, [currentQuestion, autoPlay, speak, stop]);

  // Speak feedback when answer is selected (male voice for result, female for analysis)
  useEffect(() => {
    if (!showResult || !currentQuestion || !autoPlay) return;

    const queue: { text: string; voiceType: VoiceType }[] = [];

    if (isCorrect) {
      queue.push({ text: '回答正确！', voiceType: 'male' });
    } else {
      queue.push({ text: '回答错误。', voiceType: 'male' });
      // Tell correct answer
      if (currentQuestion.type === 'truefalse') {
        const correctText = currentQuestion.answer === true ? '正确' : '错误';
        queue.push({ text: `正确答案是：${correctText}`, voiceType: 'female' });
      } else {
        const correctLabel = String(currentQuestion.answer);
        const correctText = currentQuestion.options?.[correctLabel] || correctLabel;
        queue.push({ text: `正确答案是：${correctLabel}，${correctText}`, voiceType: 'female' });
      }
    }

    // Add brief analysis
    const lawRule = findLawRule(currentQuestion);
    if (lawRule) {
      queue.push({ text: lawRule.explain, voiceType: 'female' });
    } else {
      queue.push({ text: isCorrect ? '做得好，继续加油！' : '请注意理解相关法规规定。', voiceType: 'female' });
    }

    // Delay to let the option selection animation finish
    setTimeout(() => {
      speakQueue(queue.map(q => ({ ...q, rate: 1.1 })));
    }, 500);
  }, [showResult, isCorrect, currentQuestion, autoPlay, speakQueue]);

  // Helper to find law rule for a question
  const findLawRule = (q: Question) => {
    const LAW_KEYWORDS = [
      { keywords: ['四新', '新方法'], explain: '四新指新工艺、新技术、新材料、新设备，不包括新方法。' },
      { keywords: ['建设项目安全审查', '仅指'], explain: '建设项目安全审查包括安全条件审查、安全设施设计审查和竣工验收三部分，不只是安全条件审查。' },
      { keywords: ['泡沫灭火器', '金属钠'], explain: '泡沫灭火器含水，金属钠遇水产生氢气会加剧火势，不能用泡沫灭火器扑救金属钠火灾。' },
      { keywords: ['工伤保险条例', '目的'], explain: '工伤保险条例的目的是分散用人单位的工伤风险，保障职工获得医疗救治和经济补偿。' },
      { keywords: ['个人不得购买', '易制毒'], explain: '个人不得购买第一类、第二类易制毒化学品。' },
      { keywords: ['剧毒化学品', '个人不得购买'], explain: '个人不得购买剧毒化学品，但属于剧毒化学品的农药除外。' },
      { keywords: ['应急预案', '主要负责人'], explain: '生产经营单位主要负责人负责组织编制和实施应急预案。' },
      { keywords: ['工伤保险费', '用人单位'], explain: '工伤保险费由用人单位缴纳，职工个人不缴纳。' },
      { keywords: ['安全警示标志'], explain: '生产经营单位应当在有较大危险因素的场所设置明显的安全警示标志。' },
      { keywords: ['主要负责人', '全面负责'], explain: '生产经营单位的主要负责人对本单位安全生产工作全面负责。' },
      { keywords: ['氯气', '防化服'], explain: '生产、储存和使用氯气的企业应当配备至少两套以上全封闭防化服。' },
      { keywords: ['双手控制安全装置'], explain: '双手控制安全装置只能保护操作者本人，无法保护其他人员。' },
      { keywords: ['事故隐患', '危险源'], explain: '事故隐患一定是危险源，但危险源不一定是事故隐患。' },
      { keywords: ['综合应急预案', '演练'], explain: '综合应急预案每年至少演练一次。' },
      { keywords: ['一级动火作业'], explain: '一级动火作业是指在火灾爆炸危险场所进行的除特级动火以外的动火作业。' },
      { keywords: ['光气', '氯气', '穿越公共区域'], explain: '禁止光气、氯气等剧毒气体化学品管道穿越公共区域。' },
      { keywords: ['10个工作日内'], explain: '新建企业应在安全设施竣工验收通过后10个工作日内提出安全生产许可证申请。' },
      { keywords: ['身体和精神方面的原因'], explain: '身体和精神方面的原因属于事故的间接原因，不是直接原因。' },
      { keywords: ['盲板抽堵', '30m'], explain: '距盲板抽堵作业地点30米内不应有动火作业。' },
      { keywords: ['特种作业', '每3年'], explain: '特种作业操作证每3年复审一次。' },
    ];
    for (const rule of LAW_KEYWORDS) {
      if (rule.keywords.some(kw => q.question.includes(kw))) return rule;
    }
    return null;
  };

  // GSAP feedback animations
  useGSAP(() => {
    if (!showResult) return;

    // Animate feedback area
    if (feedbackRef.current) {
      gsap.fromTo(
        feedbackRef.current,
        { opacity: 0, height: 0 },
        { opacity: 1, height: 'auto', duration: 0.3, ease: 'power2.out', delay: 0.1 }
      );
    }

    // Animate stats area
    if (statsRef.current) {
      gsap.fromTo(
        statsRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', delay: 0.2 }
      );
    }

    // Shake animation for wrong answer on the selected wrong option
    if (!isCorrect) {
      const wrongIdx = optionEntries.findIndex(([label]) => label === selectedOption);
      if (wrongIdx >= 0 && optionRefs.current[wrongIdx]) {
        gsap.to(optionRefs.current[wrongIdx], {
          x: 8,
          duration: 0.4,
          ease: 'power2.out',
          delay: 0.1,
        });
      }
    }
  }, { dependencies: [showResult, isCorrect, selectedOption] });

  // Get option state for rendering
  const getOptionState = (label: string): 'default' | 'selected' | 'correct' | 'wrong' => {
    if (!showResult) return 'default';
    if (label === correctLabel) return 'correct';
    if (label === selectedOption && !isCorrect) return 'wrong';
    return 'default';
  };

  // Get option display label (with icons for true/false)
  const getOptionDisplayLabel = (label: string): string => {
    if (!currentQuestion) return label;
    if (currentQuestion.type === 'truefalse') {
      return label === 'A' ? '✓' : '✗';
    }
    return label;
  };

  // Loading state
  if (loading) {
    return (
      <Layout title={title}>
        <div className="flex items-center justify-center px-6" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <div
              className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4"
              style={{ borderColor: '#1E2A3E', borderTopColor: '#D4F935' }}
            />
            <p className="text-body-lg text-text-secondary">加载题目中...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (error) {
    return (
      <Layout title={title}>
        <div className="flex items-center justify-center px-6" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <XCircle size={48} className="mx-auto mb-4 text-error-400" />
            <p className="text-body-lg text-error-400 mb-2">加载失败</p>
            <p className="text-body text-text-secondary">{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Empty state
  if (!currentQuestion) {
    return (
      <Layout title={title}>
        <div className="flex items-center justify-center px-6" style={{ minHeight: '60vh' }}>
          <p className="text-body-lg text-text-secondary">暂无题目数据</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={title}>
      <div className="mx-auto max-w-[800px] px-4 pb-28 pt-4">
        {/* Question container with animation */}
        <div ref={questionContainerRef}>
          {/* Question Header */}
          <QuestionHeader
            question={currentQuestion}
            currentIndex={currentIndex}
            totalQuestions={sessionQuestions.length}
            isAnswered={hasAnsweredBefore}
            isCorrect={lastAnswer?.isCorrect}
          />

          {/* Show original question ID + Auto-play toggle */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-subtitle text-lime-400" style={{ fontWeight: 700 }}>
                #{String(currentQuestion.id).padStart(3, '0')}
              </span>
              {mode === 'random' && (
                <span className="text-sm text-text-muted">（随机）</span>
              )}
            </div>
            {/* Auto-play toggle */}
            <button
              onClick={toggleAutoPlay}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                backgroundColor: autoPlay ? 'rgba(212, 249, 53, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${autoPlay ? '#D4F935' : '#1E2A3E'}`,
                color: autoPlay ? '#D4F935' : '#94A3B8',
              }}
              title={autoPlay ? '关闭自动朗读' : '开启自动朗读'}
            >
              {autoPlay ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>{autoPlay ? '自动读题：开' : '自动读题：关'}</span>
            </button>
          </div>

          {/* Already answered banner */}
          {hasAnsweredBefore && lastAnswer && (
            <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-2"
              style={{
                backgroundColor: lastAnswer.isCorrect ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                border: `1px solid ${lastAnswer.isCorrect ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
              }}
            >
              {lastAnswer.isCorrect ? (
                <CheckCircle2 size={18} className="text-success-400" />
              ) : (
                <XCircle size={18} className="text-error-400" />
              )}
              <span className={`text-sm ${lastAnswer.isCorrect ? 'text-success-400' : 'text-error-400'}`}>
                已做过 {previousAnswers.length} 次 · 上次{lastAnswer.isCorrect ? '正确' : '错误'}
                {previousAnswers.length > 1 && (
                  <span className="text-text-muted ml-1">
                    (历史正确率: {Math.round(previousAnswers.filter(a => a.isCorrect).length / previousAnswers.length * 100)}%)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Question Body */}
          <div
            className="mb-6 w-full rounded-radius-lg bg-space-800 px-6 py-6 sm:px-8"
            style={{ minHeight: 120 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-text-muted">第 {currentIndex + 1} 题</span>
              <SpeakButton question={currentQuestion} />
            </div>
            <p className="text-body-lg leading-relaxed text-text-primary" style={{ lineHeight: 1.8 }}>
              {currentQuestion.question}
            </p>
          </div>

          {/* Options Area */}
          <div className="mb-6 flex flex-col gap-4">
            {optionEntries.map(([label, text], idx) => (
              <div
                key={`${currentQuestion.id}-${label}`}
                ref={(el) => { optionRefs.current[idx] = el; }}
              >
                <OptionCard
                  label={getOptionDisplayLabel(label)}
                  text={text}
                  state={getOptionState(label)}
                  onClick={() => handleSelectOption(label)}
                  disabled={showResult}
                  index={idx}
                />
              </div>
            ))}
          </div>

          {/* Feedback Area */}
          {showResult && (
            <div
              ref={feedbackRef}
              className="mb-6 overflow-hidden rounded-radius-lg"
              style={{
                backgroundColor: isCorrect ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                border: `2px solid ${isCorrect ? '#4ADE80' : '#F87171'}`,
              }}
            >
              <div className="p-6">
                {/* Result header */}
                <div className="mb-3 flex items-center gap-3">
                  {isCorrect ? (
                    <CheckCircle2 size={32} className="text-success-400" />
                  ) : (
                    <XCircle size={32} className="text-error-400" />
                  )}
                  <span
                    className="text-subtitle"
                    style={{
                      color: isCorrect ? '#4ADE80' : '#F87171',
                      fontWeight: 700,
                    }}
                  >
                    {isCorrect ? '回答正确！' : '回答错误！'}
                  </span>
                </div>

                {/* Show correct answer when wrong */}
                {!isCorrect && (
                  <p className="mb-3 text-body-lg text-text-primary">
                    正确答案：
                    <span className="font-bold text-success-400"> {correctLabel}</span>
                  </p>
                )}

                {/* Explanation collapsible */}
                <button
                  onClick={() => setShowExplanation((prev) => !prev)}
                  className="flex items-center gap-2 text-body text-text-secondary transition-colors hover:text-accent-blue"
                >
                  <span>{showExplanation ? '收起解析' : '查看解析'}</span>
                  <ChevronDown
                    size={18}
                    className="transition-transform duration-300"
                    style={{ transform: showExplanation ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {/* AI Analysis - always show after answering */}
                {showExplanation && selectedOption && (
                  <QuestionAnalysis
                    question={currentQuestion}
                    selectedLabel={selectedOption}
                    isCorrect={isCorrect}
                  />
                )}
              </div>
            </div>
          )}

          {/* Stats Bar */}
          {stats.totalAnswered > 0 && (
            <div
              ref={statsRef}
              className="mb-6 flex flex-col gap-4 rounded-radius-lg bg-space-800 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              {/* Accuracy progress */}
              <div className="flex-1">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-body text-text-secondary">正确率</span>
                  <span className="text-subtitle" style={{ color: '#D4F935', fontWeight: 700 }}>
                    {accuracy}%
                  </span>
                </div>
                <div
                  className="w-full overflow-hidden rounded-full"
                  style={{ height: 8, backgroundColor: '#1E2A3E' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${accuracy}%`,
                      backgroundColor: '#D4F935',
                    }}
                  />
                </div>
              </div>

              {/* Stats text */}
              <div className="flex items-center gap-4 text-body sm:pl-6">
                <span className="text-text-secondary">
                  已答 <span className="text-lime-400">{stats.totalAnswered}</span> 题
                </span>
                <span className="text-text-secondary">
                  对 <span className="text-success-400">{stats.correctCount}</span> 题
                </span>
                <span className="text-text-secondary">
                  错 <span className="text-error-400">{stats.wrongCount}</span> 题
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-6 py-4"
        style={{
          backgroundColor: 'rgba(3, 6, 21, 0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="mx-auto max-w-[800px]">
          <button
            onClick={handleNext}
            disabled={!showResult}
            className="flex w-full items-center justify-center gap-2 rounded-radius-md text-body-lg font-bold transition-all duration-200 hover:translate-y-[-2px] hover:shadow-button active:scale-[0.97] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            style={{
              minHeight: 56,
              backgroundColor: showResult ? '#D4F935' : '#2E3F5C',
              color: showResult ? '#030615' : '#64748B',
            }}
          >
            {currentIndex >= sessionQuestions.length - 1 ? (
              <>
                完成练习
                <Check size={20} />
              </>
            ) : (
              <>
                下一题
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Completion Dialog */}
      <ConfirmDialog
        open={showCompleteDialog}
        title="练习完成！"
        message={`本次共答 ${stats.totalAnswered} 题，正确率 ${accuracy}%（对 ${stats.correctCount} 题，错 ${stats.wrongCount} 题）。`}
        confirmLabel="查看错题"
        cancelLabel="返回首页"
        confirmVariant="primary"
        onConfirm={() => {
          setShowCompleteDialog(false);
          navigate('/wrong-questions');
        }}
        onCancel={() => {
          setShowCompleteDialog(false);
          navigate('/');
        }}
      />
    </Layout>
  );
}

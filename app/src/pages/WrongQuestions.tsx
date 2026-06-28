import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import gsap from 'gsap';
import { CheckCircle2, RotateCcw, FileQuestion, ChevronLeft } from 'lucide-react';
import Layout from '@/components/Layout';
import OptionCard from '@/components/OptionCard';
import QuestionHeader from '@/components/QuestionHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useQuizData } from '@/hooks/useQuizData';
import { useWrongQuestions, useLocalStorage, useSettings } from '@/hooks/useLocalStorage';
import type { Question } from '@/types/quiz';

type FilterTab = 'all' | 'single' | 'truefalse';

type PageState = 'list' | 'practice' | 'result';

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error';
}

export default function WrongQuestions() {
  const { questions, loading } = useQuizData();
  const [wrongQuestionIds, setWrongQuestionIds] = useWrongQuestions();
  const [settings] = useSettings();
  const [answers] = useLocalStorage<Record<number, { selectedOption: string; isCorrect: boolean; timestamp: number }>>('hzp_answers', {});

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [pageState, setPageState] = useState<PageState>('list');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [removedIds, _setRemovedIds] = useState<number[]>([]);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });

  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const toastRef = useRef<HTMLDivElement>(null);

  // Build wrong questions data
  const wrongQuestions = useMemo(() => {
    return wrongQuestionIds
      .map(id => questions.find(q => q.id === id))
      .filter((q): q is Question => q !== undefined);
  }, [wrongQuestionIds, questions]);

  const filteredQuestions = useMemo(() => {
    if (activeFilter === 'all') return wrongQuestions;
    if (activeFilter === 'single') return wrongQuestions.filter(q => q.type === 'single');
    return wrongQuestions.filter(q => q.type === 'truefalse');
  }, [wrongQuestions, activeFilter]);

  const stats = useMemo(() => {
    const single = wrongQuestions.filter(q => q.type === 'single').length;
    const truefalse = wrongQuestions.filter(q => q.type === 'truefalse').length;
    return { total: wrongQuestions.length, single, truefalse };
  }, [wrongQuestions]);

  // GSAP entrance animation for cards
  useEffect(() => {
    if (pageState === 'list' && listRef.current) {
      const cards = listRef.current.querySelectorAll('.wq-card');
      gsap.fromTo(
        cards,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: 'power2.out' }
      );
    }
  }, [pageState, activeFilter, removedIds]);

  // Toast animation
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    if (toastRef.current) {
      gsap.fromTo(
        toastRef.current,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
      );
    }
    setTimeout(() => {
      if (toastRef.current) {
        gsap.to(toastRef.current, {
          opacity: 0,
          y: -20,
          duration: 0.2,
          ease: 'power2.in',
          onComplete: () => setToast({ show: false, message: '', type }),
        });
      } else {
        setToast({ show: false, message: '', type });
      }
    }, 2000);
  }, []);

  const handleFilterChange = (filter: FilterTab) => {
    if (filter === activeFilter) return;
    if (listRef.current) {
      const cards = listRef.current.querySelectorAll('.wq-card');
      gsap.to(cards, {
        opacity: 0,
        duration: 0.15,
        onComplete: () => setActiveFilter(filter),
      });
    } else {
      setActiveFilter(filter);
    }
  };

  const enterReanswerMode = (question: Question) => {
    setCurrentQuestion(question);
    setSelectedOption(null);
    setIsAnswered(false);
    setIsCorrect(false);
    setPageState('practice');
  };

  const handleOptionSelect = (optionKey: string) => {
    if (isAnswered || !currentQuestion) return;
    setSelectedOption(optionKey);
    setIsAnswered(true);

    const correct =
      currentQuestion.type === 'single'
        ? optionKey === currentQuestion.answer
        : (optionKey === 'A' && currentQuestion.answer === true) || (optionKey === 'B' && currentQuestion.answer === false);

    setIsCorrect(correct);

    if (correct) {
      // Remove from wrong questions
      setWrongQuestionIds(prev => prev.filter(id => id !== currentQuestion.id));
      showToast('答对了！已移出错题本', 'success');
    } else {
      showToast('答错了，继续加油！', 'error');
    }
  };

  const handleBackToList = () => {
    setCurrentQuestion(null);
    setSelectedOption(null);
    setIsAnswered(false);
    setIsCorrect(false);
    setPageState('list');
  };

  const handleNextWrongQuestion = () => {
    if (!currentQuestion) return;
    const currentIndex = filteredQuestions.findIndex(q => q.id === currentQuestion.id);
    const nextQuestion = filteredQuestions[currentIndex + 1];
    if (nextQuestion) {
      enterReanswerMode(nextQuestion);
    } else {
      handleBackToList();
    }
  };

  // Get option label display
  const getOptionLabel = (key: string): string => {
    if (!currentQuestion) return key;
    if (currentQuestion.type === 'truefalse') {
      return key === 'A' ? '✓' : '✗';
    }
    return key;
  };

  const getOptionText = (key: string): string => {
    if (!currentQuestion || !currentQuestion.options) return '';
    return currentQuestion.options[key] || '';
  };

  const getOptionState = (key: string): 'default' | 'selected' | 'correct' | 'wrong' => {
    if (!isAnswered) {
      return selectedOption === key ? 'selected' : 'default';
    }
    if (currentQuestion?.type === 'single') {
      if (key === currentQuestion.answer) return 'correct';
      if (key === selectedOption && key !== currentQuestion.answer) return 'wrong';
    } else if (currentQuestion?.type === 'truefalse') {
      const correctKey = currentQuestion.answer === true ? 'A' : 'B';
      if (key === correctKey) return 'correct';
      if (key === selectedOption && key !== correctKey) return 'wrong';
    }
    return 'default';
  };

  // Font size map
  const fontSizeMap: Record<string, { question: string; option: string }> = {
    normal: { question: '1.25rem', option: '1.125rem' },
    large: { question: '1.375rem', option: '1.25rem' },
    'extra-large': { question: '1.5rem', option: '1.375rem' },
  };
  const currentFontSize = fontSizeMap[settings.fontSize] || fontSizeMap.normal;

  // Truncate question text
  const truncateText = (text: string, maxLen: number): string => {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + '...';
  };

  // Get user's previous answer display
  const getPreviousAnswer = (question: Question): string => {
    const answerRecord = answers[question.id];
    if (!answerRecord) return '—';
    if (question.type === 'truefalse') {
      return answerRecord.selectedOption === 'A' ? '✓' : '✗';
    }
    return answerRecord.selectedOption;
  };

  // Filters
  const filters: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: stats.total },
    { key: 'single', label: '单选题', count: stats.single },
    { key: 'truefalse', label: '判断题', count: stats.truefalse },
  ];

  // Loading state
  if (loading) {
    return (
      <Layout title="错题本">
        <div className="flex items-center justify-center px-6" style={{ minHeight: '60vh' }}>
          <p className="text-body text-text-secondary">加载中...</p>
        </div>
      </Layout>
    );
  }

  // ======= RE-ANSWER MODE =======
  if (pageState === 'practice' && currentQuestion) {
    return (
      <div className="relative min-h-[100dvh]" style={{ zIndex: 1 }}>
        {/* Header */}
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
          style={{
            height: 64,
            backgroundColor: 'rgba(3, 6, 21, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <button
            onClick={() => setShowBackConfirm(true)}
            className="flex items-center justify-center rounded-full transition-all duration-200 hover:bg-space-800"
            style={{ width: 40, height: 40 }}
            aria-label="返回"
          >
            <ChevronLeft size={24} className="text-text-secondary hover:text-lime-400 transition-colors" />
          </button>
          <h1 className="text-subtitle text-text-primary">错题重做</h1>
          <div style={{ width: 40 }} />
        </div>

        {/* Toast */}
        {toast.show && (
          <div
            ref={toastRef}
            className="fixed top-20 left-0 right-0 z-[70] flex justify-center px-4 pointer-events-none"
          >
            <div
              className="rounded-radius-lg px-6 py-3 text-body font-medium shadow-lg"
              style={{
                backgroundColor: toast.type === 'success' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                color: toast.type === 'success' ? '#4ADE80' : '#F87171',
                border: `1px solid ${toast.type === 'success' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
                backdropFilter: 'blur(12px)',
              }}
            >
              {toast.message}
            </div>
          </div>
        )}

        {/* Content */}
        <main className="relative px-6" style={{ paddingTop: 88, paddingBottom: 140, maxWidth: 800, margin: '0 auto' }}>
          <QuestionHeader
            question={currentQuestion}
            currentIndex={0}
            totalQuestions={1}
          />

          {/* Question text */}
          <div
            className="mb-8 rounded-radius-lg bg-space-800 p-6"
            style={{ border: '1px solid #1E2A3E' }}
          >
            <p style={{ fontSize: currentFontSize.question, lineHeight: 1.8, color: '#F8FAFC' }}>
              {currentQuestion.question}
            </p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-4">
            {currentQuestion.type === 'single' && currentQuestion.options &&
              Object.keys(currentQuestion.options).map(key => (
                <OptionCard
                  key={key}
                  label={getOptionLabel(key)}
                  text={getOptionText(key)}
                  state={getOptionState(key)}
                  onClick={() => handleOptionSelect(key)}
                  disabled={isAnswered}
                  index={Object.keys(currentQuestion.options!).indexOf(key)}
                />
              ))}
            {currentQuestion.type === 'truefalse' && (
              <>
                <OptionCard
                  label="✓"
                  text="正确"
                  state={getOptionState('A')}
                  onClick={() => handleOptionSelect('A')}
                  disabled={isAnswered}
                  index={0}
                />
                <OptionCard
                  label="✗"
                  text="错误"
                  state={getOptionState('B')}
                  onClick={() => handleOptionSelect('B')}
                  disabled={isAnswered}
                  index={1}
                />
              </>
            )}
          </div>

          {/* Explanation after answering */}
          {isAnswered && (
            <div
              className="mt-6 rounded-radius-lg p-6"
              style={{
                backgroundColor: isCorrect ? 'rgba(74, 222, 128, 0.08)' : 'rgba(248, 113, 113, 0.08)',
                border: `1px solid ${isCorrect ? 'rgba(74, 222, 128, 0.25)' : 'rgba(248, 113, 113, 0.25)'}`,
              }}
            >
              <p
                className="text-body-lg font-medium mb-2"
                style={{ color: isCorrect ? '#4ADE80' : '#F87171' }}
              >
                {isCorrect ? '回答正确！' : '回答错误'}
              </p>
              <p className="text-body text-text-secondary">
                正确答案：
                <span className="font-medium" style={{ color: '#4ADE80' }}>
                  {currentQuestion.type === 'single'
                    ? currentQuestion.answer
                    : currentQuestion.answer === true
                      ? '✓ 正确'
                      : '✗ 错误'}
                </span>
              </p>
            </div>
          )}
        </main>

        {/* Bottom action bar */}
        <div
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 px-6 py-4"
          style={{
            backgroundColor: 'rgba(3, 6, 21, 0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <button
            onClick={handleBackToList}
            className="rounded-radius-lg border-2 border-space-600 px-4 py-3 text-body-lg text-text-secondary transition-all duration-200 hover:border-accent-blue hover:text-accent-blue"
            style={{ minHeight: 56 }}
          >
            返回列表
          </button>
          <button
            onClick={handleNextWrongQuestion}
            className="flex-1 rounded-radius-lg py-3 text-body-lg font-bold text-text-inverse transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{
              minHeight: 56,
              backgroundColor: '#D4F935',
            }}
          >
            下一题
          </button>
        </div>

        {/* Back confirm dialog */}
        <ConfirmDialog
          open={showBackConfirm}
          title="确认返回"
          message="确定要返回到错题列表吗？"
          confirmLabel="返回"
          cancelLabel="继续做题"
          confirmVariant="primary"
          onConfirm={handleBackToList}
          onCancel={() => setShowBackConfirm(false)}
        />
      </div>
    );
  }

  // ======= LIST MODE =======
  return (
    <Layout title="错题本">
      {/* Toast */}
      {toast.show && (
        <div
          ref={toastRef}
          className="fixed top-20 left-0 right-0 z-[70] flex justify-center px-4 pointer-events-none"
        >
          <div
            className="rounded-radius-lg px-6 py-3 text-body font-medium shadow-lg"
            style={{
              backgroundColor: toast.type === 'success' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
              color: toast.type === 'success' ? '#4ADE80' : '#F87171',
              border: `1px solid ${toast.type === 'success' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            {toast.message}
          </div>
        </div>
      )}

      <div className="px-6 py-6" style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Stats Header */}
        <div className="mb-6 text-center">
          <p className="text-body text-text-secondary">
            共 <span className="text-title font-bold text-error-400">{stats.total}</span> 道错题
          </p>
          <p className="text-sm text-text-muted mt-1">
            单选题 {stats.single} 题 &middot; 判断题 {stats.truefalse} 题
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex items-center justify-center gap-3">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className="flex items-center gap-1.5 rounded-full px-5 text-body transition-all duration-200"
              style={{
                height: 40,
                backgroundColor: activeFilter === f.key ? 'rgba(248, 113, 113, 0.2)' : 'transparent',
                border: activeFilter === f.key ? '1px solid #F87171' : '1px solid #2E3F5C',
                color: activeFilter === f.key ? '#F87171' : '#94A3B8',
              }}
            >
              {f.label}
              <span
                className="text-sm"
                style={{
                  color: activeFilter === f.key ? '#F87171' : '#64748B',
                }}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Empty State */}
        {stats.total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-bounce-slow mb-6">
              <CheckCircle2 size={64} style={{ color: '#4ADE80' }} />
            </div>
            <p className="text-subtitle text-text-primary mb-2">太棒了！暂无错题</p>
            <p className="text-body text-text-secondary">继续保持，加油！</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FileQuestion size={48} className="text-text-muted mb-4" />
            <p className="text-body text-text-secondary">该分类下暂无错题</p>
          </div>
        ) : (
          /* Wrong Question List */
          <div ref={listRef} className="flex flex-col gap-4">
            {filteredQuestions.map((q, _idx) => (
              <div
                key={q.id}
                ref={el => {
                  if (el) cardRefs.current.set(q.id, el);
                }}
                className="wq-card group relative overflow-hidden rounded-radius-lg bg-space-800 p-6 transition-all duration-200 hover:bg-space-700"
                style={{
                  borderLeft: '4px solid #F87171',
                  border: '1px solid #1E2A3E',
                  borderLeftWidth: 4,
                  borderLeftColor: '#F87171',
                }}
              >
                {/* Card Header */}
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-body text-text-secondary">#{q.id}</span>
                  <span
                    className="rounded-radius-md px-3 py-1 text-sm font-medium"
                    style={{
                      backgroundColor: q.type === 'single' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(251, 146, 60, 0.15)',
                      color: q.type === 'single' ? '#60A5FA' : '#FB923C',
                    }}
                  >
                    {q.type === 'single' ? '单选题' : '判断题'}
                  </span>
                </div>

                {/* Question text */}
                <p className="text-body-lg text-text-primary mb-4" style={{ lineHeight: 1.6 }}>
                  {truncateText(q.question, 60)}
                </p>

                {/* Answer info */}
                <div className="mb-4 flex items-center gap-2 text-body">
                  <span style={{ color: '#4ADE80' }}>
                    正确答案：{q.type === 'single' ? q.answer : q.answer === true ? '✓' : '✗'}
                  </span>
                  <span className="text-text-muted">·</span>
                  <span style={{ color: '#F87171' }}>
                    你的答案：{getPreviousAnswer(q)}
                  </span>
                </div>

                {/* Action button */}
                <button
                  onClick={() => enterReanswerMode(q)}
                  className="flex items-center gap-2 rounded-radius-md border-2 border-accent-blue px-4 py-2 text-body text-accent-blue transition-all duration-200 hover:bg-accent-blue/10"
                  style={{ height: 44 }}
                >
                  <RotateCcw size={16} />
                  重新作答
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bottom stats */}
        {stats.total > 0 && (
          <div className="mt-8 pb-6 text-center">
            <p className="text-body text-text-secondary">
              共 {filteredQuestions.length} 道错题
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

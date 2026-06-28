import { useEffect, useRef, useMemo } from 'react';
import { FileText, ListOrdered, Shuffle, Clock, BookX, CheckCircle2, CircleDot, CheckSquare } from 'lucide-react';
import gsap from 'gsap';
import StarField from '@/components/StarField';
import ModeCard from '@/components/ModeCard';
import { useWrongQuestions, useAnswerHistory, useUserProgress, computeProgress } from '@/hooks/useLocalStorage';
import { useQuizData } from '@/hooks/useQuizData';

const TOTAL_SINGLE = 477;
const TOTAL_JUDGE = 363;
const TOTAL_QUESTIONS = 840;

export default function Home() {
  const [wrongQuestions] = useWrongQuestions();
  const [answerHistory] = useAnswerHistory();
  const [userProgress] = useUserProgress();
  const { questions: allQuestions } = useQuizData();
  const heroRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const wrongCount = wrongQuestions.length;
  const hasWrongQuestions = wrongCount > 0;

  // Compute fresh progress whenever component renders
  const progress = useMemo(() => {
    if (allQuestions.length > 0) {
      return computeProgress(answerHistory, allQuestions);
    }
    return userProgress;
  }, [answerHistory, allQuestions, userProgress]);

  useEffect(() => {
    // Breathing glow animation
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        opacity: 0.6,
        scale: 1.05,
        duration: 4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    }

    // Hero entrance animations
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    if (iconRef.current) {
      tl.fromTo(
        iconRef.current,
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, delay: 0.2, ease: 'back.out(1.7)' }
      );
    }
    if (titleRef.current) {
      tl.fromTo(
        titleRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5 },
        '-=0.3'
      );
    }
    if (subtitleRef.current) {
      tl.fromTo(
        subtitleRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5 },
        '-=0.3'
      );
    }

    // Progress panel entrance
    if (progressRef.current) {
      tl.fromTo(
        progressRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4 },
        '-=0.2'
      );
    }

    // Cards stagger entrance
    if (gridRef.current) {
      const cards = gridRef.current.children;
      tl.fromTo(
        cards,
        { y: 30, opacity: 0, scale: 0.95 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.4,
          stagger: 0.1,
          ease: 'power2.out',
        },
        '-=0.2'
      );
    }

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <StarField />

      {/* Breathing glow */}
      <div
        ref={glowRef}
        className="pointer-events-none fixed left-1/2 top-0 -translate-x-1/2"
        style={{
          width: 600,
          height: 400,
          background: 'radial-gradient(ellipse, rgba(212, 249, 53, 0.08) 0%, transparent 70%)',
          opacity: 0.3,
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div className="relative flex min-h-[100dvh] flex-col items-center" style={{ zIndex: 2 }}>
        {/* Hero section */}
        <div
          ref={heroRef}
          className="flex w-full flex-col items-center px-6"
          style={{ paddingTop: '10vh' }}
        >
          {/* Icon */}
          <div
            ref={iconRef}
            className="mb-6 flex items-center justify-center rounded-full border-2"
            style={{
              width: 96,
              height: 96,
              backgroundColor: '#141D2E',
              borderColor: '#1E2A3E',
            }}
          >
            <FileText size={48} color="#D4F935" />
          </div>

          {/* Main title */}
          <h1
            ref={titleRef}
            className="text-center text-title sm:text-display text-text-primary"
            style={{ letterSpacing: '0.02em', marginBottom: 16 }}
          >
            危化品考试刷题系统
          </h1>

          {/* Subtitle stats */}
          <p ref={subtitleRef} className="text-body-lg text-text-secondary text-center" style={{ marginBottom: 40 }}>
            共 <span className="text-lime-400 font-bold">{TOTAL_QUESTIONS}</span> 题 &middot; 单选题{' '}
            <span className="text-lime-400 font-bold">{TOTAL_SINGLE}</span> 道 &middot; 判断题{' '}
            <span className="text-lime-400 font-bold">{TOTAL_JUDGE}</span> 道
          </p>
        </div>

        {/* Progress Overview */}
        <div ref={progressRef} className="w-full max-w-[640px] px-6 mb-6">
          <div className="rounded-2xl bg-space-900 p-5" style={{ border: '1px solid #1E2A3E' }}>
            <h3 className="text-subtitle text-text-primary mb-4 font-bold">学习进度</h3>

            {/* Total progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-body text-text-secondary mb-2">
                <span>总进度</span>
                <span>
                  <span className="text-lime-400 font-bold">{progress.totalAnswered}</span>
                  <span className="text-text-muted"> / {TOTAL_QUESTIONS} 题</span>
                  {progress.totalAnswered > 0 && (
                    <span className="text-text-muted ml-2">
                      ({Math.round(progress.totalCorrect / progress.totalAnswered * 100)}% 正确率)
                    </span>
                  )}
                </span>
              </div>
              <div className="h-3 rounded-full bg-space-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-lime-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, (progress.totalAnswered / TOTAL_QUESTIONS) * 100)}%` }}
                />
              </div>
            </div>

            {/* Single choice progress */}
            <div className="mb-3">
              <div className="flex justify-between text-sm text-text-secondary mb-1">
                <span>单选题</span>
                <span className="text-text-muted">{progress.singleChoiceAnswered} / {TOTAL_SINGLE} 题</span>
              </div>
              <div className="h-2 rounded-full bg-space-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, (progress.singleChoiceAnswered / TOTAL_SINGLE) * 100)}%` }}
                />
              </div>
            </div>

            {/* True/False progress */}
            <div>
              <div className="flex justify-between text-sm text-text-secondary mb-1">
                <span>判断题</span>
                <span className="text-text-muted">{progress.trueFalseAnswered} / {TOTAL_JUDGE} 题</span>
              </div>
              <div className="h-2 rounded-full bg-space-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, (progress.trueFalseAnswered / TOTAL_JUDGE) * 100)}%` }}
                />
              </div>
            </div>

            {/* Correct/Wrong summary */}
            {progress.totalAnswered > 0 && (
              <div className="mt-4 flex gap-4 text-sm">
                <span className="text-success-400">✓ 正确 {progress.totalCorrect} 题</span>
                <span className="text-error-400">✗ 错误 {progress.totalWrong} 题</span>
                <span className="text-text-muted">
                  未做 {TOTAL_QUESTIONS - progress.totalAnswered} 题
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mode cards grid */}
        <div
          ref={gridRef}
          className="grid w-full max-w-[640px] gap-4 px-6 sm:grid-cols-2"
          style={{ paddingBottom: 40 }}
        >
          {/* Single choice practice */}
          <ModeCard
            icon={CircleDot}
            title="单选题练习"
            description={`共 ${TOTAL_SINGLE} 道单选题，逐题作答`}
            countLabel={`已做 ${progress.singleChoiceAnswered} 题 / ${TOTAL_SINGLE} 题`}
            iconColor="#60A5FA"
            to="/practice/single"
            badge={progress.singleChoiceAnswered > 0 ? `${Math.round(progress.singleChoiceAnswered / TOTAL_SINGLE * 100)}%` : undefined}
          />
          {/* True/False practice */}
          <ModeCard
            icon={CheckSquare}
            title="判断题练习"
            description={`共 ${TOTAL_JUDGE} 道判断题，逐题作答`}
            countLabel={`已做 ${progress.trueFalseAnswered} 题 / ${TOTAL_JUDGE} 题`}
            iconColor="#FB923C"
            to="/practice/judge"
            badge={progress.trueFalseAnswered > 0 ? `${Math.round(progress.trueFalseAnswered / TOTAL_JUDGE * 100)}%` : undefined}
          />
          {/* Mixed sequential practice */}
          <ModeCard
            icon={ListOrdered}
            title="顺序练习"
            description="按题号逐一作答，单选+判断混合"
            countLabel={`已做 ${progress.totalAnswered} 题 · 共 ${TOTAL_QUESTIONS} 题`}
            iconColor="#D4F935"
            to="/practice/sequential"
            badge={progress.totalAnswered > 0 ? `${Math.round(progress.totalAnswered / TOTAL_QUESTIONS * 100)}%` : undefined}
          />
          {/* Random practice */}
          <ModeCard
            icon={Shuffle}
            title="随机练习"
            description="打乱题库顺序，随机出题"
            countLabel={`共 ${TOTAL_QUESTIONS} 题`}
            iconColor="#A78BFA"
            to="/practice/random"
          />
          {/* Exam */}
          <ModeCard
            icon={Clock}
            title="模拟考试"
            description="随机抽取 100 题，限时 90 分钟"
            countLabel="100 题 · 90 分钟"
            iconColor="#F472B6"
            to="/exam"
          />
          {/* Wrong questions */}
          {hasWrongQuestions ? (
            <ModeCard
              icon={BookX}
              title="错题本"
              description="收录所有错题，针对性复习"
              countLabel={`${wrongCount} 道待复习`}
              iconColor="#F87171"
              to="/wrong-questions"
            />
          ) : (
            <ModeCard
              icon={CheckCircle2}
              title="错题本"
              description="太棒了！目前没有错题"
              countLabel="暂无错题"
              iconColor="#4ADE80"
              to="/wrong-questions"
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto pb-6 text-center">
          <p className="text-sm text-text-muted">
            危化品经营单位主要负责人考试刷题系统 v2.0
          </p>
        </div>
      </div>
    </div>
  );
}

import type { Question } from '@/types/quiz';

interface QuestionHeaderProps {
  question: Question;
  currentIndex: number;
  totalQuestions: number;
  isAnswered?: boolean;
  isCorrect?: boolean;
}

export default function QuestionHeader({
  question,
  currentIndex,
  totalQuestions,
  isAnswered,
  isCorrect,
}: QuestionHeaderProps) {
  const isSingle = question.type === 'single';

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="text-title text-lime-400">{currentIndex + 1}</span>
        <span className="text-body text-text-secondary">题</span>
        <span
          className="rounded-radius-md px-3 py-1 text-sm font-medium"
          style={{
            backgroundColor: isSingle ? 'rgba(96, 165, 250, 0.15)' : 'rgba(251, 146, 60, 0.15)',
            color: isSingle ? '#60A5FA' : '#FB923C',
          }}
        >
          {isSingle ? '单选题' : '判断题'}
        </span>
        {isAnswered && (
          <span
            className={`inline-flex h-2 w-2 rounded-full ${isCorrect ? 'bg-success-400' : 'bg-error-400'}`}
          />
        )}
      </div>
      <span className="text-body text-text-secondary">
        第 {currentIndex + 1} / {totalQuestions} 题
      </span>
    </div>
  );
}

interface ActionBarProps {
  mode: 'practice' | 'exam';
  onNext?: () => void;
  onPrev?: () => void;
  onSubmit?: () => void;
  onShowAnswerSheet?: () => void;
  hasAnswered?: boolean;
  isFirstQuestion?: boolean;
  isLastQuestion?: boolean;
}

export default function ActionBar({
  mode,
  onNext,
  onPrev,
  onSubmit,
  onShowAnswerSheet,
  hasAnswered = false,
  isFirstQuestion = false,
  isLastQuestion = false,
}: ActionBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 px-6 py-4"
      style={{
        backgroundColor: 'rgba(3, 6, 21, 0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {mode === 'exam' && (
        <>
          <button
            onClick={onPrev}
            disabled={isFirstQuestion}
            className="rounded-radius-lg border-2 border-space-600 px-4 py-3 text-body-lg text-text-secondary transition-all duration-200 hover:border-accent-blue hover:text-accent-blue disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ minHeight: 56 }}
          >
            上一题
          </button>
          <button
            onClick={onShowAnswerSheet}
            className="rounded-radius-lg border-2 border-space-600 px-4 py-3 text-body-lg text-text-secondary transition-all duration-200 hover:border-accent-blue hover:text-accent-blue"
            style={{ minHeight: 56 }}
          >
            答题卡
          </button>
        </>
      )}

      {mode === 'exam' && isLastQuestion ? (
        <button
          onClick={onSubmit}
          className="flex-1 rounded-radius-lg py-3 text-body-lg font-bold text-text-inverse transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          style={{
            minHeight: 56,
            backgroundColor: '#F97316',
          }}
        >
          交卷
        </button>
      ) : (
        <button
          onClick={mode === 'practice' ? (hasAnswered ? onNext : () => {}) : onNext}
          className="flex-1 rounded-radius-lg py-3 text-body-lg font-bold text-text-inverse transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            minHeight: 56,
            backgroundColor: hasAnswered || mode === 'exam' ? '#D4F935' : '#2E3F5C',
            color: hasAnswered || mode === 'exam' ? '#030615' : '#64748B',
          }}
          disabled={mode === 'practice' && !hasAnswered}
        >
          {mode === 'practice' ? (hasAnswered ? '下一题' : '请选择答案') : '下一题'}
        </button>
      )}
    </div>
  );
}

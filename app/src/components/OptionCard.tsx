import { useRef, useEffect } from 'react';
import gsap from 'gsap';

type OptionState = 'default' | 'selected' | 'correct' | 'wrong';

interface OptionCardProps {
  label: string;
  text: string;
  state?: OptionState;
  onClick?: () => void;
  disabled?: boolean;
  index?: number;
}

export default function OptionCard({
  label,
  text,
  state = 'default',
  onClick,
  disabled = false,
  index = 0,
}: OptionCardProps) {
  const cardRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, scale: 0.95 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.3,
          delay: index * 0.08,
          ease: 'back.out(1.7)',
        }
      );
    }
  }, [index]);

  const getStyles = (): React.CSSProperties => {
    switch (state) {
      case 'correct':
        return {
          backgroundColor: 'rgba(74, 222, 128, 0.1)',
          borderColor: '#4ADE80',
          color: '#4ADE80',
        };
      case 'wrong':
        return {
          backgroundColor: 'rgba(248, 113, 113, 0.1)',
          borderColor: '#F87171',
          color: '#F87171',
        };
      case 'selected':
        return {
          backgroundColor: 'rgba(96, 165, 250, 0.1)',
          borderColor: '#60A5FA',
          color: '#60A5FA',
        };
      default:
        return {
          backgroundColor: '#141D2E',
          borderColor: '#1E2A3E',
          color: '#F8FAFC',
        };
    }
  };

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-4 rounded-radius-xl border-2 px-6 py-5 text-left transition-all duration-200 hover:border-accent-blue hover:bg-space-700 disabled:cursor-not-allowed"
      style={{
        minHeight: 72,
        ...getStyles(),
      }}
    >
      <span
        className="flex items-center justify-center rounded-full text-sm font-bold"
        style={{
          width: 36,
          height: 36,
          minWidth: 36,
          backgroundColor: state === 'default' ? '#1E2A3E' : 'transparent',
          border: state === 'default' ? '2px solid #2E3F5C' : 'none',
          color: state === 'default' ? '#94A3B8' : 'inherit',
        }}
      >
        {label}
      </span>
      <span className="text-body-lg" style={{ color: 'inherit' }}>
        {text}
      </span>
    </button>
  );
}

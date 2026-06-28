import { Volume2, VolumeX } from 'lucide-react';
import { useSpeech } from '@/hooks/useSpeech';
import type { Question } from '@/types/quiz';

interface SpeakButtonProps {
  question: Question;
  className?: string;
}

export default function SpeakButton({ question, className = '' }: SpeakButtonProps) {
  const { speaking, supported, speak, stop } = useSpeech();

  if (!supported) return null;

  // Build speech text
  const buildSpeechText = () => {
    let text = question.question;
    if (question.type === 'truefalse') {
      text += '，选项：A 正确，B 错误';
    } else if (question.options) {
      const opts = Object.entries(question.options)
        .map(([k, v]) => `${k} ${v}`)
        .join('，');
      text += '，选项：' + opts;
    }
    return text;
  };

  const handleClick = () => {
    if (speaking) {
      stop();
    } else {
      speak(buildSpeechText(), 'female');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ${className}`}
      style={{
        backgroundColor: speaking ? 'rgba(212, 249, 53, 0.15)' : 'rgba(96, 165, 250, 0.1)',
        border: `1px solid ${speaking ? '#D4F935' : 'rgba(96, 165, 250, 0.3)'}`,
        color: speaking ? '#D4F935' : '#60A5FA',
      }}
      title={speaking ? '停止朗读' : '朗读题目'}
    >
      {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
      <span>{speaking ? '停止' : '朗读'}</span>
    </button>
  );
}

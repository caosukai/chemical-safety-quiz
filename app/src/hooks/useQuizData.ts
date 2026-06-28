import { useState, useEffect } from 'react';
import type { Question } from '@/types/quiz';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface QuizJson {
  single_choice: Array<{
    id: number;
    type: string;
    question: string;
    options: Record<string, string>;
    answer: string;
  }>;
  true_false: Array<{
    id: number;
    type: string;
    question: string;
    answer: string;
  }>;
}

interface UseQuizDataReturn {
  questions: Question[];
  loading: boolean;
  error: string | null;
  shuffle: () => void;
  sequential: () => void;
  getRandomSubset: (count: number) => Question[];
}

export function useQuizData(): UseQuizDataReturn {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/questions.json')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load questions: ${res.status}`);
        return res.json();
      })
      .then((data: QuizJson) => {
        if (!cancelled) {
          // Merge single_choice and true_false into one array
          const merged: Question[] = [
            ...data.single_choice.map(q => ({
              id: q.id,
              type: 'single' as const,
              question: q.question,
              options: q.options,
              answer: q.answer,
            })),
            ...data.true_false.map(q => ({
              id: q.id + 500,
              type: 'truefalse' as const,
              question: q.question,
              // answer is already boolean in JSON (true/false), pass through directly
              answer: typeof q.answer === 'boolean' ? q.answer : q.answer === '正确',
            })),
          ];
          setQuestions(merged);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const shuffle = () => {
    setQuestions(prev => shuffleArray(prev));
  };

  const sequential = () => {
    setQuestions(prev => [...prev].sort((a, b) => a.id - b.id));
  };

  const getRandomSubset = (count: number): Question[] => {
    const shuffled = shuffleArray(questions);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  };

  return { questions, loading, error, shuffle, sequential, getRandomSubset };
}

import { useState, useCallback, useRef } from 'react';
import type { Question } from '@/types/quiz';

export interface AIAnalysisResult {
  lawName: string;
  lawText: string;
  explain: string;
  correctAnswer: string;
  wrongAnalysis: string;
  optionAnalysis: Record<string, string>;
  source: string;
}

// Cache for pre-generated explanations
let explanationsCache: Record<string, AIAnalysisResult> | null = null;
let explanationsPromise: Promise<Record<string, AIAnalysisResult>> | null = null;

async function loadExplanations(): Promise<Record<string, AIAnalysisResult>> {
  if (explanationsCache) return explanationsCache;
  if (explanationsPromise) return explanationsPromise;

  explanationsPromise = fetch('/explanations.json')
    .then(res => {
      if (!res.ok) throw new Error('Failed to load explanations');
      return res.json();
    })
    .then(data => {
      explanationsCache = data;
      return data;
    });

  return explanationsPromise;
}

export function useAIAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async (question: Question, _selectedLabel: string, _isCorrect: boolean) => {
    setLoading(true);
    setError(null);
    setResult(null);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const explanations = await loadExplanations();
      const key = `${question.type}-${question.id}`;
      const explanation = explanations[key];

      if (!explanation) {
        throw new Error('暂无该题目的解析数据');
      }

      setResult(explanation);
      setLoading(false);
      return explanation;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载解析失败';
      setError(msg);
      setLoading(false);
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
    abortRef.current?.abort();
  }, []);

  return { analyze, clear, loading, error, result };
}

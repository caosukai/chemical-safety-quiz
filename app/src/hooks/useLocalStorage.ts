import { useState, useEffect, useCallback } from 'react';
import type { ExamRecord, AppSettings, AnswerRecord, UserProgress, Question, SyncData } from '@/types/quiz';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      setStoredValue(prev => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
        return valueToStore;
      });
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T);
        } catch {
          // ignore parse errors
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key]);

  return [storedValue, setValue];
}

const STORAGE_KEYS = {
  ANSWERS: 'hzp_answers',
  WRONG_QUESTIONS: 'hzp_wrong_questions',
  EXAM_HISTORY: 'hzp_exam_history',
  SEQUENTIAL_PROGRESS: 'hzp_sequential_progress',
  SETTINGS: 'hzp_settings',
  ANSWER_HISTORY: 'hzp_answer_history',
  USER_PROGRESS: 'hzp_user_progress',
  SYNC_CODE: 'hzp_sync_code',
} as const;

export function useWrongQuestions(): [number[], (questions: number[] | ((prev: number[]) => number[])) => void] {
  return useLocalStorage<number[]>(STORAGE_KEYS.WRONG_QUESTIONS, []);
}

export function useExamHistory(): [ExamRecord[], (records: ExamRecord[] | ((prev: ExamRecord[]) => ExamRecord[])) => void] {
  return useLocalStorage<ExamRecord[]>(STORAGE_KEYS.EXAM_HISTORY, []);
}

export function useSequentialProgress(): [{ currentIndex: number; totalAnswered: number }, (progress: { currentIndex: number; totalAnswered: number } | ((prev: { currentIndex: number; totalAnswered: number }) => { currentIndex: number; totalAnswered: number })) => void] {
  return useLocalStorage<{ currentIndex: number; totalAnswered: number }>(STORAGE_KEYS.SEQUENTIAL_PROGRESS, { currentIndex: 0, totalAnswered: 0 });
}

export function useSettings(): [AppSettings, (settings: AppSettings | ((prev: AppSettings) => AppSettings)) => void] {
  return useLocalStorage<AppSettings>(STORAGE_KEYS.SETTINGS, { fontSize: 'normal' });
}

export function useAnswerHistory(): [AnswerRecord[], (records: AnswerRecord[] | ((prev: AnswerRecord[]) => AnswerRecord[])) => void] {
  return useLocalStorage<AnswerRecord[]>(STORAGE_KEYS.ANSWER_HISTORY, []);
}

export function useUserProgress(): [UserProgress, (progress: UserProgress | ((prev: UserProgress) => UserProgress)) => void] {
  return useLocalStorage<UserProgress>(STORAGE_KEYS.USER_PROGRESS, {
    totalAnswered: 0, totalCorrect: 0, totalWrong: 0,
    singleChoiceAnswered: 0, singleChoiceCorrect: 0,
    trueFalseAnswered: 0, trueFalseCorrect: 0,
    examCount: 0, lastStudyDate: '',
  });
}

export function useSyncCode(): [string, (code: string | ((prev: string) => string)) => void] {
  return useLocalStorage<string>(STORAGE_KEYS.SYNC_CODE, '');
}

export function computeProgress(answerHistory: AnswerRecord[], questions: Question[]): UserProgress {
  // Group by questionId, keep the latest answer for each question
  const latestAnswers = new Map<number, AnswerRecord>();
  for (const record of answerHistory) {
    const existing = latestAnswers.get(record.questionId);
    if (!existing || record.timestamp > existing.timestamp) {
      latestAnswers.set(record.questionId, record);
    }
  }

  let totalCorrect = 0, totalWrong = 0;
  let scAnswered = 0, scCorrect = 0;
  let tfAnswered = 0, tfCorrect = 0;

  for (const [, record] of latestAnswers) {
    const q = questions.find(q => q.id === record.questionId);
    if (!q) continue;

    if (record.isCorrect) totalCorrect++;
    else totalWrong++;

    if (q.type === 'single') {
      scAnswered++;
      if (record.isCorrect) scCorrect++;
    } else {
      tfAnswered++;
      if (record.isCorrect) tfCorrect++;
    }
  }

  return {
    totalAnswered: latestAnswers.size,
    totalCorrect,
    totalWrong,
    singleChoiceAnswered: scAnswered,
    singleChoiceCorrect: scCorrect,
    trueFalseAnswered: tfAnswered,
    trueFalseCorrect: tfCorrect,
    examCount: 0,
    lastStudyDate: new Date().toISOString().split('T')[0],
  };
}

export function exportAllData(syncCode: string): SyncData {
  const getItem = (key: string) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  };
  return {
    syncCode,
    answerHistory: getItem(STORAGE_KEYS.ANSWER_HISTORY) || [],
    wrongQuestions: getItem(STORAGE_KEYS.WRONG_QUESTIONS) || [],
    examHistory: getItem(STORAGE_KEYS.EXAM_HISTORY) || [],
    sequentialProgress: getItem(STORAGE_KEYS.SEQUENTIAL_PROGRESS) || { currentIndex: 0, totalAnswered: 0 },
    userProgress: getItem(STORAGE_KEYS.USER_PROGRESS) || computeProgress(getItem(STORAGE_KEYS.ANSWER_HISTORY) || [], []),
    exportedAt: new Date().toISOString(),
  };
}

export function importAllData(data: SyncData): { merged: number; conflicts: number } {
  // Merge answer history (keep latest by timestamp)
  const existingHistory: AnswerRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.ANSWER_HISTORY) || '[]');
  const mergedHistory = [...existingHistory];
  let merged = 0, conflicts = 0;

  for (const incoming of data.answerHistory) {
    const idx = mergedHistory.findIndex(r => r.questionId === incoming.questionId);
    if (idx === -1) {
      mergedHistory.push(incoming);
      merged++;
    } else if (incoming.timestamp > mergedHistory[idx].timestamp) {
      mergedHistory[idx] = incoming;
      conflicts++;
      merged++;
    }
  }

  localStorage.setItem(STORAGE_KEYS.ANSWER_HISTORY, JSON.stringify(mergedHistory));

  // Merge wrong questions (union)
  const existingWrong: number[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.WRONG_QUESTIONS) || '[]');
  const mergedWrong = [...new Set([...existingWrong, ...data.wrongQuestions])];
  localStorage.setItem(STORAGE_KEYS.WRONG_QUESTIONS, JSON.stringify(mergedWrong));

  // Merge exam history
  const existingExams: ExamRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAM_HISTORY) || '[]');
  const mergedExams = [...existingExams];
  for (const incoming of data.examHistory) {
    if (!mergedExams.some(e => e.id === incoming.id)) {
      mergedExams.push(incoming);
      merged++;
    }
  }
  localStorage.setItem(STORAGE_KEYS.EXAM_HISTORY, JSON.stringify(mergedExams));

  return { merged, conflicts };
}

export { STORAGE_KEYS };

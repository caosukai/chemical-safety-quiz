export interface Question {
  id: number;
  type: 'single' | 'truefalse';
  question: string;
  options?: Record<string, string>;
  answer: string | boolean;
}

export interface QuizState {
  currentIndex: number;
  answers: Record<number, {
    selected: string | boolean;
    isCorrect: boolean;
  }>;
  wrongQuestions: number[];
}

export interface ExamRecord {
  id: string;
  date: number;
  score: number;
  totalQuestions: number;
  correctCount: number;
  timeUsed: number;
  questions: number[];
}

export interface AnswerRecord {
  questionId: number;
  selected: string | boolean;
  isCorrect: boolean;
  timestamp: number;
}

export interface UserProgress {
  totalAnswered: number;
  totalCorrect: number;
  totalWrong: number;
  singleChoiceAnswered: number;
  singleChoiceCorrect: number;
  trueFalseAnswered: number;
  trueFalseCorrect: number;
  examCount: number;
  lastStudyDate: string;
}

export interface SyncData {
  syncCode: string;
  answerHistory: AnswerRecord[];
  wrongQuestions: number[];
  examHistory: ExamRecord[];
  sequentialProgress: { currentIndex: number; totalAnswered: number };
  userProgress: UserProgress;
  exportedAt: string;
}

export type FontSize = 'normal' | 'large' | 'extra-large';

export interface AppSettings {
  fontSize: FontSize;
}

export interface StorageSchema {
  answers: Record<number, {
    selectedOption: string;
    isCorrect: boolean;
    timestamp: number;
    examMode?: boolean;
  }>;
  wrongQuestions: number[];
  examHistory: ExamRecord[];
  sequentialProgress: {
    currentIndex: number;
    totalAnswered: number;
  };
  settings: AppSettings;
}

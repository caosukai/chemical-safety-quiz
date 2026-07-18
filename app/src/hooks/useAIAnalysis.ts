import { useState, useCallback, useRef } from 'react';
import type { Question } from '@/types/quiz';
import type { AIProvider } from '@/types/quiz';
import { STORAGE_KEYS } from '@/hooks/useLocalStorage';

export interface AIAnalysisResult {
  lawName: string;
  lawText: string;
  explain: string;
  correctAnswer: string;
  wrongAnalysis: string;
  optionAnalysis: Record<string, string>;
  source: string;
}

interface AIProviderConfig {
  name: string;
  baseUrl: string;
  model: string;
}

export const AI_PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  kimi: {
    name: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-flash',
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  tongyi: {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-turbo',
  },
};

function readSettings(): { aiProvider?: AIProvider; aiApiKey?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Cache for pre-generated explanations
let explanationsCache: Record<string, AIAnalysisResult> | null = null;
let explanationsPromise: Promise<Record<string, AIAnalysisResult>> | null = null;

async function loadExplanations(): Promise<Record<string, AIAnalysisResult>> {
  if (explanationsCache) return explanationsCache;
  if (explanationsPromise) return explanationsPromise;

  explanationsPromise = fetch('explanations.json')
    .then(res => {
      if (!res.ok) throw new Error('Failed to load explanations');
      return res.json();
    })
    .then(data => {
      explanationsCache = data;
      return data;
    })
    .catch(err => {
      console.warn('加载本地解析失败:', err);
      return {};
    });

  return explanationsPromise;
}

function buildPrompt(q: Question, selectedLabel: string, isCorrect: boolean): string {
  const questionType = q.type === 'single' ? '单选题' : '判断题';
  const optionsText = q.options
    ? Object.entries(q.options).map(([k, v]) => `${k}: ${v}`).join('\n')
    : 'A: 正确\nB: 错误';
  const correctLabel = q.type === 'truefalse'
    ? (q.answer === true ? 'A（正确）' : 'B（错误）')
    : `${q.answer}（${q.options?.[String(q.answer)] || ''}）`;

  return `你是中国危险化学品安全管理法规专家。请根据以下题目，检索相关法规条文，给出精确解析。

【题目类型】${questionType}
【题目】${q.question}
【选项】
${optionsText}
【正确答案】${correctLabel}
【用户选择】${selectedLabel}
【用户答对/答错】${isCorrect ? '答对' : '答错'}

要求：
1. 找到与题目相关的具体法规名称和条文（如《安全生产法》第X条）
2. 引用法规原文
3. 解释为什么正确答案是正确的，为什么错误选项是错误的
4. 如果用户答错，详细分析错误原因
5. 用中文回答，格式如下：

法规名称：《XXX》第X条
法规原文：（原文引用）
考点解读：（为什么对/为什么错）
错误分析：（用户选错时说明原因）
选项分析：（每个选项为什么对或为什么错）`;
}

function parseAIResponse(response: string): AIAnalysisResult {
  const lawNameMatch = response.match(/法规名称[：:]\s*(.+)/);
  const lawTextMatch = response.match(/法规原文[：:]\s*([\s\S]+?)(?:考点解读|错误分析|选项分析|$)/);
  const explainMatch = response.match(/考点解读[：:]\s*([\s\S]+?)(?:错误分析|选项分析|$)/);
  const wrongMatch = response.match(/错误分析[：:]\s*([\s\S]+?)(?:选项分析|$)/);

  return {
    lawName: lawNameMatch ? lawNameMatch[1].trim() : '',
    lawText: lawTextMatch ? lawTextMatch[1].trim().slice(0, 500) : '',
    explain: explainMatch ? explainMatch[1].trim().slice(0, 500) : '',
    correctAnswer: '',
    wrongAnalysis: wrongMatch ? wrongMatch[1].trim().slice(0, 300) : '',
    optionAnalysis: {},
    source: lawNameMatch ? lawNameMatch[1].trim() : '',
  };
}

async function fetchLiveAnalysis(
  question: Question,
  selectedLabel: string,
  isCorrect: boolean,
  apiKey: string,
  providerKey: AIProvider
): Promise<AIAnalysisResult> {
  const provider = AI_PROVIDERS[providerKey] || AI_PROVIDERS.deepseek;

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        {
          role: 'system',
          content: '你是中国危险化学品安全管理法规专家。你的任务是根据题目精确检索相关法规条文，给出有依据的解析。不要泛泛而谈，必须引用具体法规名称和条文原文。',
        },
        {
          role: 'user',
          content: buildPrompt(question, selectedLabel, isCorrect),
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || `HTTP ${response.status}`;
    if (errMsg.includes('balance') || errMsg.includes('quota') || errMsg.includes('suspended') || errMsg.includes('Insufficient Balance')) {
      throw new Error(`${provider.name} 余额不足，请充值或切换其他平台`);
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  const parsed = parseAIResponse(content);
  if (!parsed.lawName) {
    parsed.explain = content;
    parsed.lawName = `${provider.name} 联网检索`;
  }
  return parsed;
}

export function useAIAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async (question: Question, selectedLabel: string, isCorrect: boolean) => {
    setLoading(true);
    setError(null);
    setResult(null);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const settings = readSettings();
      const hasUserKey = !!settings.aiApiKey?.trim();

      // If user provided an API key, use live AI
      if (hasUserKey) {
        const provider = settings.aiProvider || 'deepseek';
        const liveResult = await fetchLiveAnalysis(
          question,
          selectedLabel,
          isCorrect,
          settings.aiApiKey!.trim(),
          provider
        );
        setResult(liveResult);
        setLoading(false);
        return liveResult;
      }

      // Otherwise fall back to bundled explanations
      const explanations = await loadExplanations();
      const key = `${question.type}-${question.id}`;
      const explanation = explanations[key];

      if (!explanation) {
        throw new Error('暂无该题目的解析数据，可在设置中填写 API Key 使用在线 AI 解析');
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

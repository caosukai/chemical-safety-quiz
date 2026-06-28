import { useState, useCallback } from 'react';
import type { Question } from '@/types/quiz';

// Hardcoded API key - embedded in source for convenience
const DEFAULT_API_KEY = 'sk-2c08af56afc6473da923ae8f1dc521d1';
const DEFAULT_PROVIDER = 1; // 0=Kimi, 1=DeepSeek, 2=OpenAI, 3=Tongyi

export interface AIProvider {
  name: string;
  baseUrl: string;
  model: string;
  keyPrefix: string;
  desc: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    name: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    keyPrefix: 'sk-',
    desc: '月之暗面出品，中文理解能力强',
  },
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyPrefix: 'sk-',
    desc: '价格更低，新用户有5000万Token免费额度',
  },
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyPrefix: 'sk-',
    desc: '国外服务，需要代理',
  },
  {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-turbo',
    keyPrefix: 'sk-',
    desc: '阿里云出品，新用户有免费额度',
  },
];

export interface AIAnalysisResult {
  lawName: string;
  lawText: string;
  explain: string;
  correctAnswer: string;
  wrongAnalysis: string;
  optionAnalysis: Record<string, string>;
  source: string;
}

function buildPrompt(q: Question, selectedLabel: string, isCorrect: boolean): string {
  const questionText = q.question;
  const questionType = q.type === 'single' ? '单选题' : '判断题';
  const optionsText = q.options
    ? Object.entries(q.options).map(([k, v]) => `${k}: ${v}`).join('\n')
    : 'A: 正确\nB: 错误';
  const correctLabel = q.type === 'truefalse'
    ? (q.answer === true ? 'A（正确）' : 'B（错误）')
    : `${q.answer}（${q.options?.[String(q.answer)] || ''}）`;

  return `你是中国危险化学品安全管理法规专家。请根据以下题目，检索相关法规条文，给出精确解析。

【题目类型】${questionType}
【题目】${questionText}
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

// Detect which provider the key belongs to
export function detectProvider(apiKey: string): AIProvider | null {
  if (!apiKey) return null;
  // DeepSeek keys often start with specific patterns
  if (apiKey.includes('deepseek') || apiKey.startsWith('sk-d')) {
    return AI_PROVIDERS[1]; // DeepSeek
  }
  // Default to Kimi for sk- prefix
  if (apiKey.startsWith('sk-')) {
    return AI_PROVIDERS[0]; // Kimi
  }
  return AI_PROVIDERS[0]; // Default
}

export function useAIAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);

  const analyze = useCallback(async (question: Question, selectedLabel: string, isCorrect: boolean) => {
    // Use user-defined key if available, otherwise fall back to hardcoded default
    const userKey = localStorage.getItem('hzp_ai_api_key');
    const apiKey = userKey || DEFAULT_API_KEY;
    const userProvider = localStorage.getItem('hzp_ai_provider');
    const providerIndex = userProvider ? parseInt(userProvider, 10) : DEFAULT_PROVIDER;
    const provider = AI_PROVIDERS[providerIndex] || AI_PROVIDERS[DEFAULT_PROVIDER];

    if (!apiKey) {
      setError('请先设置 AI API Key（支持 Kimi、DeepSeek、通义千问等）');
      return null;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
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
        if (errMsg.includes('balance') || errMsg.includes('quota') || errMsg.includes('suspended')) {
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

      setResult(parsed);
      setLoading(false);
      return parsed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '请求失败';
      setError(msg);
      setLoading(false);
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return { analyze, clear, loading, error, result };
}

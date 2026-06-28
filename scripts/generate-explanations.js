const fs = require('fs');
const path = require('path');

const QUESTIONS_PATH = path.join(__dirname, '..', 'questions.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'app', 'public', 'explanations.json');
const PROGRESS_PATH = path.join(__dirname, '..', 'scripts', '.explanations-progress.json');

const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

if (!API_KEY) {
  console.error('请设置环境变量 DEEPSEEK_API_KEY');
  process.exit(1);
}

function loadQuestions() {
  const data = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));
  const questions = [];
  for (const q of data.single_choice || []) {
    questions.push(q);
  }
  for (const q of data.true_false || []) {
    questions.push(q);
  }
  return questions;
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_PATH)) {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
  }
  return {};
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

function saveOutput(output) {
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
}

function buildPrompt(q) {
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

要求：
1. 找到与题目相关的具体法规名称和条文（如《安全生产法》第X条）
2. 引用法规原文
3. 解释为什么正确答案是正确的，为什么错误选项是错误的
4. 用中文回答，格式必须如下：

法规名称：《XXX》第X条
法规原文：（原文引用）
考点解读：（为什么对/为什么错）
选项分析：（每个选项为什么对或为什么错）`;
}

function parseResponse(text) {
  const lawNameMatch = text.match(/法规名称[：:]\s*(.+)/);
  const lawTextMatch = text.match(/法规原文[：:]\s*([\s\S]+?)(?:考点解读|错误分析|选项分析|$)/);
  const explainMatch = text.match(/考点解读[：:]\s*([\s\S]+?)(?:错误分析|选项分析|$)/);
  const wrongMatch = text.match(/错误分析[：:]\s*([\s\S]+?)(?:选项分析|$)/);
  const optionAnalysisMatch = text.match(/选项分析[：:]\s*([\s\S]+)$/);

  const optionAnalysis = {};
  if (optionAnalysisMatch) {
    const lines = optionAnalysisMatch[1].split('\n').filter(l => l.trim());
    for (const line of lines) {
      const match = line.match(/^([A-D])[.．、:：\s]+(.+)$/);
      if (match) {
        optionAnalysis[match[1]] = match[2].trim();
      }
    }
  }

  return {
    lawName: lawNameMatch ? lawNameMatch[1].trim() : '',
    lawText: lawTextMatch ? lawTextMatch[1].trim().slice(0, 500) : '',
    explain: explainMatch ? explainMatch[1].trim().slice(0, 500) : '',
    wrongAnalysis: wrongMatch ? wrongMatch[1].trim().slice(0, 300) : '',
    optionAnalysis,
    source: lawNameMatch ? lawNameMatch[1].trim() : '',
    raw: text,
  };
}

async function callDeepSeek(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content: '你是中国危险化学品安全管理法规专家。你的任务是根据题目精确检索相关法规条文，给出有依据的解析。不要泛泛而谈，必须引用具体法规名称和条文原文。',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`HTTP ${response.status}: ${err}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      console.error(`API call failed (attempt ${i + 1}/${retries}):`, err.message);
      if (i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const questions = loadQuestions();
  const progress = loadProgress();
  const output = progress.output || {};
  const completed = new Set(progress.completed || []);

  console.log(`总共 ${questions.length} 道题，已完成 ${completed.size} 道`);

  let count = 0;
  for (const q of questions) {
    const key = `${q.type}-${q.id}`;
    if (completed.has(key)) {
      continue;
    }

    try {
      const prompt = buildPrompt(q);
      const text = await callDeepSeek(prompt);
      const parsed = parseResponse(text);
      output[key] = parsed;
      completed.add(key);

      count++;
      if (count % 10 === 0) {
        progress.output = output;
        progress.completed = Array.from(completed);
        saveProgress(progress);
        saveOutput(output);
        console.log(`已完成 ${completed.size}/${questions.length} 道`);
      }

      // Rate limiting: wait a bit between requests
      await sleep(500);
    } catch (err) {
      console.error(`题目 ${key} 生成失败:`, err.message);
      progress.output = output;
      progress.completed = Array.from(completed);
      saveProgress(progress);
      saveOutput(output);
      console.log(`已保存进度，完成 ${completed.size}/${questions.length} 道`);
      process.exit(1);
    }
  }

  progress.output = output;
  progress.completed = Array.from(completed);
  saveProgress(progress);
  saveOutput(output);
  console.log(`全部完成！共 ${Object.keys(output).length} 道题`);
}

main();

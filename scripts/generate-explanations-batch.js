const fs = require('fs');
const path = require('path');

const QUESTIONS_PATH = path.join(__dirname, '..', 'questions.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'app', 'public', 'explanations.json');
const PROGRESS_PATH = path.join(__dirname, '..', 'scripts', '.explanations-progress.json');

const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';
const BATCH_SIZE = 5;

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

function buildBatchPrompt(questions) {
  const items = questions.map((q, idx) => {
    const questionType = q.type === 'single' ? '单选题' : '判断题';
    const optionsText = q.options
      ? Object.entries(q.options).map(([k, v]) => `${k}: ${v}`).join('\n')
      : 'A: 正确\nB: 错误';
    const correctLabel = q.type === 'truefalse'
      ? (q.answer === true ? 'A（正确）' : 'B（错误）')
      : `${q.answer}（${q.options?.[String(q.answer)] || ''}）`;

    return `[题目${idx + 1}]
题目类型：${questionType}
题目：${q.question}
选项：
${optionsText}
正确答案：${correctLabel}`;
  }).join('\n\n');

  return `你是中国危险化学品安全管理法规专家。请为以下 ${questions.length} 道题目分别给出精确解析，并以严格JSON格式返回。

${items}

要求：
1. 为每道题找到相关法规名称和条文
2. 引用法规原文
3. 解释正确答案为什么对，错误选项为什么错
4. 返回格式必须是以下JSON数组，不要包含任何其他文字：

[
  {
    "lawName": "《XXX》第X条",
    "lawText": "法规原文...",
    "explain": "考点解读...",
    "wrongAnalysis": "错误分析...",
    "optionAnalysis": {"A": "...", "B": "...", "C": "...", "D": "..."}
  },
  ...
]`;
}

function parseJsonResponse(text) {
  // Try to extract JSON from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  return JSON.parse(jsonText);
}

function normalizeExplanation(raw, q) {
  const optionAnalysis = {};
  if (raw.optionAnalysis && typeof raw.optionAnalysis === 'object') {
    for (const [k, v] of Object.entries(raw.optionAnalysis)) {
      if (['A', 'B', 'C', 'D'].includes(k)) {
        optionAnalysis[k] = String(v).trim();
      }
    }
  }

  // For true/false, map to A/B if not present
  if (q.type === 'truefalse' && Object.keys(optionAnalysis).length === 0) {
    if (raw.explain) {
      optionAnalysis.A = q.answer === true ? '正确' : '错误';
      optionAnalysis.B = q.answer === false ? '正确' : '错误';
    }
  }

  return {
    lawName: String(raw.lawName || '').trim().slice(0, 200),
    lawText: String(raw.lawText || '').trim().slice(0, 500),
    explain: String(raw.explain || raw.考点解读 || '').trim().slice(0, 800),
    wrongAnalysis: String(raw.wrongAnalysis || raw.错误分析 || '').trim().slice(0, 400),
    optionAnalysis,
    source: String(raw.lawName || '').trim().slice(0, 200),
  };
}

async function callDeepSeekBatch(questions, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const prompt = buildBatchPrompt(questions);
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
              content: '你是中国危险化学品安全管理法规专家。你的任务是根据题目精确检索相关法规条文，给出有依据的解析。必须严格按要求的JSON格式返回，不要输出任何其他文字。',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`HTTP ${response.status}: ${err}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const parsed = parseJsonResponse(content);
      
      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      return parsed;
    } catch (err) {
      console.error(`Batch API call failed (attempt ${i + 1}/${retries}):`, err.message);
      if (i < retries - 1) {
        const delay = Math.pow(2, i) * 2000;
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

  // Filter remaining questions
  const remaining = questions.filter(q => !completed.has(`${q.type}-${q.id}`));
  
  // Process in batches
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    
    try {
      const results = await callDeepSeekBatch(batch);
      
      for (let j = 0; j < batch.length; j++) {
        const q = batch[j];
        const key = `${q.type}-${q.id}`;
        const raw = results[j] || {};
        output[key] = normalizeExplanation(raw, q);
        completed.add(key);
      }

      console.log(`已完成 ${completed.size}/${questions.length} 道`);

      // Save every 2 batches
      if (Math.floor(i / BATCH_SIZE) % 2 === 1) {
        progress.output = output;
        progress.completed = Array.from(completed);
        saveProgress(progress);
        saveOutput(output);
      }

      await sleep(300);
    } catch (err) {
      console.error(`批次 ${i / BATCH_SIZE + 1} 失败:`, err.message);
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

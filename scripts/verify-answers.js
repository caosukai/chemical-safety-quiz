const fs = require('fs');
const path = require('path');

const QUESTIONS_PATH = path.join(__dirname, '..', 'questions.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'questions-verified.json');
const REPORT_PATH = path.join(__dirname, '..', 'answer-discrepancies.json');
const PROGRESS_PATH = path.join(__dirname, '..', 'scripts', '.verify-progress.json');

const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat'; // will fallback to flash if needed
const BATCH_SIZE = 5;

if (!API_KEY) {
  console.error('请设置环境变量 DEEPSEEK_API_KEY');
  process.exit(1);
}

function loadQuestions() {
  const data = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));
  return data;
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

function buildBatchPrompt(questions) {
  const items = questions.map((q, idx) => {
    const questionType = q.type === 'single' ? '单选题' : '判断题';
    const optionsText = q.options
      ? Object.entries(q.options).map(([k, v]) => `${k}: ${v}`).join('\n')
      : 'A: 正确\nB: 错误';
    const currentAnswer = q.type === 'truefalse'
      ? (q.answer === true ? 'A（正确）' : 'B（错误）')
      : `${q.answer}（${q.options?.[String(q.answer)] || ''}）`;

    return `[题目${idx + 1}]
题目类型：${questionType}
题目：${q.question}
选项：
${optionsText}
当前标注答案：${currentAnswer}`;
  }).join('\n\n');

  return `你是中国危险化学品安全管理法规专家。请对以下 ${questions.length} 道题目的答案进行核验，并严格按 JSON 格式返回。

${items}

要求：
1. 根据相关法规判断当前标注答案是否正确
2. 如果不正确，给出正确答案和依据
3. 返回格式必须是以下 JSON 数组，不要包含任何其他文字：

[
  {
    "correct": true,
    "correctedAnswer": "D",
    "reason": "当前答案正确，依据是..."
  },
  {
    "correct": false,
    "correctedAnswer": "B",
    "reason": "正确答案应为B，依据是..."
  },
  ...
]

注意：
- 单选题的 correctedAnswer 必须是 A/B/C/D 之一
- 判断题的 correctedAnswer 必须是 A（正确）或 B（错误）
- 即使你认为答案正确，也要返回完整的 JSON 对象`;
}

function parseJsonResponse(text) {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  return JSON.parse(jsonText);
}

function normalizeAnswer(answer, type) {
  if (type === 'truefalse') {
    if (answer === 'A' || answer === true || String(answer).toLowerCase() === 'true') return true;
    if (answer === 'B' || answer === false || String(answer).toLowerCase() === 'false') return false;
    return answer;
  }
  return String(answer).toUpperCase();
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
              content: '你是中国危险化学品安全管理法规专家。请严格按要求的 JSON 格式返回答案核验结果，不要输出任何其他文字。',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
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
  const data = loadQuestions();
  const allQuestions = [
    ...(data.single_choice || []).map(q => ({ ...q, section: 'single_choice' })),
    ...(data.true_false || []).map(q => ({ ...q, section: 'true_false' })),
  ];

  const progress = loadProgress();
  const discrepancies = progress.discrepancies || [];
  const completed = new Set(progress.completed || []);
  const correctedData = progress.correctedData || JSON.parse(JSON.stringify(data));

  console.log(`总共 ${allQuestions.length} 道题，已核验 ${completed.size} 道`);

  const remaining = allQuestions.filter(q => !completed.has(`${q.section}-${q.id}`));

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    
    try {
      const results = await callDeepSeekBatch(batch);
      
      for (let j = 0; j < batch.length; j++) {
        const q = batch[j];
        const key = `${q.section}-${q.id}`;
        const result = results[j] || {};
        
        const normalizedCurrent = normalizeAnswer(q.answer, q.type);
        const normalizedCorrected = normalizeAnswer(result.correctedAnswer, q.type);
        
        completed.add(key);

        if (result.correct === false || normalizedCurrent !== normalizedCorrected) {
          const discrepancy = {
            section: q.section,
            id: q.id,
            type: q.type,
            question: q.question,
            options: q.options || null,
            originalAnswer: q.answer,
            correctedAnswer: normalizedCorrected,
            reason: result.reason || 'AI 认为原答案不正确',
          };
          discrepancies.push(discrepancy);

          // Apply correction
          const sectionArray = correctedData[q.section];
          const target = sectionArray.find(item => item.id === q.id);
          if (target) {
            target.answer = normalizedCorrected;
          }

          console.log(`发现错误：${q.section}-${q.id}，原答案 ${q.answer} → ${normalizedCorrected}`);
        }
      }

      if (Math.floor(i / BATCH_SIZE) % 10 === 9) {
        progress.discrepancies = discrepancies;
        progress.completed = Array.from(completed);
        progress.correctedData = correctedData;
        saveProgress(progress);
        fs.writeFileSync(REPORT_PATH, JSON.stringify(discrepancies, null, 2));
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(correctedData, null, 2));
        console.log(`已核验 ${completed.size}/${allQuestions.length} 道，发现 ${discrepancies.length} 处错误`);
      } else {
        console.log(`已核验 ${completed.size}/${allQuestions.length} 道`);
      }

      await sleep(300);
    } catch (err) {
      console.error(`批次 ${i / BATCH_SIZE + 1} 失败:`, err.message);
      progress.discrepancies = discrepancies;
      progress.completed = Array.from(completed);
      progress.correctedData = correctedData;
      saveProgress(progress);
      fs.writeFileSync(REPORT_PATH, JSON.stringify(discrepancies, null, 2));
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(correctedData, null, 2));
      console.log(`已保存进度，已核验 ${completed.size}/${allQuestions.length} 道`);
      process.exit(1);
    }
  }

  progress.discrepancies = discrepancies;
  progress.completed = Array.from(completed);
  progress.correctedData = correctedData;
  saveProgress(progress);
  fs.writeFileSync(REPORT_PATH, JSON.stringify(discrepancies, null, 2));
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(correctedData, null, 2));
  console.log(`全部完成！已核验 ${allQuestions.length} 道，发现 ${discrepancies.length} 处错误`);
  console.log(`修正后的题库：${OUTPUT_PATH}`);
  console.log(`差异报告：${REPORT_PATH}`);
}

main();

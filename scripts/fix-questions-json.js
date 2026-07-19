const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '..', 'questions.json');
const OUTPUT = path.join(__dirname, '..', 'questions-fixed.json');
const BACKUP = path.join(__dirname, '..', 'questions-broken.json');

const text = fs.readFileSync(INPUT, 'utf8');

// Try to extract all valid top-level JSON values from the broken file
function extractJsonValues(text) {
  const values = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '{' || ch === '[') {
      // Try to parse starting from here, expanding until valid
      for (let j = i + 1; j <= text.length; j++) {
        try {
          const parsed = JSON.parse(text.slice(i, j));
          values.push(parsed);
          i = j;
          break;
        } catch {
          // continue expanding
        }
      }
    }
    i++;
  }
  return values;
}

const values = extractJsonValues(text);
console.log(`提取到 ${values.length} 个顶层 JSON 片段`);

let single_choice = [];
let true_false = [];
let meta = null;

for (const v of values) {
  if (Array.isArray(v)) {
    // Assume standalone arrays are single choice questions
    single_choice = single_choice.concat(v);
  } else if (v && typeof v === 'object') {
    if (Array.isArray(v.single_choice)) {
      single_choice = single_choice.concat(v.single_choice);
    }
    if (Array.isArray(v.true_false)) {
      true_false = true_false.concat(v.true_false);
    }
    if (v.meta) {
      meta = v.meta;
    }
  }
}

console.log(`单选题：${single_choice.length} 道`);
console.log(`判断题：${true_false.length} 道`);
console.log(`总计：${single_choice.length + true_false.length} 道`);

// Validate all questions have required fields
function validateQuestions(arr, type) {
  return arr.filter((q, idx) => {
    if (!q || typeof q !== 'object') {
      console.warn(`${type}[${idx}] 不是对象`);
      return false;
    }
    if (typeof q.id !== 'number') {
      console.warn(`${type}[${idx}] 缺少 id`);
      return false;
    }
    if (!q.question) {
      console.warn(`${type}[${idx}] 缺少 question`);
      return false;
    }
    if (type === 'single_choice' && !q.options) {
      console.warn(`${type}[${idx}] 缺少 options`);
      return false;
    }
    if (q.answer === undefined) {
      console.warn(`${type}[${idx}] 缺少 answer`);
      return false;
    }
    return true;
  });
}

single_choice = validateQuestions(single_choice, 'single_choice');
true_false = validateQuestions(true_false, 'true_false');

// Sort by id for consistency
single_choice.sort((a, b) => a.id - b.id);
true_false.sort((a, b) => a.id - b.id);

const fixed = {
  single_choice,
  true_false,
  meta: {
    title: meta?.title || '危险化学品经营单位主要负责人考试题库（修正版）',
    total_count: single_choice.length + true_false.length,
    single_choice_count: single_choice.length,
    true_false_count: true_false.length,
  },
};

fs.writeFileSync(OUTPUT, JSON.stringify(fixed, null, 2));
fs.writeFileSync(BACKUP, text);
console.log(`已修复并保存到 ${OUTPUT}`);
console.log(`原文件已备份到 ${BACKUP}`);

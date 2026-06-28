import { useState, useEffect, useMemo } from 'react';
import { Lightbulb, CheckCircle2, XCircle, BookOpen, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import type { Question } from '@/types/quiz';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';

interface Props { question: Question; selectedLabel: string; isCorrect: boolean; }

// Verified law database with precise legal citations
const LAW_RULES: Array<{ keywords: string[]; lawName: string; lawText: string; explain: string }> = [
  {
    keywords: ['四新', '新方法'],
    lawName: '《安全生产法》第二十六条',
    lawText: '生产经营单位采用新工艺、新技术、新材料或者使用新设备，必须了解、掌握其安全技术特性，采取有效的安全防护措施，并对从业人员进行专门的安全生产教育和培训。',
    explain: '"四新"指新工艺、新技术、新材料、新设备，不包括"新方法"。',
  },
  {
    keywords: ['建设项目安全审查', '仅指'],
    lawName: '《危险化学品建设项目安全监督管理办法》第三条',
    lawText: '本办法所称建设项目安全审查，是指建设项目安全条件审查、安全设施的设计审查和竣工验收。',
    explain: '安全审查包括三个环节：安全条件审查、安全设施设计审查、竣工验收。说"仅指安全条件审查"是错误的。',
  },
  {
    keywords: ['泡沫灭火器', '金属钠'],
    lawName: '化学危险品安全常识',
    lawText: '金属钠遇水发生剧烈反应：2Na + 2H₂O = 2NaOH + H₂↑，产生大量氢气并放热。',
    explain: '泡沫灭火器含水，金属钠遇水产生氢气会加剧火势。应使用干燥沙土或D类灭火器。',
  },
  {
    keywords: ['工伤保险条例', '制定目的'],
    lawName: '《工伤保险条例》第一条',
    lawText: '为了保障因工作遭受事故伤害或者患职业病的职工获得医疗救治和经济补偿，促进工伤预防和职业康复，分散用人单位的工伤风险，制定本条例。',
    explain: '立法目的是"分散用人单位的工伤风险"，不是避免人身伤害。',
  },
  {
    keywords: ['个人不得购买', '第一类易制毒'],
    lawName: '《易制毒化学品管理条例》第十六条',
    lawText: '个人不得购买第一类、第二类易制毒化学品。',
    explain: '法律明确禁止个人购买第一类和第二类易制毒化学品。',
  },
  {
    keywords: ['剧毒化学品', '个人不得购买'],
    lawName: '《危险化学品安全管理条例》第三十八条',
    lawText: '个人不得购买剧毒化学品（属于剧毒化学品的农药除外）和易制爆危险化学品。',
    explain: '禁止个人购买剧毒化学品和易制爆危险化学品，但属于剧毒化学品的农药除外。',
  },
  {
    keywords: ['应急预案', '主要负责人', '组织编制'],
    lawName: '《生产安全事故应急预案管理办法》第五条',
    lawText: '生产经营单位主要负责人负责组织编制和实施本单位的应急预案，并对应急预案的真实性和实用性负责。',
    explain: '编制应急预案是主要负责人的法定职责。',
  },
  {
    keywords: ['工伤保险费', '用人单位缴纳', '个人不缴纳'],
    lawName: '《工伤保险条例》第十条',
    lawText: '用人单位应当按时缴纳工伤保险费。职工个人不缴纳工伤保险费。',
    explain: '工伤保险费由用人单位全额缴纳，职工个人不缴费。',
  },
  {
    keywords: ['安全警示标志', '较大危险因素'],
    lawName: '《安全生产法》第三十五条',
    lawText: '生产经营单位应当在有较大危险因素的生产经营场所和有关设施、设备上，设置明显的安全警示标志。',
    explain: '必须设置"安全警示标志"，不是标语或警示颜色。',
  },
  {
    keywords: ['主要负责人', '安全生产', '责任制'],
    lawName: '《安全生产法》第二十一条',
    lawText: '生产经营单位的主要负责人对本单位安全生产工作全面负责。',
    explain: '主要负责人对本单位安全生产工作全面负责。',
  },
  {
    keywords: ['氯气', '全封闭防化服'],
    lawName: '《危险化学品生产企业安全生产许可证实施办法》',
    lawText: '生产、储存和使用氯气、氨气、光气、硫化氢等吸入性有毒有害气体的企业，应当配备至少两套以上全封闭防化服。',
    explain: '氯气是剧毒气体，必须配备至少两套全封闭防化服。',
  },
  {
    keywords: ['丙烯腈', '干粉', '二氧化碳'],
    lawName: '《危险化学品安全管理条例》',
    lawText: '丙烯腈属易燃液体，蒸气与空气可形成爆炸性混合物。',
    explain: '丙烯腈运输必须配备干粉或二氧化碳灭火器和防爆工具。',
  },
  {
    keywords: ['双手控制安全装置'],
    lawName: '机械安全标准',
    lawText: '双手控制安全装置的设计原理是只有当操作者的双手同时按下两个按钮时，机器才能启动。',
    explain: '双手控制安全装置只能保护操作者本人，无法保护其他在危险区域的人员。',
  },
  {
    keywords: ['事故隐患', '危险源'],
    lawName: '《安全生产事故隐患排查治理暂行规定》',
    lawText: '事故隐患分为一般事故隐患和重大事故隐患。',
    explain: '事故隐患一定是危险源，但危险源不一定是事故隐患。',
  },
  {
    keywords: ['综合应急预案', '每年', '至少一次', '演练'],
    lawName: '《生产安全事故应急预案管理办法》第三十三条',
    lawText: '每年至少组织一次综合应急预案演练或者专项应急预案演练，每半年至少组织一次现场处置方案演练。',
    explain: '综合应急预案每年至少演练一次。',
  },
  {
    keywords: ['一级动火作业'],
    lawName: 'GB30871-2022 5.1.3',
    lawText: '在火灾爆炸危险场所进行的除特级动火作业以外的动火作业，管廊上的动火作业按一级动火作业管理。',
    explain: '一级动火包括火灾爆炸危险场所的非特级动火，以及管廊上的动火。',
  },
  {
    keywords: ['特级动火作业'],
    lawName: 'GB30871-2022 5.1.2',
    lawText: '在火灾爆炸危险场所处于运行状态下的生产装置设备、管道、储罐、容器等部位上进行的动火作业（包括带压不置换动火作业）。',
    explain: '特级动火指运行状态下的生产装置上的动火作业。',
  },
  {
    keywords: ['光气', '氯气', '剧毒气体', '穿越公共区域', '管道'],
    lawName: '《危险化学品输送管道安全管理规定》',
    lawText: '禁止光气、氯气等剧毒气体化学品管道穿（跨）越公共区域。',
    explain: '光气、氯气等剧毒气体管道严禁穿越公共区域，无论保护措施如何。',
  },
  {
    keywords: ['10个工作日内'],
    lawName: '《危险化学品生产企业安全生产许可证实施办法》第二十四条',
    lawText: '新建企业安全生产许可证的申请，应当在危险化学品生产建设项目安全设施竣工验收通过后10个工作日内提出。',
    explain: '申请应在竣工验收通过后10个工作日内提出，不是1个月。',
  },
  {
    keywords: ['身体和精神方面的原因', '直接原因'],
    lawName: '事故致因理论（GB/T 6442）',
    lawText: '事故的间接原因包括：技术原因、教育原因、身体原因、精神原因、管理原因。',
    explain: '身体和精神原因属于间接原因，不是直接原因。直接原因是人的不安全行为和物的不安全状态。',
  },
  {
    keywords: ['盲板抽堵', '30m内'],
    lawName: 'GB30871-2022 7.6',
    lawText: '距盲板抽堵作业地点30m内不应有动火作业。',
    explain: '盲板抽堵作业地点30m范围内禁止动火。',
  },
];

function findLocalLaw(q: Question) {
  for (const rule of LAW_RULES) {
    const matchCount = rule.keywords.filter(kw => q.question.includes(kw)).length;
    if (matchCount >= 1) return rule;
  }
  return null;
}

function getOptionEntries(q: Question) {
  if (q.type === 'truefalse') return [['A', '正确'], ['B', '错误']] as [string, string][];
  if (q.options) return Object.entries(q.options) as [string, string][];
  return [];
}

export default function QuestionAnalysis({ question, selectedLabel, isCorrect }: Props) {
  const { analyze, loading, error, result } = useAIAnalysis();
  const [hasKey, setHasKey] = useState(false);
  const localLaw = useMemo(() => findLocalLaw(question), [question]);
  const entries = useMemo(() => getOptionEntries(question), [question]);
  const correctLabel = question.type === 'truefalse' ? (question.answer === true ? 'A' : 'B') : String(question.answer);

  useEffect(() => {
    const key = localStorage.getItem('hzp_ai_api_key');
    setHasKey(!!key);
    if (key) analyze(question, selectedLabel, isCorrect);
  }, [question, selectedLabel, isCorrect, analyze]);

  const lawName = result?.lawName || localLaw?.lawName || '';
  const lawText = result?.lawText || localLaw?.lawText || '';
  const explain = result?.explain || localLaw?.explain || '';
  const showAI = hasKey && result;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl" style={{ border: '1px solid #1E2A3E', backgroundColor: '#0B1120' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ backgroundColor: '#141D2E', borderBottom: '1px solid #1E2A3E' }}>
        {showAI ? <Sparkles size={20} className="text-yellow-400" /> : <Lightbulb size={20} className="text-lime-400" />}
        <span className="text-body-lg font-bold text-text-primary">{showAI ? 'Kimi AI 智能解析' : '题目解析'}</span>
        {loading && <Loader2 size={16} className="ml-2 animate-spin text-blue-400" />}
        {showAI && !loading && <span className="ml-2 rounded-full bg-yellow-400/20 px-2 py-0.5 text-xs text-yellow-400">AI</span>}
      </div>

      <div className="p-5">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={32} className="animate-spin text-blue-400" />
            <p className="text-sm text-text-secondary">Kimi 正在联网检索法规依据...</p>
            <p className="text-xs text-text-muted">首次调用可能需要 5-10 秒</p>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl p-4" style={{ backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)' }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-error-400" />
              <span className="text-sm text-error-400">AI 调用失败: {error}</span>
            </div>
            {error.includes('余额') && (
              <p className="mt-2 text-xs text-text-muted">API Key 余额不足，请在设置页面更换有效 Key 或使用本地解析</p>
            )}
          </div>
        )}

        {/* Law citation */}
        {!loading && lawName && (
          <div className="mb-4 rounded-xl p-4" style={{ backgroundColor: 'rgba(96, 165, 250, 0.08)', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
            <div className="mb-2 flex items-center gap-2">
              <BookOpen size={16} className="text-blue-400" />
              <span className="text-sm font-bold text-blue-400">法规依据</span>
              {showAI && <span className="text-xs text-text-muted">（联网检索）</span>}
            </div>
            <p className="mb-2 text-sm font-bold text-text-primary">{lawName}</p>
            {lawText && (
              <div className="mb-3 rounded-lg bg-space-900/50 p-3">
                <p className="text-sm leading-relaxed text-text-secondary" style={{ lineHeight: 1.7 }}>{lawText}</p>
              </div>
            )}
          </div>
        )}

        {/* Explanation */}
        {!loading && explain && (
          <div className="mb-4 rounded-xl p-4" style={{ backgroundColor: 'rgba(212, 249, 53, 0.05)', border: '1px solid rgba(212, 249, 53, 0.2)' }}>
            <div className="mb-2 flex items-center gap-2">
              <Lightbulb size={16} className="text-lime-400" />
              <span className="text-sm font-bold text-lime-400">考点解读</span>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{explain}</p>
          </div>
        )}

        {/* AI full analysis */}
        {showAI && result.wrongAnalysis && !isCorrect && (
          <div className="mb-4 rounded-xl p-4" style={{ backgroundColor: 'rgba(248, 113, 113, 0.05)', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
            <div className="mb-2 flex items-center gap-2">
              <XCircle size={16} className="text-error-400" />
              <span className="text-sm font-bold text-error-400">错误分析</span>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{result.wrongAnalysis}</p>
          </div>
        )}

        {/* Correct answer */}
        {!loading && (
          <div className="mb-4 rounded-xl p-4" style={{ backgroundColor: 'rgba(74, 222, 128, 0.05)', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-success-400" />
              <span className="text-sm font-bold text-success-400">正确答案</span>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary" style={{ lineHeight: 1.7 }}>
              {question.type === 'truefalse'
                ? (question.answer === true ? '正确' : '错误')
                : `${correctLabel}（${question.options?.[correctLabel] || ''}）`}
              {lawName && ` — 根据${lawName}的规定。`}
            </p>
          </div>
        )}

        {/* Per-option analysis */}
        {!loading && (
          <div className="mt-4">
            <p className="mb-3 text-sm font-bold text-text-secondary">各选项判定：</p>
            <div className="flex flex-col gap-2">
              {entries.map(([label, text]) => {
                const dl = question.type === 'truefalse' ? (label === 'A' ? '\u2713' : '\u2717') : label;
                const ic = label === correctLabel;
                return (
                  <div key={label} className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{ backgroundColor: ic ? 'rgba(74, 222, 128, 0.05)' : 'rgba(248, 113, 113, 0.03)', border: `1px solid ${ic ? 'rgba(74, 222, 128, 0.2)' : '#1E2A3E'}` }}>
                    <span className="mt-0.5 flex items-center justify-center rounded-full text-xs font-bold"
                      style={{ width: 28, height: 28, minWidth: 28, backgroundColor: ic ? 'rgba(74, 222, 128, 0.2)' : '#1E2A3E', color: ic ? '#4ADE80' : '#94A3B8' }}>
                      {dl}
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm ${ic ? 'text-success-400' : 'text-text-muted'}`}>{text}</p>
                      <p className="mt-1 text-xs leading-relaxed text-text-muted" style={{ lineHeight: 1.6 }}>
                        {ic ? `【正确】符合${lawName || '法规规定'}。` : `【错误】不符合${lawName || '法规规定'}。`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!hasKey && !loading && (
          <div className="mt-4 rounded-lg bg-space-800 p-3 text-center">
            <p className="text-xs text-text-muted">
              以上解析基于本地法规库（21条精确法规）。
              <a href="#/settings" className="ml-1 text-blue-400 hover:underline">设置 AI API Key</a>
              可启用联网检索。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

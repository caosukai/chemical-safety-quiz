import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Download,
  Upload,
  Calendar,
  Clock,
  Target,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  XCircle,
  FileText,
  Sparkles,
} from 'lucide-react';
import Layout from '@/components/Layout';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  useSettings,
  useWrongQuestions,
  useExamHistory,
  useSequentialProgress,
  useLocalStorage,
  useSyncCode,
  exportAllData,
  importAllData,
  STORAGE_KEYS,
} from '@/hooks/useLocalStorage';
import type { AppSettings, SyncData } from '@/types/quiz';

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error';
}

const fontSizeOptions: { value: AppSettings['fontSize']; label: string }[] = [
  { value: 'normal', label: '标准' },
  { value: 'large', label: '大' },
  { value: 'extra-large', label: '更大' },
];

const sampleQuestion = '危险化学品经营单位的主要负责人对本单位的安全生产工作全面负责，应当建立健全并落实本单位全员安全生产责任制。';

export default function Settings() {
  const [settings, setSettings] = useSettings();
  const [, setWrongQuestions] = useWrongQuestions();
  const [examHistory, setExamHistory] = useExamHistory();
  const [, setSequentialProgress] = useSequentialProgress();
  const [, setAnswers] = useLocalStorage<Record<string, unknown>>(STORAGE_KEYS.ANSWERS, {});
  const [syncCode, setSyncCode] = useSyncCode();

  const [showResetProgressConfirm, setShowResetProgressConfirm] = useState(false);
  const [showResetWrongConfirm, setShowResetWrongConfirm] = useState(false);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  const toastRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // GSAP entrance animations
  useEffect(() => {
    const sections = sectionRefs.current.filter(Boolean);
    gsap.fromTo(
      sections,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' }
    );
  }, []);

  // Toast animation
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    requestAnimationFrame(() => {
      if (toastRef.current) {
        gsap.fromTo(
          toastRef.current,
          { opacity: 0, y: -20 },
          { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
        );
      }
    });
    setTimeout(() => {
      if (toastRef.current) {
        gsap.to(toastRef.current, {
          opacity: 0,
          y: -20,
          duration: 0.2,
          ease: 'power2.in',
          onComplete: () => setToast({ show: false, message: '', type }),
        });
      } else {
        setToast({ show: false, message: '', type });
      }
    }, 2000);
  };

  // Font size handlers
  const handleFontSizeChange = (size: AppSettings['fontSize']) => {
    setSettings(prev => ({ ...prev, fontSize: size }));
  };

  const getFontSizeStyle = (base: 'normal' | 'large' | 'extra-large'): { fontSize: string } => {
    const map: Record<string, string> = {
      normal: '1.25rem',
      large: '1.375rem',
      'extra-large': '1.5rem',
    };
    return { fontSize: map[base] || '1.25rem' };
  };

  // Reset handlers
  const handleResetProgress = () => {
    setSequentialProgress({ currentIndex: 0, totalAnswered: 0 });
    setAnswers({});
    setShowResetProgressConfirm(false);
    showToast('学习进度已重置', 'success');
  };

  const handleResetWrongQuestions = () => {
    setWrongQuestions([]);
    setShowResetWrongConfirm(false);
    showToast('错题本已清空', 'success');
  };

  const handleResetAll = () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    setShowResetAllConfirm(false);
    showToast('所有数据已重置，页面即将刷新', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleClearHistory = () => {
    setExamHistory([]);
    setShowClearHistoryConfirm(false);
    showToast('考试记录已清空', 'success');
  };

  // Export handler
  const handleExport = () => {
    const code = syncCode || `USER${Date.now().toString(36).toUpperCase()}`;
    if (!syncCode) setSyncCode(code);
    const data = exportAllData(code);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `危化品刷题数据_${code}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setImportResult({ success: true, message: `已导出 ${data.answerHistory.length} 条记录` });
    setTimeout(() => setImportResult(null), 3000);
  };

  // Import handler
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as SyncData;
        if (!data.syncCode || !Array.isArray(data.answerHistory)) {
          throw new Error('文件格式不正确');
        }
        // If user has a sync code, warn if mismatch
        if (syncCode && syncCode !== data.syncCode) {
          setImportResult({ success: false, message: `同步码不匹配: 当前 ${syncCode} vs 文件 ${data.syncCode}` });
          return;
        }
        // Set sync code from file if not set
        if (!syncCode) setSyncCode(data.syncCode);
        const result = importAllData(data);
        setImportResult({
          success: true,
          message: `导入成功！合并 ${result.merged} 条记录${result.conflicts > 0 ? ` (其中 ${result.conflicts} 条取最新)` : ''}`
        });
        setTimeout(() => {
          setImportResult(null);
          window.location.reload();
        }, 2000);
      } catch (err) {
        setImportResult({ success: false, message: `导入失败: ${err instanceof Error ? err.message : '未知错误'}` });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Format exam record display
  const formatDate = (timestamp: number): string => {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}时${m}分${s}秒`;
    return `${m}分${s}秒`;
  };

  const setSectionRef = (index: number) => (el: HTMLDivElement | null) => {
    sectionRefs.current[index] = el;
  };

  return (
    <Layout title="设置">
      {/* Toast */}
      {toast.show && (
        <div
          ref={toastRef}
          className="fixed top-20 left-0 right-0 z-[70] flex justify-center px-4 pointer-events-none"
        >
          <div
            className="rounded-radius-lg px-6 py-3 text-body font-medium shadow-lg"
            style={{
              backgroundColor: toast.type === 'success' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
              color: toast.type === 'success' ? '#4ADE80' : '#F87171',
              border: `1px solid ${toast.type === 'success' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            {toast.message}
          </div>
        </div>
      )}

      <div className="px-6 py-6" style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* ===== Font Size Section ===== */}
        <div
          ref={setSectionRef(0)}
          className="mb-6 rounded-radius-lg bg-space-900 p-6"
          style={{ border: '1px solid #1E2A3E' }}
        >
          <h2 className="text-subtitle text-text-primary mb-4">字体大小</h2>

          {/* Segmented Control */}
          <div
            className="mb-6 flex gap-1 rounded-radius-md p-1"
            style={{ backgroundColor: '#141D2E' }}
          >
            {fontSizeOptions.map(option => (
              <button
                key={option.value}
                onClick={() => handleFontSizeChange(option.value)}
                className="flex-1 rounded-radius-md py-2.5 text-body transition-all duration-200"
                style={{
                  backgroundColor: settings.fontSize === option.value ? '#1E2A3E' : 'transparent',
                  color: settings.fontSize === option.value ? '#D4F935' : '#94A3B8',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Live Preview */}
          <div className="rounded-radius-md bg-space-800 p-5" style={{ border: '1px solid #1E2A3E' }}>
            <p className="text-sm text-text-muted mb-2">预览效果</p>
            <p
              className="text-text-primary transition-all duration-200"
              style={{ ...getFontSizeStyle(settings.fontSize), lineHeight: 1.8 }}
            >
              {sampleQuestion}
            </p>
          </div>
        </div>

        {/* ===== Sync Code Section ===== */}
        <div
          ref={setSectionRef(1)}
          className="mb-6 rounded-radius-lg bg-space-900 p-6"
          style={{ border: '1px solid #1E2A3E' }}
        >
          <h2 className="text-subtitle text-text-primary mb-4">跨设备同步</h2>

          <div className="mb-6">
            <label className="text-body text-text-secondary mb-3 block">同步码</label>
            <p className="text-sm text-text-muted mb-2">
              设置一个同步码，在不同设备上使用相同的同步码可以合并学习记录
            </p>
            <input
              type="text"
              value={syncCode}
              onChange={(e) => setSyncCode(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="输入同步码 (如: ABC123)"
              className="w-full rounded-xl bg-space-800 px-4 py-3 text-body text-text-primary outline-none transition-all focus:ring-2 focus:ring-lime-400/50"
              style={{ border: '1px solid #1E2A3E' }}
            />
          </div>

          <div className="mb-6">
            <label className="text-body text-text-secondary mb-3 block">数据导入 / 导出</label>

            <div className="flex gap-3 mb-3">
              <button
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-space-800 py-3 text-body text-text-primary transition-all hover:bg-space-700"
                style={{ border: '1px solid #1E2A3E' }}
              >
                <Download size={18} />
                导出数据
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-space-800 py-3 text-body text-text-primary transition-all hover:bg-space-700"
                style={{ border: '1px solid #1E2A3E' }}
              >
                <Upload size={18} />
                导入数据
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>

            {importResult && (
              <div className={`rounded-xl px-4 py-3 text-sm ${importResult.success ? 'bg-success-500/10 text-success-400' : 'bg-error-500/10 text-error-400'}`}>
                {importResult.message}
              </div>
            )}
          </div>
        </div>

        {/* ===== AI Analysis Section ===== */}
        <div
          ref={setSectionRef(2)}
          className="mb-6 rounded-radius-lg bg-space-900 p-6"
          style={{ border: '1px solid #1E2A3E' }}
        >
          <h2 className="text-subtitle text-text-primary mb-4 flex items-center gap-2">
            <Sparkles size={20} className="text-yellow-400" />
            AI 智能解析
          </h2>
          <p className="text-sm text-text-muted mb-4">
            已内置 DeepSeek AI 解析，共 840 道题目的法规依据和考点解读已预生成。
            做题时自动显示，无需设置 API Key。
          </p>

          <div className="flex items-center gap-2 rounded-xl bg-success-500/10 px-4 py-2 text-sm text-success-400">
            <CheckCircle2 size={16} />
            DeepSeek AI 解析已启用
          </div>
        </div>

        {/* ===== Data Management Section ===== */}
        <div
          ref={setSectionRef(3)}
          className="mb-6 rounded-radius-lg bg-space-900 p-6"
          style={{ border: '1px solid #1E2A3E' }}
        >
          <h2 className="text-subtitle text-text-primary mb-4">数据管理</h2>

          <div className="flex flex-col gap-4">
            {/* Reset Progress */}
            <div>
              <button
                onClick={() => setShowResetProgressConfirm(true)}
                className="flex w-full items-center justify-between rounded-radius-md border-2 border-space-600 px-4 py-3 text-body text-text-secondary transition-all duration-200 hover:border-accent-blue hover:text-accent-blue"
                style={{ minHeight: 48 }}
              >
                <div className="flex items-center gap-3">
                  <RotateCcw size={18} />
                  <span>重置学习进度</span>
                </div>
                <ChevronRight size={18} className="text-text-muted" />
              </button>
              <p className="mt-1 px-1 text-sm text-text-muted">
                清除所有答题记录和正确率统计
              </p>
            </div>

            {/* Clear Wrong Questions */}
            <div>
              <button
                onClick={() => setShowResetWrongConfirm(true)}
                className="flex w-full items-center justify-between rounded-radius-md border-2 px-4 py-3 text-body transition-all duration-200 hover:opacity-80"
                style={{ minHeight: 48, borderColor: 'rgba(248, 113, 113, 0.5)', color: '#F87171' }}
              >
                <div className="flex items-center gap-3">
                  <Trash2 size={18} />
                  <span>清空错题本</span>
                </div>
                <ChevronRight size={18} className="text-text-muted" />
              </button>
              <p className="mt-1 px-1 text-sm text-text-muted">
                删除所有收录的错题
              </p>
            </div>

            {/* Reset All */}
            <div>
              <button
                onClick={() => setShowResetAllConfirm(true)}
                className="flex w-full items-center justify-between rounded-radius-md border-2 px-4 py-3 text-body transition-all duration-200 hover:bg-error-400/10"
                style={{ minHeight: 48, borderColor: '#F87171', color: '#F87171' }}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} />
                  <span>重置所有数据</span>
                </div>
                <ChevronRight size={18} className="text-text-muted" />
              </button>
              <p className="mt-1 px-1 text-sm" style={{ color: 'rgba(248, 113, 113, 0.7)' }}>
                恢复出厂设置，清除一切数据（不可恢复）
              </p>
            </div>
          </div>
        </div>

        {/* ===== Exam History Section ===== */}
        <div
          ref={setSectionRef(4)}
          className="mb-6 rounded-radius-lg bg-space-900 p-6"
          style={{ border: '1px solid #1E2A3E' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-subtitle text-text-primary">考试记录</h2>
            {examHistory.length > 0 && (
              <button
                onClick={() => setShowClearHistoryConfirm(true)}
                className="rounded-radius-md px-3 py-1.5 text-sm transition-all duration-200 hover:bg-error-400/10"
                style={{ color: '#F87171', border: '1px solid rgba(248, 113, 113, 0.4)' }}
              >
                清空记录
              </button>
            )}
          </div>

          {examHistory.length === 0 ? (
            <div className="flex flex-col items-center py-10">
              <FileText size={40} className="text-text-muted mb-3" />
              <p className="text-body text-text-muted">暂无考试记录</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {examHistory.map(record => (
                <div
                  key={record.id}
                  className="rounded-radius-md bg-space-800 p-4 transition-all duration-200"
                  style={{ border: '1px solid #1E2A3E' }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-text-muted" />
                      <span className="text-sm text-text-secondary">{formatDate(record.date)}</span>
                    </div>
                    <div
                      className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium"
                      style={{
                        backgroundColor: record.score >= 80 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                        color: record.score >= 80 ? '#4ADE80' : '#F87171',
                      }}
                    >
                      {record.score >= 80 ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {record.score}分
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-text-muted">
                    <div className="flex items-center gap-1">
                      <Target size={14} />
                      <span>正确率 {Math.round((record.correctCount / record.totalQuestions) * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{formatTime(record.timeUsed)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen size={14} />
                      <span>{record.totalQuestions}题</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== Quiz Info Section ===== */}
        <div
          ref={setSectionRef(5)}
          className="mb-6 rounded-radius-lg bg-space-900 p-6"
          style={{ border: '1px solid #1E2A3E' }}
        >
          <h2 className="text-subtitle text-text-primary mb-4">题库信息</h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-radius-md bg-space-800 px-4 py-3">
              <span className="text-body text-text-secondary">题库总量</span>
              <span className="text-body font-medium text-text-primary">840 题</span>
            </div>
            <div className="flex items-center justify-between rounded-radius-md bg-space-800 px-4 py-3">
              <span className="text-body text-text-secondary">单选题</span>
              <span className="text-body font-medium text-text-primary">477 道</span>
            </div>
            <div className="flex items-center justify-between rounded-radius-md bg-space-800 px-4 py-3">
              <span className="text-body text-text-secondary">判断题</span>
              <span className="text-body font-medium text-text-primary">363 道</span>
            </div>
            <div className="flex items-center justify-between rounded-radius-md bg-space-800 px-4 py-3">
              <span className="text-body text-text-secondary">适用考试</span>
              <span className="text-body font-medium text-text-primary">危化品经营单位主要负责人</span>
            </div>
          </div>
        </div>

        {/* ===== About Section ===== */}
        <div
          ref={setSectionRef(6)}
          className="mb-6 rounded-radius-lg bg-space-900 p-6"
          style={{ border: '1px solid #1E2A3E' }}
        >
          <h2 className="text-subtitle text-text-primary mb-4">关于</h2>
          <div className="rounded-radius-md bg-space-800 px-4 py-4">
            <p className="text-sm text-text-muted mb-1">
              危化品经营单位主要负责人考试刷题系统
            </p>
            <p className="text-sm text-text-muted">v2.0</p>
          </div>
        </div>
      </div>

      {/* ===== Confirm Dialogs ===== */}
      <ConfirmDialog
        open={showResetProgressConfirm}
        title="确认重置学习进度"
        message="此操作将清除所有答题记录和顺序练习进度，且无法恢复。确定要继续吗？"
        confirmLabel="确认重置"
        cancelLabel="取消"
        confirmVariant="error"
        onConfirm={handleResetProgress}
        onCancel={() => setShowResetProgressConfirm(false)}
      />

      <ConfirmDialog
        open={showResetWrongConfirm}
        title="确认清空错题本"
        message="此操作将删除所有收录的错题，且无法恢复。确定要继续吗？"
        confirmLabel="确认清空"
        cancelLabel="取消"
        confirmVariant="error"
        onConfirm={handleResetWrongQuestions}
        onCancel={() => setShowResetWrongConfirm(false)}
      />

      <ConfirmDialog
        open={showResetAllConfirm}
        title="确认重置所有数据"
        message="此操作将清除所有数据（答题记录、错题本、考试历史、学习进度），恢复出厂设置，且无法恢复。确定要继续吗？"
        confirmLabel="确认重置"
        cancelLabel="取消"
        confirmVariant="error"
        onConfirm={handleResetAll}
        onCancel={() => setShowResetAllConfirm(false)}
      />

      <ConfirmDialog
        open={showClearHistoryConfirm}
        title="确认清空考试记录"
        message="此操作将删除所有考试记录，且无法恢复。确定要继续吗？"
        confirmLabel="确认清空"
        cancelLabel="取消"
        confirmVariant="error"
        onConfirm={handleClearHistory}
        onCancel={() => setShowClearHistoryConfirm(false)}
      />
    </Layout>
  );
}

import { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Sparkles, Key, CheckCircle2, Trash2 } from 'lucide-react';
import gsap from 'gsap';
import { useSettings, STORAGE_KEYS } from '@/hooks/useLocalStorage';
import { AI_PROVIDERS } from '@/hooks/useAIAnalysis';
import ConfirmDialog from './ConfirmDialog';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useSettings();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('hzp_ai_api_key') || '');
  const [provider, setProvider] = useState(parseInt(localStorage.getItem('hzp_ai_provider') || '0', 10));
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (!overlayRef.current || !panelRef.current) return;
    if (open) {
      // Ensure visible first, then animate
      gsap.set(overlayRef.current, { opacity: 1 });
      gsap.set(panelRef.current, { opacity: 1, y: 0 });
    }
  }, [open]);

  const handleFontSizeChange = (size: 'normal' | 'large' | 'extra-large') => {
    setSettings(prev => ({ ...prev, fontSize: size }));
    // Apply immediately to DOM so all components see the change
    document.documentElement.dataset.fontSize = size;
  };

  const handleReset = () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    window.location.reload();
  };

  if (!open) return null;

  const fontSizeOptions: { value: 'normal' | 'large' | 'extra-large'; label: string }[] = [
    { value: 'normal', label: '标准' },
    { value: 'large', label: '大' },
    { value: 'extra-large', label: '更大' },
  ];

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[60] flex items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(3, 6, 21, 0.6)' }}
        onClick={onClose}
      >
        <div
          ref={panelRef}
          className="w-full max-w-md rounded-radius-lg bg-space-900 p-6"
          style={{ border: '1px solid #1E2A3E' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-title text-text-primary">设置</h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-full transition-all duration-200 hover:bg-space-800"
              style={{ width: 36, height: 36 }}
              aria-label="关闭"
            >
              <X size={20} className="text-text-secondary" />
            </button>
          </div>

          {/* Font Size */}
          <div className="mb-6">
            <label className="text-body text-text-secondary mb-3 block">字体大小</label>
            <div className="flex gap-2">
              {fontSizeOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleFontSizeChange(option.value)}
                  className="flex-1 rounded-radius-md py-2 text-body transition-all duration-200"
                  style={{
                    backgroundColor: settings.fontSize === option.value ? '#D4F935' : '#141D2E',
                    color: settings.fontSize === option.value ? '#030615' : '#94A3B8',
                    border: settings.fontSize === option.value ? 'none' : '1px solid #1E2A3E',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI API Key */}
          <div className="mb-6">
            <label className="text-body text-text-secondary mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-yellow-400" />
              AI 智能解析
            </label>

            {/* Provider selection */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              {AI_PROVIDERS.slice(0, 4).map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => {
                    setProvider(i);
                    localStorage.setItem('hzp_ai_provider', String(i));
                  }}
                  className="rounded-lg px-2 py-2 text-xs transition-all"
                  style={{
                    backgroundColor: provider === i ? 'rgba(212, 249, 53, 0.1)' : '#141D2E',
                    border: `1px solid ${provider === i ? '#D4F935' : '#1E2A3E'}`,
                    color: provider === i ? '#D4F935' : '#94A3B8',
                  }}
                >
                  <div className="font-bold">{p.name.split(' ')[0]}</div>
                </button>
              ))}
            </div>

            {/* API Key input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setApiKey(val);
                    if (val) {
                      localStorage.setItem('hzp_ai_api_key', val);
                    } else {
                      localStorage.removeItem('hzp_ai_api_key');
                    }
                  }}
                  placeholder="粘贴 API Key"
                  className="w-full rounded-lg bg-space-800 px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:ring-2 focus:ring-yellow-400/50 pr-14"
                  style={{ border: '1px solid #1E2A3E' }}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-secondary px-1"
                >
                  {showApiKey ? '隐藏' : '显示'}
                </button>
              </div>
              {apiKey && (
                <button
                  onClick={() => {
                    setApiKey('');
                    localStorage.removeItem('hzp_ai_api_key');
                  }}
                  className="rounded-lg bg-space-800 px-3 py-2.5 text-sm text-error-400 transition-all hover:bg-error-500/10"
                  style={{ border: '1px solid #1E2A3E' }}
                  title="删除 API Key"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {apiKey ? (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-success-500/10 px-3 py-2 text-xs text-success-400">
                <CheckCircle2 size={14} />
                {AI_PROVIDERS[provider]?.name.split(' ')[0] || 'AI'} 已配置
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-space-800 px-3 py-2 text-xs text-text-muted">
                <Key size={14} />
                未设置，使用本地法规库解析
              </div>
            )}
          </div>

          {/* Quiz Info */}
          <div className="mb-6">
            <label className="text-body text-text-secondary mb-3 block">题库信息</label>
            <div className="rounded-radius-md bg-space-800 p-4">
              <p className="text-body text-text-primary">共 840 题</p>
              <p className="text-sm text-text-muted mt-1">单选题 477 道 &middot; 判断题 363 道</p>
            </div>
          </div>

          {/* Reset Progress */}
          <div>
            <label className="text-body text-text-secondary mb-3 block">危险操作</label>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-radius-md border-2 border-error-500 py-3 text-body text-error-400 transition-all duration-200 hover:bg-error-500/10"
            >
              <AlertTriangle size={18} />
              重置所有进度
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        title="确认重置进度"
        message="此操作将清除所有答题记录、错题本和考试历史，且无法恢复。确定要继续吗？"
        confirmLabel="确认重置"
        cancelLabel="取消"
        confirmVariant="error"
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </>
  );
}

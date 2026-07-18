import { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Sparkles, CheckCircle2, Key, Eye, EyeOff } from 'lucide-react';
import gsap from 'gsap';
import { useSettings, STORAGE_KEYS } from '@/hooks/useLocalStorage';
import ConfirmDialog from './ConfirmDialog';
import type { AppSettings } from '@/types/quiz';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useSettings();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
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

  const aiProviderOptions: { value: NonNullable<AppSettings['aiProvider']>; label: string }[] = [
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'kimi', label: 'Kimi' },
    { value: 'tongyi', label: '通义千问' },
    { value: 'openai', label: 'OpenAI' },
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

          {/* AI Analysis */}
          <div className="mb-6">
            <label className="text-body text-text-secondary mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-yellow-400" />
              AI 智能解析
            </label>
            <div className="rounded-radius-md bg-space-800 p-4 space-y-4">
              <div>
                <label className="text-xs text-text-muted mb-2 block">AI 提供商</label>
                <div className="flex flex-wrap gap-2">
                  {aiProviderOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSettings(prev => ({ ...prev, aiProvider: option.value }))}
                      className="rounded-radius-md px-3 py-1.5 text-xs transition-all duration-200"
                      style={{
                        backgroundColor: settings.aiProvider === option.value ? '#D4F935' : '#141D2E',
                        color: settings.aiProvider === option.value ? '#030615' : '#94A3B8',
                        border: settings.aiProvider === option.value ? 'none' : '1px solid #1E2A3E',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-text-muted mb-2 block flex items-center gap-1">
                  <Key size={12} />
                  API Key（可选）
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.aiApiKey || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, aiApiKey: e.target.value }))}
                    placeholder="填写后优先使用在线 AI 解析"
                    className="w-full rounded-radius-md bg-space-900 px-3 py-2 pr-10 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-success-400"
                    style={{ border: '1px solid #1E2A3E' }}
                  />
                  <button
                    onClick={() => setShowApiKey(prev => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-primary"
                    aria-label={showApiKey ? '隐藏密钥' : '显示密钥'}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-success-400">
                <CheckCircle2 size={14} />
                {settings.aiApiKey?.trim() ? `${aiProviderOptions.find(o => o.value === settings.aiProvider)?.label || 'DeepSeek'} 在线解析已启用` : '内置 AI 解析已启用'}
              </div>
            </div>
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

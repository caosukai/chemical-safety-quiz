import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'error' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  confirmVariant = 'error',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overlayRef.current || !panelRef.current) return;
    if (open) {
      gsap.to(overlayRef.current, { opacity: 1, duration: 0.2, ease: 'power2.out' });
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
      );
    }
  }, [open]);

  if (!open) return null;

  const confirmBg = confirmVariant === 'error' ? '#EF4444' : '#D4F935';
  const confirmText = confirmVariant === 'error' ? '#F8FAFC' : '#030615';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(3, 6, 21, 0.6)' }}
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md rounded-radius-lg bg-space-900 p-6"
        style={{ border: '1px solid #1E2A3E' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-title text-text-primary mb-2">{title}</h2>
        <p className="text-body text-text-secondary mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-radius-md border-2 border-space-600 py-3 text-body text-text-secondary transition-all duration-200 hover:border-accent-blue hover:text-accent-blue"
            style={{ minHeight: 48 }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-radius-md py-3 text-body font-bold transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{ minHeight: 48, backgroundColor: confirmBg, color: confirmText }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

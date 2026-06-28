import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface ModeCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  countLabel: string;
  iconColor: string;
  to: string;
  disabled?: boolean;
  opacity?: number;
  badge?: string;
}

export default function ModeCard({
  icon: Icon,
  title,
  description,
  countLabel,
  iconColor,
  to,
  disabled = false,
  opacity = 1,
  badge,
}: ModeCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => {
        if (!disabled) navigate(to);
      }}
      disabled={disabled}
      className="group flex flex-col items-start rounded-radius-xl bg-space-800 p-8 text-left transition-all duration-200 hover:-translate-y-1 hover:bg-space-700 hover:shadow-card active:scale-[0.98] disabled:cursor-not-allowed"
      style={{
        opacity: disabled ? 0.6 : opacity,
        border: '1px solid #1E2A3E',
      }}
    >
      <div
        className="mb-4 flex items-center justify-center rounded-2xl bg-space-900 transition-transform duration-200 group-hover:scale-110"
        style={{ width: 64, height: 64 }}
      >
        <Icon size={32} style={{ color: iconColor }} />
      </div>
      <div className="mb-1 flex items-center">
        <h3 className="text-subtitle text-text-primary">{title}</h3>
        {badge && (
          <span className="ml-2 inline-flex items-center rounded-full bg-lime-400/20 px-2 py-0.5 text-xs font-bold text-lime-400">
            {badge}
          </span>
        )}
      </div>
      <p className="text-body text-text-secondary mb-3">{description}</p>
      <span className="text-sm text-text-muted">{countLabel}</span>
    </button>
  );
}

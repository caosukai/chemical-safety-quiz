import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Settings } from 'lucide-react';
import { useState } from 'react';
import SettingsDialog from './SettingsDialog';

interface NavbarProps {
  title?: string;
}

export default function Navbar({ title }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isHome = location.pathname === '/';

  const getPageTitle = (): string => {
    if (title) return title;
    switch (location.pathname) {
      case '/':
        return '危化品考试刷题系统';
      case '/practice/sequential':
        return '顺序练习';
      case '/practice/random':
        return '随机练习';
      case '/exam':
        return '模拟考试';
      case '/exam-result':
        return '考试结果';
      case '/wrong-questions':
        return '错题本';
      default:
        return '危化品考试刷题系统';
    }
  };

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: 64,
          backgroundColor: 'rgba(3, 6, 21, 0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center" style={{ width: 40 }}>
          {!isHome && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center rounded-full transition-all duration-200 hover:bg-space-800"
              style={{ width: 40, height: 40 }}
              aria-label="返回"
            >
              <ChevronLeft size={24} className="text-text-secondary hover:text-lime-400 transition-colors" />
            </button>
          )}
        </div>

        <h1 className="text-subtitle text-text-primary truncate" style={{ maxWidth: '60%' }}>
          {getPageTitle()}
        </h1>

        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center rounded-full transition-all duration-200 hover:bg-space-800"
          style={{ width: 40, height: 40 }}
          aria-label="设置"
        >
          <Settings size={24} className="text-text-secondary hover:text-lime-400 transition-colors" />
        </button>
      </nav>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

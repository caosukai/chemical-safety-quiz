import type { ReactNode } from 'react';
import { useEffect } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import { useSettings } from '@/hooks/useLocalStorage';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  showFooter?: boolean;
}

export default function Layout({ children, title, showFooter = true }: LayoutProps) {
  const [settings] = useSettings();

  // Apply font-size setting globally
  useEffect(() => {
    if (settings.fontSize) {
      document.documentElement.dataset.fontSize = settings.fontSize;
    }
  }, [settings.fontSize]);

  return (
    <div className="relative min-h-[100dvh]" style={{ zIndex: 1 }}>
      <Navbar title={title} />
      <main
        className="relative"
        style={{ paddingTop: 64, minHeight: '100dvh' }}
      >
        {children}
        {showFooter && <Footer />}
      </main>
    </div>
  );
}

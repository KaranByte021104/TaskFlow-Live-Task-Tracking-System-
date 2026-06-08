'use client';

import { useEffect } from 'react';

interface ShortcutConfig {
  onPressN?: () => void;
  onPressSlash?: () => void;
}

export function useKeyboardShortcuts({ onPressN, onPressSlash }: ShortcutConfig) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key.toLowerCase() === 'n' && onPressN) {
        e.preventDefault();
        onPressN();
      }

      if (e.key === '/' && onPressSlash) {
        e.preventDefault();
        onPressSlash();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onPressN, onPressSlash]);
}

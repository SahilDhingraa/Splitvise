'use client';

import { useSyncExternalStore } from 'react';

// The `dark` class on <html> is the source of truth, not React state -- the inline
// script in layout.tsx sets it before React exists, so mirroring it into state
// would just be a second copy that starts out wrong. Subscribe to it instead.

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const isDarkNow = () => document.documentElement.classList.contains('dark');

// The server has no DOM and cannot know the visitor's preference. It renders the
// light-mode icon; React re-reads the real value right after hydration.
const isDarkOnServer = () => false;

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, isDarkNow, isDarkOnServer);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    listeners.forEach((notify) => notify());
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="material-icons">{isDark ? 'light_mode' : 'dark_mode'}</span>
    </button>
  );
}

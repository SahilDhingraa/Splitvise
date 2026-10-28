'use client';

import { useSyncExternalStore } from 'react';
import { Icon } from './Icon';

// The `dark` class on <html> is the source of truth, not React state -- the inline
// script in layout.tsx sets it before React exists, so mirroring it into state
// would just be a second copy that starts out wrong. Subscribe to it instead.
//
// The saved preference lives in localStorage under `theme`: 'light', 'dark', or
// nothing at all for "follow the system".

type Preference = 'system' | 'light' | 'dark';

const listeners = new Set<() => void>();
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function readPreference(): Preference {
  try {
    const saved = localStorage.getItem('theme');
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function apply() {
  const preference = readPreference();
  const dark = preference === 'dark' || (preference === 'system' && media().matches);
  document.documentElement.classList.toggle('dark', dark);
  listeners.forEach((notify) => notify());
}

function setPreference(preference: Preference) {
  try {
    if (preference === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', preference);
  } catch {}
  apply();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // While following the system, an OS-level switch should flip the page too.
  const query = media();
  const onSystemChange = () => {
    if (readPreference() === 'system') apply();
  };
  query.addEventListener('change', onSystemChange);
  return () => {
    listeners.delete(onChange);
    query.removeEventListener('change', onSystemChange);
  };
}

const isDarkNow = () => document.documentElement.classList.contains('dark');

// The server has no DOM and cannot know the visitor's preference. It renders the
// light-mode state; React re-reads the real value right after hydration.
const isDarkOnServer = () => false;
const preferenceOnServer = (): Preference => 'system';

// The one-tap switch in the phone top bar.
export function ThemeToggle({ className }: { className?: string }) {
  const isDark = useSyncExternalStore(subscribe, isDarkNow, isDarkOnServer);

  return (
    <button
      type="button"
      className={className}
      onClick={() => setPreference(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Icon name={isDark ? 'sun' : 'moon'} />
    </button>
  );
}

// System / Light / Dark, in the profile dialog.
export function ThemeSwitcher() {
  const preference = useSyncExternalStore(subscribe, readPreference, preferenceOnServer);

  return (
    <div className="seg" role="radiogroup" aria-label="Appearance">
      {(['system', 'light', 'dark'] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={preference === option}
          className={preference === option ? 'on' : ''}
          onClick={() => setPreference(option)}
        >
          {option === 'light' && <Icon name="sun" />}
          {option === 'dark' && <Icon name="moon" />}
          {option[0].toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  );
}

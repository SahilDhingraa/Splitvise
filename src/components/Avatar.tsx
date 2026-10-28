import type { CSSProperties } from 'react';

// A coloured initials disc. The hue is derived from the name, so the same person
// gets the same colour in every room and on every device.
export function Avatar({ name, size }: { name: string; size?: 'sm' | 'lg' }) {
  return (
    <span
      className={`av${size ? ` av-${size}` : ''}`}
      style={{ '--h': hue(name) } as CSSProperties}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

function initials(name: string): string {
  return (
    (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || '?'
  );
}

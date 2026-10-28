'use client';

// Rendered client-side so the timestamp uses the viewer's locale and timezone.
// `suppressHydrationWarning` covers the expected server/client mismatch: the
// server does not know the visitor's timezone.
export function LocalTime({
  iso,
  format = 'datetime',
  relative,
}: {
  iso: string;
  format?: 'datetime' | 'time';
  relative?: boolean;
}) {
  const date = new Date(iso);
  const text = relative
    ? relativeTime(date)
    : format === 'time'
      ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : date.toLocaleString();

  return (
    <time dateTime={iso} title={date.toLocaleString()} suppressHydrationWarning>
      {text}
    </time>
  );
}

function relativeTime(date: Date): string {
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < 60) return 'just now';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)} h ago`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)} d ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

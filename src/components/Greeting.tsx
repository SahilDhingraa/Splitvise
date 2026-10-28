'use client';

import { useSyncExternalStore } from 'react';

const noop = () => () => {};

// "Good morning, Sahil" and today's date, in the viewer's own timezone. Both
// depend on the clock, so they render only once on the client; the server sends
// a neutral greeting so the heading never jumps in size.
export function Greeting({ name }: { name: string }) {
  const now = useSyncExternalStore(
    noop,
    () => new Date().toDateString(),
    () => null,
  );
  const date = now ? new Date() : null;
  const hour = date?.getHours();
  const hello =
    hour === undefined
      ? 'Hello'
      : hour < 12
        ? 'Good morning'
        : hour < 17
          ? 'Good afternoon'
          : 'Good evening';

  return (
    <div>
      <div className="eyebrow">
        {date?.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
      <h1 className="page-title">
        {hello}, {name}
      </h1>
    </div>
  );
}

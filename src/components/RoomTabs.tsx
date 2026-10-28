'use client';

import { createContext, useContext, useState } from 'react';

type Tab = { key: string; label: string; count: number; panel: React.ReactNode };

// A request from another tab to show one person's payments. `n` makes every
// request distinct, so asking for the same person twice still applies.
export type PaymentsRequest = { participantId: string; n: number };

const RoomTabsContext = createContext<{
  showPaymentsFor: (participantId: string) => void;
  request: PaymentsRequest | null;
} | null>(null);

export function useRoomTabs() {
  return useContext(RoomTabsContext);
}

// Activity / Settle up / People. Every panel is rendered on the server; this only
// chooses which one shows, so switching is instant and keeps each panel's state.
export function RoomTabs({ tabs }: { tabs: Tab[] }) {
  const [current, setCurrent] = useState(tabs[0]?.key);
  const [request, setRequest] = useState<PaymentsRequest | null>(null);

  function showPaymentsFor(participantId: string) {
    setRequest((previous) => ({ participantId, n: (previous?.n ?? 0) + 1 }));
    setCurrent('activity');
    window.scrollTo(0, 0);
  }

  return (
    <RoomTabsContext.Provider value={{ showPaymentsFor, request }}>
      <nav className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={current === tab.key}
            aria-controls={`panel-${tab.key}`}
            className={`tab${current === tab.key ? ' on' : ''}`}
            onClick={() => setCurrent(tab.key)}
          >
            {tab.label}
            <span className="count">{tab.count}</span>
          </button>
        ))}
      </nav>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`panel-${tab.key}`}
          aria-labelledby={`tab-${tab.key}`}
          hidden={current !== tab.key}
        >
          {tab.panel}
        </div>
      ))}
    </RoomTabsContext.Provider>
  );
}

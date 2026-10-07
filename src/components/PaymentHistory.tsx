'use client';

import { useState } from 'react';
import { PaymentRow } from './PaymentRow';
import type { Participant, Payment } from '@/lib/types';

export function PaymentHistory({
  roomId,
  payments,
  participants,
}: {
  roomId: string;
  payments: Payment[];
  participants: Participant[];
}) {
  const [selected, setSelected] = useState<string[]>([]);

  // Drop selections for people who are no longer in the room (removed or
  // merged away), so a stale id cannot leave the list silently filtered.
  const activeIds = selected.filter((id) => participants.some((p) => p.id === id));

  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  // Kept as the raw text so a half-typed value ("12.") stays in the box. An
  // empty or non-numeric bound means "no limit on that side".
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const min = parseBound(minText);
  const max = parseBound(maxText);

  // All filters apply together. The person filter is on who paid: matching on
  // the split too would be near-useless, since most payments are split among
  // everyone, so every person would match them all. Amount bounds are
  // inclusive, so "min 50" keeps a $50.00 payment.
  const visible = payments.filter(
    (payment) =>
      (activeIds.length === 0 || activeIds.includes(payment.payerId)) &&
      (query === '' || payment.description.toLowerCase().includes(query)) &&
      (min === null || payment.amount >= min) &&
      (max === null || payment.amount <= max),
  );

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  }

  const isFiltering = activeIds.length > 0 || query !== '' || min !== null || max !== null;

  return (
    <div className="section payment-history-section">
      <h2>
        📜 Payment History{' '}
        <span className="section-count">
          {isFiltering ? `${visible.length} of ${payments.length}` : payments.length}
        </span>
      </h2>

      {/* One row: name search on the left half, min/max amount on the right. */}
      {payments.length > 0 && (
        <div className="history-filters">
          <input
            type="search"
            className="payment-search"
            placeholder="🔍 Search by name…"
            aria-label="Search payments by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="amount-filter">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="Min $"
              aria-label="Minimum amount"
              value={minText}
              onChange={(event) => setMinText(event.target.value)}
            />
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="Max $"
              aria-label="Maximum amount"
              value={maxText}
              onChange={(event) => setMaxText(event.target.value)}
            />
          </div>
        </div>
      )}

      {participants.length > 1 && payments.length > 0 && (
        <div className="person-filter" role="group" aria-label="Filter payments by who paid">
          <span className="person-filter-label">Paid by:</span>
          {participants.map((participant) => {
            const isOn = activeIds.includes(participant.id);
            return (
              <button
                key={participant.id}
                type="button"
                className={`filter-chip${isOn ? ' active' : ''}`}
                aria-pressed={isOn}
                onClick={() => toggle(participant.id)}
              >
                {participant.name}
                {participant.isYou ? ' (you)' : ''}
              </button>
            );
          })}
          {activeIds.length > 0 && (
            <button type="button" className="filter-clear" onClick={() => setSelected([])}>
              Clear
            </button>
          )}
        </div>
      )}

      <ul className="payment-list">
        {payments.length === 0 ? (
          <li className="empty-state">No payments recorded yet.</li>
        ) : visible.length === 0 ? (
          <li className="empty-state">No payments match these filters.</li>
        ) : (
          visible.map((payment) => (
            <PaymentRow
              key={payment.id}
              roomId={roomId}
              payment={payment}
              participants={participants}
            />
          ))
        )}
      </ul>
    </div>
  );
}

function parseBound(text: string): number | null {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

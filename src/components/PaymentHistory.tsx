'use client';

import { useState } from 'react';
import { PaymentRow } from './PaymentRow';
import { isTransfer } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
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
  const [isExporting, setIsExporting] = useState(false);

  // The funnel button beside the heading shows and hides the filter controls.
  // While hidden, no filter applies, but what was typed or picked is kept, so
  // turning filters back on restores the same view.
  const [filtersOn, setFiltersOn] = useState(false);

  // Drop selections for people who are no longer in the room (removed or
  // merged away), so a stale id cannot leave the list silently filtered.
  const activeIds = filtersOn
    ? selected.filter((id) => participants.some((p) => p.id === id))
    : [];

  const [search, setSearch] = useState('');
  const query = filtersOn ? search.trim().toLowerCase() : '';

  // Kept as the raw text so a half-typed value ("12.") stays in the box. An
  // empty or non-numeric bound means "no limit on that side".
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const min = filtersOn ? parseBound(minText) : null;
  const max = filtersOn ? parseBound(maxText) : null;

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

  // How many of the three filters (person, search, amount) are set, for the
  // badge on the Filters button.
  const activeFilterCount =
    (activeIds.length > 0 ? 1 : 0) + (query !== '' ? 1 : 0) + (min !== null || max !== null ? 1 : 0);

  function resetFilters() {
    setSelected([]);
    setSearch('');
    setMinText('');
    setMaxText('');
  }

  // Totals respect every filter, so "Alice" + "min 50" sums only Alice's
  // payments of $50 or more. With several payers picked, each gets their own
  // subtotal alongside the combined figure.
  const visibleTotal = sumAmounts(visible);
  const allTotal = sumAmounts(payments);
  const payerTotals = participants
    .filter((participant) => activeIds.includes(participant.id))
    .map((participant) => ({
      participant,
      total: sumAmounts(visible.filter((payment) => payment.payerId === participant.id)),
    }))
    .sort((a, b) => b.total - a.total);

  // Share of everything the room has spent, so a total has some context.
  const shareOfAll = allTotal > 0 ? Math.round((visibleTotal / allTotal) * 100) : 0;
  const totalLabel =
    payerTotals.length === 1
      ? `Paid by ${displayName(payerTotals[0].participant)}`
      : payerTotals.length > 1
        ? `Paid by ${payerTotals.length} people`
        : 'Filtered total';

  // Exports exactly what the list shows, so filters double as an export query.
  // The library is loaded on click to keep it out of the page bundle.
  async function handleExport() {
    setIsExporting(true);
    try {
      const { exportPaymentsToExcel } = await import('@/lib/exportPayments');
      await exportPaymentsToExcel(visible);
    } catch {
      window.alert('Could not create the Excel file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="section payment-history-section">
      {/* Title on the left, actions on the right; on a phone the actions drop
          to their own row and split it evenly. */}
      <div className="history-header">
        <h2>
          📜 Payment History{' '}
          <span className="section-count">
            {isFiltering ? `${visible.length} of ${payments.length}` : payments.length}
          </span>
        </h2>
        <div className="history-actions">
          {payments.length > 0 && (
            <button
              type="button"
              className={`history-action filter-toggle${filtersOn ? ' active' : ''}`}
              aria-pressed={filtersOn}
              aria-expanded={filtersOn}
              aria-controls="payment-filter-panel"
              title={filtersOn ? 'Turn filters off' : 'Filter payments'}
              onClick={() => setFiltersOn((on) => !on)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h16M7 12h10M10 19h4" />
              </svg>
              Filters
              {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
            </button>
          )}
          {visible.length > 0 && (
            <button
              type="button"
              className="history-action"
              onClick={handleExport}
              disabled={isExporting}
              title={isFiltering ? 'Export the filtered payments' : 'Export all payments'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              {isExporting ? 'Exporting…' : 'Export Excel'}
            </button>
          )}
        </div>
      </div>

      {filtersOn && payments.length > 0 && (
        <div className="filter-panel" id="payment-filter-panel">
          <div className="filter-panel-head">
            <span>Filter payments</span>
            {activeFilterCount > 0 && (
              <button type="button" className="filter-reset" onClick={resetFilters}>
                Reset all
              </button>
            )}
          </div>

          {/* Search and amount range share a row; they stack on a phone. */}
          <div className="filter-fields">
            <div className="filter-field">
              <span className="filter-field-label">Description</span>
              <div className="filter-input">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  placeholder="Search payments…"
                  aria-label="Search payments by description"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="filter-field">
              <span className="filter-field-label">Amount</span>
              <div className="amount-range">
                <div className="filter-input">
                  <span className="filter-input-prefix" aria-hidden="true">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="Min"
                    aria-label="Minimum amount"
                    value={minText}
                    onChange={(event) => setMinText(event.target.value)}
                  />
                </div>
                <span className="amount-range-sep" aria-hidden="true">–</span>
                <div className="filter-input">
                  <span className="filter-input-prefix" aria-hidden="true">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="Max"
                    aria-label="Maximum amount"
                    value={maxText}
                    onChange={(event) => setMaxText(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {participants.length > 1 && (
            <div className="filter-field">
              <span className="filter-field-label">Paid by</span>
              <div className="person-filter" role="group" aria-label="Filter payments by who paid">
                {participants.map((participant) => {
                  const isOn = selected.includes(participant.id);
                  return (
                    <button
                      key={participant.id}
                      type="button"
                      className={`filter-chip${isOn ? ' active' : ''}`}
                      aria-pressed={isOn}
                      onClick={() => toggle(participant.id)}
                    >
                      {displayName(participant)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {isFiltering && visible.length > 0 && (
        <div className="filter-total" aria-live="polite">
          <div className="filter-total-head">
            <div>
              <p className="filter-total-label">{totalLabel}</p>
              <p className="filter-total-amount">{formatMoney(visibleTotal)}</p>
            </div>
            <div className="filter-total-meta">
              <span className="filter-total-share">{shareOfAll}%</span>
              <span>of all spending</span>
            </div>
          </div>

          <div
            className="share-bar"
            role="img"
            aria-label={`${shareOfAll}% of all spending`}
          >
            <span style={{ width: `${shareOfAll}%` }} />
          </div>

          <p className="filter-total-count">
            {visible.length} of {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
            {visible.length > 0 && ` · avg ${formatMoney(visibleTotal / visible.length)}`}
          </p>

          {payerTotals.length > 1 && (
            <ul className="filter-total-breakdown">
              {payerTotals.map(({ participant, total }) => {
                const share = visibleTotal > 0 ? (total / visibleTotal) * 100 : 0;
                return (
                  <li key={participant.id}>
                    <div className="breakdown-row">
                      <span className="breakdown-name">{displayName(participant)}</span>
                      <span className="breakdown-amount">{formatMoney(total)}</span>
                    </div>
                    <div className="share-bar thin" aria-hidden="true">
                      <span style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
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

// Spending only: cash handed between people is not money spent on the trip,
// so it would inflate every total and share it was added to.
function sumAmounts(list: Payment[]): number {
  return list.reduce(
    (sum, payment) => (isTransfer(payment) ? sum : sum + payment.amount),
    0,
  );
}

function displayName(participant: Participant): string {
  return participant.isYou ? `${participant.name} (you)` : participant.name;
}

function parseBound(text: string): number | null {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

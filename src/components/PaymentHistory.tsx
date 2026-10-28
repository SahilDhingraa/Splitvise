'use client';

import { useState, useSyncExternalStore } from 'react';
import { PaymentRow } from './PaymentRow';
import { Avatar } from './Avatar';
import { Menu } from './Menu';
import { useRoomTabs, type PaymentsRequest } from './RoomTabs';
import { Icon } from './Icon';
import { useDialog } from './Dialog';
import { isTransfer } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import type { Participant, Payment } from '@/lib/types';

type KindFilter = 'all' | 'expense' | 'transfer';

const noop = () => () => {};

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
  const { alert, dialog } = useDialog();

  // Day headings are in the viewer's timezone, which the server cannot know, so
  // the list is grouped only once it is running in the browser.
  const isClient = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  // Search and the expense/transfer switch sit in the toolbar and always apply.
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');

  // "Involving" sits in the toolbar too (a dropdown on desktop, inside the ⋯
  // menu on a phone): payments where the person paid, was in the split, or
  // received the money. Unlike "Paid by" below, it always applies.
  const [involving, setInvolving] = useState<string[]>([]);
  const involvingIds = involving.filter((id) => participants.some((p) => p.id === id));
  // The people list inside the phone ⋯ menu starts expanded when someone is
  // already picked, until it is opened or closed by hand.
  const [peopleOpenChoice, setPeopleOpen] = useState<boolean | null>(null);
  const peopleOpen = peopleOpenChoice ?? involvingIds.length > 0;

  // "Show their payments" on the People tab lands here with that one person
  // picked and the other toolbar filters cleared.
  const tabs = useRoomTabs();
  const [seenRequest, setSeenRequest] = useState<PaymentsRequest | null>(tabs?.request ?? null);
  if (tabs && tabs.request !== seenRequest) {
    setSeenRequest(tabs.request);
    if (tabs.request) {
      setInvolving([tabs.request.participantId]);
      setSearch('');
      setKindFilter('all');
    }
  }

  function toggleInvolving(id: string | null) {
    setInvolving((current) =>
      id === null ? [] : current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  }

  // The Filters button shows and hides the amount and payer filters. While
  // hidden, they do not apply, but what was typed or picked is kept, so turning
  // filters back on restores the same view.
  const [filtersOn, setFiltersOn] = useState(false);

  // Drop selections for people who are no longer in the room (removed or
  // merged away), so a stale id cannot leave the list silently filtered.
  const activeIds = filtersOn
    ? selected.filter((id) => participants.some((p) => p.id === id))
    : [];

  // Kept as the raw text so a half-typed value ("12.") stays in the box. An
  // empty or non-numeric bound means "no limit on that side".
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const min = filtersOn ? parseBound(minText) : null;
  const max = filtersOn ? parseBound(maxText) : null;

  // All filters apply together. The person filter is on who paid: matching on
  // the split too would be near-useless, since most payments are split among
  // everyone, so every person would match them all. Amount bounds are
  // inclusive, so "min 50" keeps a ₹50.00 payment.
  const visible = payments.filter(
    (payment) =>
      (kindFilter === 'all' || payment.kind === kindFilter) &&
      (activeIds.length === 0 || activeIds.includes(payment.payerId)) &&
      (involvingIds.length === 0 ||
        involvingIds.some((id) => payment.payerId === id || payment.splitAmongIds.includes(id))) &&
      (query === '' || payment.description.toLowerCase().includes(query)) &&
      (min === null || payment.amount >= min) &&
      (max === null || payment.amount <= max),
  );

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  }

  const isFiltering =
    kindFilter !== 'all' ||
    activeIds.length > 0 ||
    involvingIds.length > 0 ||
    query !== '' ||
    min !== null ||
    max !== null;

  // How many of the panel's filters (person, amount) are set, for the badge on
  // the Filters button.
  const panelFilterCount = (activeIds.length > 0 ? 1 : 0) + (min !== null || max !== null ? 1 : 0);

  function resetFilters() {
    setSelected([]);
    setInvolving([]);
    setSearch('');
    setMinText('');
    setMaxText('');
    setKindFilter('all');
  }

  // Totals respect every filter, so "Alice" + "min 50" sums only Alice's
  // payments of ₹50 or more. With several payers picked, each gets their own
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
      await alert({
        title: 'Export failed',
        message: 'Could not create the Excel file. Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  }

  if (payments.length === 0) {
    return (
      <div className="empty">
        <h3>Nothing recorded yet</h3>
        <p style={{ marginBottom: 0 }}>
          Add the first expense and the balances will work themselves out.
        </p>
      </div>
    );
  }

  return (
    <>
      {dialog}
      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input
            className="input"
            type="search"
            placeholder="Search payments"
            aria-label="Search payments by description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {/* Phones: filters and export fold into one ⋯ menu beside the search. */}
        <Menu
          wrapClassName="tb-mobile"
          label="Filter and export"
          buttonClassName={`btn btn-ghost btn-icon tb-more${involvingIds.length > 0 || panelFilterCount > 0 ? ' has-filter' : ''}`}
          button={<Icon name="more" />}
          menuClassName="menu-filter"
        >
          {(close) => (
            <>
              <button
                type="button"
                role="menuitem"
                disabled={isExporting || visible.length === 0}
                onClick={() => {
                  close();
                  handleExport();
                }}
              >
                <Icon name="download" />
                <span className="grow">{isExporting ? 'Exporting…' : 'Export spreadsheet'}</span>
              </button>
              <div className="menu-sep" />
              <button
                type="button"
                role="menuitem"
                className={`dd${peopleOpen ? ' open' : ''}`}
                aria-expanded={peopleOpen}
                onClick={() => setPeopleOpen(!peopleOpen)}
              >
                <Icon name="users" />
                <span className="grow">Filter by people</span>
                {involvingIds.length > 0 && <span className="count">{involvingIds.length}</span>}
                <span className="chev">
                  <Icon name="chevD" />
                </span>
              </button>
              {peopleOpen && (
                <div className="menu-sub">
                  <PeopleItems
                    participants={participants}
                    selected={involvingIds}
                    onToggle={toggleInvolving}
                  />
                </div>
              )}
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={filtersOn}
                className={filtersOn ? 'on' : ''}
                onClick={() => {
                  close();
                  setFiltersOn((on) => !on);
                }}
              >
                <Icon name="sliders" />
                <span className="grow">Amount &amp; payer filters</span>
                {panelFilterCount > 0 && <span className="count">{panelFilterCount}</span>}
                <span className="chk">{filtersOn && <Icon name="check" />}</span>
              </button>
            </>
          )}
        </Menu>

        <div className="seg seg-sm" role="radiogroup" aria-label="Payment type">
          {(
            [
              ['all', 'All'],
              ['expense', 'Expenses'],
              ['transfer', 'Transfers'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kindFilter === value}
              className={kindFilter === value ? 'on' : ''}
              onClick={() => setKindFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <Menu
          wrapClassName="tb-desktop"
          label="Filter by people"
          buttonClassName={`btn btn-ghost btn-sm tb-desktop people-btn${involvingIds.length > 0 ? ' on' : ''}`}
          button={
            <>
              <Icon name="users" />
              {involvingIds.length === 0
                ? 'Anyone'
                : `${involvingIds.length} ${involvingIds.length === 1 ? 'person' : 'people'}`}
              <Icon name="chevD" />
            </>
          }
          menuClassName="menu-filter"
        >
          {() => (
            <>
              <div className="menu-l">Payments involving</div>
              <PeopleItems
                participants={participants}
                selected={involvingIds}
                onToggle={toggleInvolving}
              />
            </>
          )}
        </Menu>

        <button
          type="button"
          className={`btn btn-sm tb-desktop ${filtersOn ? 'btn-soft' : 'btn-ghost'}`}
          aria-pressed={filtersOn}
          aria-expanded={filtersOn}
          aria-controls="payment-filter-panel"
          title={filtersOn ? 'Turn filters off' : 'Filter by amount or payer'}
          onClick={() => setFiltersOn((on) => !on)}
        >
          <Icon name="sliders" />
          Filters
          {panelFilterCount > 0 && <span className="count">{panelFilterCount}</span>}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm tb-desktop"
          onClick={handleExport}
          disabled={isExporting || visible.length === 0}
          title={isFiltering ? 'Export the filtered payments to Excel' : 'Export all payments to Excel'}
        >
          <Icon name="download" />
          {isExporting ? 'Exporting…' : 'Export'}
        </button>

        {involvingIds.length > 0 && (
          <div className="filt-row">
            <span className="filt-l">Involving</span>
            {involvingIds.map((id) => {
              const participant = participants.find((p) => p.id === id)!;
              return (
                <button
                  key={id}
                  type="button"
                  className="filt-chip"
                  aria-label={`Remove ${participant.name} from filter`}
                  onClick={() => toggleInvolving(id)}
                >
                  <Avatar name={participant.name} size="sm" />
                  {participant.name}
                  <Icon name="x" />
                </button>
              );
            })}
            {involvingIds.length > 1 && (
              <button type="button" className="filt-clear" onClick={() => toggleInvolving(null)}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {filtersOn && (
        <div className="card" id="payment-filter-panel" style={{ marginTop: 10, padding: 16 }}>
          <div className="form">
            <div className="field">
              <span className="label">Amount</span>
              <div className="two">
                <div className="amount-wrap">
                  <span className="cur" aria-hidden="true" style={{ fontSize: 14 }}>
                    ₹
                  </span>
                  <input
                    className="input"
                    style={{ paddingLeft: 30 }}
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
                <div className="amount-wrap">
                  <span className="cur" aria-hidden="true" style={{ fontSize: 14 }}>
                    ₹
                  </span>
                  <input
                    className="input"
                    style={{ paddingLeft: 30 }}
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

            {participants.length > 1 && (
              <div className="field">
                <span className="label">Paid by</span>
                <div className="chips" role="group" aria-label="Filter payments by who paid">
                  {participants.map((participant) => (
                    <label key={participant.id} className="chip">
                      <input
                        type="checkbox"
                        checked={selected.includes(participant.id)}
                        onChange={() => toggle(participant.id)}
                      />
                      <span style={{ paddingLeft: 7 }}>{displayName(participant)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isFiltering && visible.length > 0 && (
        <div className="card" aria-live="polite" style={{ marginTop: 12, padding: 16 }}>
          <div className="card-h" style={{ marginBottom: 6 }}>
            <div>
              <div className="label">{totalLabel}</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>
                {formatMoney(visibleTotal)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontWeight: 600 }}>
                {shareOfAll}%
              </div>
              <div className="hint">of all spending</div>
            </div>
          </div>

          <div className="bar" role="img" aria-label={`${shareOfAll}% of all spending`}>
            <i className="pos" style={{ width: `${shareOfAll}%` }} />
          </div>

          <div className="card-h" style={{ margin: '10px 0 0' }}>
            <p className="hint">
              {visible.length} of {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
              {` · avg ${formatMoney(visibleTotal / visible.length)}`}
            </p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
              Reset all
            </button>
          </div>

          {payerTotals.length > 1 && (
            <div style={{ marginTop: 10 }}>
              {payerTotals.map(({ participant, total }) => {
                const share = visibleTotal > 0 ? (total / visibleTotal) * 100 : 0;
                return (
                  <div key={participant.id} style={{ padding: '6px 0' }}>
                    <div className="kv">
                      <span>{displayName(participant)}</span>
                      <span className="num">{formatMoney(total)}</span>
                    </div>
                    <div className="bar" aria-hidden="true">
                      <i style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="scroll-area" style={{ marginTop: 6 }}>
        {visible.length === 0 ? (
          <div className="empty small" style={{ marginTop: 14 }}>
            <Icon name="search" />
            No payments match these filters.
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
              Reset
            </button>
          </div>
        ) : isClient ? (
          groupByDay(visible).map((group) => (
            <div key={group.label}>
              <div className="date-h">{group.label}</div>
              {group.payments.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  roomId={roomId}
                  payment={payment}
                  participants={participants}
                />
              ))}
            </div>
          ))
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
      </div>
    </>
  );
}

// "Anyone" plus a checkable row per person. Picking anyone clears the rest.
function PeopleItems({
  participants,
  selected,
  onToggle,
}: {
  participants: Participant[];
  selected: string[];
  onToggle: (id: string | null) => void;
}) {
  const item = (id: string | null, label: string, on: boolean, avatar?: React.ReactNode) => (
    <button
      key={id ?? ''}
      type="button"
      role="menuitemcheckbox"
      aria-checked={on}
      className={on ? 'on' : ''}
      onClick={() => onToggle(id)}
    >
      {avatar}
      <span className="grow">{label}</span>
      <span className="chk">{on && <Icon name="check" />}</span>
    </button>
  );

  return (
    <>
      {item(null, 'Anyone', selected.length === 0)}
      {participants.map((participant) =>
        item(
          participant.id,
          displayName(participant),
          selected.includes(participant.id),
          <Avatar name={participant.name} size="sm" />,
        ),
      )}
    </>
  );
}

// Consecutive payments under "Today", "Yesterday" or a date. The list arrives
// newest first, so each day's payments are already together.
function groupByDay(payments: Payment[]): { label: string; payments: Payment[] }[] {
  const groups: { label: string; payments: Payment[] }[] = [];
  for (const payment of payments) {
    const label = dayLabel(new Date(payment.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.payments.push(payment);
    else groups.push({ label, payments: [payment] });
  }
  return groups;
}

function dayLabel(date: Date): string {
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  });
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

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

  // "Paid by" sits in the toolbar too (a dropdown on desktop, inside the ⋯ menu
  // on a phone). It matches on who paid, not on who was in the split: most
  // payments are split among everyone, so every person would match them all.
  // Selections for people who are no longer in the room (removed or merged
  // away) are dropped, so a stale id cannot leave the list silently filtered.
  const [payers, setPayers] = useState<string[]>([]);
  const payerIds = payers.filter((id) => participants.some((p) => p.id === id));
  // The people list inside the phone ⋯ menu starts expanded when someone is
  // already picked, until it is opened or closed by hand.
  const [peopleOpenChoice, setPeopleOpen] = useState<boolean | null>(null);
  const peopleOpen = peopleOpenChoice ?? payerIds.length > 0;

  function togglePayer(id: string | null) {
    setPayers((current) =>
      id === null ? [] : current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  }

  // The Filters button shows and hides the amount filter. While hidden it does
  // not apply, but what was typed is kept, so turning filters back on restores
  // the same view.
  const [filtersOn, setFiltersOn] = useState(false);

  // Kept as the raw text so a half-typed value ("12.") stays in the box. An
  // empty or non-numeric bound means "no limit on that side".
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const min = filtersOn ? parseBound(minText) : null;
  const max = filtersOn ? parseBound(maxText) : null;

  // "Show payments they made" on the People tab lands here with that one person
  // picked and every other filter cleared, so nothing hides any of them.
  const tabs = useRoomTabs();
  const [seenRequest, setSeenRequest] = useState<PaymentsRequest | null>(tabs?.request ?? null);
  if (tabs && tabs.request !== seenRequest) {
    setSeenRequest(tabs.request);
    if (tabs.request) {
      setPayers([tabs.request.participantId]);
      setSearch('');
      setKindFilter('all');
      setMinText('');
      setMaxText('');
    }
  }

  // All filters apply together. Amount bounds are inclusive, so "min 50" keeps
  // a ₹50.00 payment.
  const visible = payments.filter(
    (payment) =>
      matchesKind(payment, kindFilter) &&
      (payerIds.length === 0 || payerIds.includes(payment.payerId)) &&
      (query === '' || matchesSearch(payment, query)) &&
      (min === null || payment.amount >= min) &&
      (max === null || payment.amount <= max),
  );

  const isFiltering =
    kindFilter !== 'all' ||
    payerIds.length > 0 ||
    query !== '' ||
    min !== null ||
    max !== null;

  // Whether the panel's amount filter is set, for the badge on the Filters button.
  const panelFilterCount = min !== null || max !== null ? 1 : 0;

  function resetFilters() {
    setPayers([]);
    setSearch('');
    setMinText('');
    setMaxText('');
    setKindFilter('all');
  }

  // Totals respect every filter, so "Alice" + "min 50" sums only Alice's
  // payments of ₹50 or more.
  //
  // The total is every rupee in the payments shown: expenses paid for plus
  // cash handed to someone. Each is also shown on its own line. "Given" uses
  // the same rule as the balances: a transfer, or an expense paid for exactly
  // one other person. With payers picked, the list holds only their payments,
  // so the total is what came out of their pocket, and each person gets their
  // own figure alongside the combined one.
  const personTotals = participants
    .filter((participant) => payerIds.includes(participant.id))
    .map((participant) => {
      const theirs = visible.filter((payment) => payment.payerId === participant.id);
      const given = sumWhere(theirs, isTransfer);
      const total = sumWhere(theirs, () => true);
      return { participant, expenses: total - given, given, total };
    })
    .sort((a, b) => b.total - a.total);

  const headline = sumWhere(visible, () => true);
  const headlineGiven = sumWhere(visible, isTransfer);
  const headlineExpenses = headline - headlineGiven;

  // Share of every rupee paid in the room -- all payments, whatever the
  // filters -- so a total always reads against the same yardstick.
  const outOf = sumWhere(payments, () => true);
  const shareOfAll = outOf > 0 ? Math.round((headline / outOf) * 100) : 0;
  const shareLabel = 'of all money paid';
  // Under Transfers every rupee shown was handed to someone, not spent.
  const verb = kindFilter === 'transfer' ? 'Given' : 'Spent';
  const totalLabel =
    personTotals.length === 1
      ? `${verb} by ${displayName(personTotals[0].participant)}`
      : personTotals.length > 1
        ? `${verb} by ${personTotals.length} people`
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
            placeholder="Search payments or people"
            aria-label="Search payments by description or person"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {/* Phones: filters and export fold into one ⋯ menu beside the search. */}
        <Menu
          wrapClassName="tb-mobile"
          label="Filter and export"
          buttonClassName={`btn btn-ghost btn-icon tb-more${payerIds.length > 0 || panelFilterCount > 0 ? ' has-filter' : ''}`}
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
                <span className="grow">Paid by</span>
                {payerIds.length > 0 && <span className="count">{payerIds.length}</span>}
                <span className="chev">
                  <Icon name="chevD" />
                </span>
              </button>
              {peopleOpen && (
                <div className="menu-sub">
                  <PeopleItems
                    participants={participants}
                    selected={payerIds}
                    onToggle={togglePayer}
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
                <span className="grow">Amount filter</span>
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
          label="Filter by who paid"
          buttonClassName={`btn btn-ghost btn-sm tb-desktop people-btn${payerIds.length > 0 ? ' on' : ''}`}
          button={
            <>
              <Icon name="users" />
              {payerIds.length === 0
                ? 'Anyone'
                : `${payerIds.length} ${payerIds.length === 1 ? 'person' : 'people'}`}
              <Icon name="chevD" />
            </>
          }
          menuClassName="menu-filter"
        >
          {() => (
            <>
              <div className="menu-l">Paid by</div>
              <PeopleItems
                participants={participants}
                selected={payerIds}
                onToggle={togglePayer}
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
          title={filtersOn ? 'Turn filters off' : 'Filter by amount'}
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

        {payerIds.length > 0 && (
          <div className="filt-row">
            <span className="filt-l">Paid by</span>
            {payerIds.map((id) => {
              const participant = participants.find((p) => p.id === id)!;
              return (
                <button
                  key={id}
                  type="button"
                  className="filt-chip"
                  aria-label={`Remove ${participant.name} from filter`}
                  onClick={() => togglePayer(id)}
                >
                  <Avatar name={participant.name} size="sm" />
                  {participant.name}
                  <Icon name="x" />
                </button>
              );
            })}
            {payerIds.length > 1 && (
              <button type="button" className="filt-clear" onClick={() => togglePayer(null)}>
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

          </div>
        </div>
      )}

      {isFiltering && visible.length > 0 && (
        <div className="card" aria-live="polite" style={{ marginTop: 12, padding: 16 }}>
          <div className="card-h" style={{ marginBottom: 6 }}>
            <div>
              <div className="label">{totalLabel}</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>
                {formatMoney(headline)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontWeight: 600 }}>
                {shareOfAll}%
              </div>
              <div className="hint">{shareLabel}</div>
            </div>
          </div>

          <div className="bar" role="img" aria-label={`${shareOfAll}% ${shareLabel}`}>
            <i className="pos" style={{ width: `${Math.min(shareOfAll, 100)}%` }} />
          </div>

          {headlineExpenses > 0 && headlineGiven > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="kv">
                <span>Paid for expenses</span>
                <span className="num">{formatMoney(headlineExpenses)}</span>
              </div>
              <div className="kv">
                <span>Given to people</span>
                <span className={`num${headlineGiven > 0 ? '' : ' muted'}`}>
                  {formatMoney(headlineGiven)}
                </span>
              </div>
            </div>
          )}

          <div className="card-h" style={{ margin: '10px 0 0' }}>
            <p className="hint">
              {`${visible.length} of ${payments.length} ${payments.length === 1 ? 'payment' : 'payments'}`}
              {` · avg ${formatMoney(headline / visible.length)}`}
            </p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
              Reset all
            </button>
          </div>

          {personTotals.length > 1 && (
            <div style={{ marginTop: 10 }}>
              {personTotals.map(({ participant, total, expenses, given }) => {
                const share = headline > 0 ? (total / headline) * 100 : 0;
                return (
                  <div key={participant.id} style={{ padding: '6px 0' }}>
                    <div className="kv">
                      <span>{displayName(participant)}</span>
                      <span className="num">{formatMoney(total)}</span>
                    </div>
                    <div className="hint">
                      {formatMoney(expenses)} on expenses · {formatMoney(given)} given
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

      <div className="scroll-area pay-box">
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

// Expenses and Transfers follow the same rule as the balances, not just how a
// payment was entered: an expense paid for exactly one other person is money
// handed to them, so it sits under Transfers with the rest of the cash given.
function matchesKind(payment: Payment, kind: KindFilter): boolean {
  if (kind === 'all') return true;
  return isTransfer(payment) === (kind === 'transfer');
}

// The description, who paid, or anyone in the split (or who received it).
function matchesSearch(payment: Payment, query: string): boolean {
  return [payment.description, payment.payer, ...payment.splitAmong].some((text) =>
    text.toLowerCase().includes(query),
  );
}

function sumWhere(list: Payment[], keep: (payment: Payment) => boolean): number {
  return list.reduce((sum, payment) => (keep(payment) ? sum + payment.amount : sum), 0);
}

function displayName(participant: Participant): string {
  return participant.isYou ? `${participant.name} (you)` : participant.name;
}

function parseBound(text: string): number | null {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

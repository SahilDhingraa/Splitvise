'use client';

import { useTransition } from 'react';
import { addPayment } from '@/app/actions';
import {
  calculateBalances,
  calculateSettlements,
  calculateTripCosts,
  isSettled,
} from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { useDialog } from './Dialog';
import type { Participant, Payment, Settlement } from '@/lib/types';

// Derived from participants + payments, so it recomputes on every render rather
// than sitting behind a "Calculate" button that can go stale.
export function BalanceSummary({
  roomId,
  participants,
  payments,
  isLocked,
}: {
  roomId: string;
  participants: Participant[];
  payments: Payment[];
  isLocked: boolean;
}) {
  const balances = calculateBalances(participants, payments);
  const settlements = calculateSettlements(balances);

  // Settlements are computed from every balance, but only the unsettled ones are
  // listed: someone whose share exactly covers what they paid has nothing to act
  // on, and a row of ₹0.00 lines buries the people who do.
  const outstanding = balances.filter((balance) => !isSettled(balance.amount));
  const largest = Math.max(1, ...outstanding.map((balance) => Math.abs(balance.amount)));

  const tripCosts = calculateTripCosts(participants, payments);
  const tripTotal = tripCosts.reduce((sum, entry) => sum + entry.cost, 0);

  // Balances are keyed by name, which is unique within a room.
  const byName = new Map(participants.map((participant) => [participant.name, participant]));

  if (payments.length === 0) {
    return (
      <div className="empty small">
        <Icon name="scale" />
        Record a payment to see who owes what.
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-h">
          <div className="card-t">
            <Icon name="swap" />
            Recommended settlements <span className="count">{settlements.length}</span>
          </div>
          <span className="hint">Fewest transfers that clear everything</span>
        </div>
        {settlements.length === 0 ? (
          <div className="empty small">
            <Icon name="sparkle" />
            All balances are settled!
          </div>
        ) : (
          <div className="settle-list">
            {settlements.map((settlement, index) => (
              <SettlementRow
                key={`${settlement.from}-${settlement.to}-${index}`}
                roomId={roomId}
                settlement={settlement}
                fromId={byName.get(settlement.from)?.id}
                toId={byName.get(settlement.to)?.id}
                isLocked={isLocked}
              />
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-t">
            <Icon name="scale" />
            Individual balances <span className="count">{outstanding.length}</span>
          </div>
          <span className="hint">
            <span className="pos">Green</span> gets money back, <span className="neg">red</span> still
            owes
          </span>
        </div>
        {outstanding.length === 0 ? (
          <div className="empty small">
            <Icon name="check" />
            Everyone is square.
          </div>
        ) : (
          outstanding.map((balance) => {
            const tone = balance.amount >= 0 ? 'pos' : 'neg';
            return (
              <div key={balance.participant} className="row bal">
                <Avatar name={balance.participant} />
                <div className="grow">
                  <div className="bal-top">
                    <div className="t">
                      {balance.participant}
                      {byName.get(balance.participant)?.isYou && <span className="pill">You</span>}
                    </div>
                    <div
                      className={`amt ${tone}`}
                      title={balance.amount >= 0 ? 'Should receive' : 'Owes'}
                    >
                      {balance.amount >= 0 ? '+' : '−'}
                      {formatMoney(Math.abs(balance.amount))}
                    </div>
                  </div>
                  <div className="bar">
                    <i
                      className={tone}
                      style={{ width: `${Math.round((Math.abs(balance.amount) / largest) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-t">
            <Icon name="receipt" />
            Trip cost per person
          </div>
          <div>
            <span className="hint">Total trip cost</span> <b className="num">{formatMoney(tripTotal)}</b>
          </div>
        </div>
        <p className="hint">
          Money out of each person&apos;s pocket: what they paid during the trip, minus cash they
          received, plus what they pay at the end (or minus what they get back).
        </p>

        <div className="cost-grid">
          {tripCosts.map((entry) => {
            // paid − received − share is the same figure as their balance:
            // positive means they get money back, negative means they pay in.
            const net = entry.paid - entry.received - entry.cost;
            const share = tripTotal > 0 ? (entry.cost / tripTotal) * 100 : 0;
            return (
              <div key={entry.participant} className="cost">
                <div className="cost-h">
                  <Avatar name={entry.participant} size="sm" />
                  <b>{entry.participant}</b>
                  <span className="pct">{Math.round(share)}% of trip</span>
                </div>

                {/* Paid − received ± the settlement = what it cost them. */}
                <div className="kv">
                  <span>Paid during trip</span>
                  <span className="num">{formatMoney(entry.paid)}</span>
                </div>
                <div className="kv">
                  <span>Received during trip</span>
                  <span className={`num${entry.received > 0 ? '' : ' muted'}`}>
                    − {formatMoney(entry.received)}
                  </span>
                </div>
                {isSettled(net) ? (
                  <div className="kv">
                    <span>Settle up at end</span>
                    <span className="num muted">nothing due</span>
                  </div>
                ) : net > 0 ? (
                  <div className="kv">
                    <span>Gets back at end</span>
                    <span className="num pos">− {formatMoney(net)}</span>
                  </div>
                ) : (
                  <div className="kv">
                    <span>Pays extra at end</span>
                    <span className="num neg">+ {formatMoney(-net)}</span>
                  </div>
                )}
                <div className="kv total">
                  <span>Trip cost them</span>
                  <span className="num">{formatMoney(entry.cost)}</span>
                </div>

                <div className="bar" aria-hidden="true">
                  <i style={{ width: `${share}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// One suggested transfer. "Mark paid" records it as money given, which clears
// exactly this debt from both balances.
function SettlementRow({
  roomId,
  settlement,
  fromId,
  toId,
  isLocked,
}: {
  roomId: string;
  settlement: Settlement;
  fromId: string | undefined;
  toId: string | undefined;
  isLocked: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  // Rounded to the paisa, since that is what the amount column stores.
  const amount = Math.round(settlement.amount * 100) / 100;

  const { confirm, alert, dialog } = useDialog();

  async function markPaid() {
    if (!fromId || !toId) return;
    const ok = await confirm({
      title: 'Mark as paid?',
      message: `Record that ${settlement.from} paid ${settlement.to} ${formatMoney(amount)}. This adds it to the room as money given.`,
      confirmLabel: 'Mark paid',
      icon: 'check',
    });
    if (!ok) return;

    const formData = new FormData();
    formData.set('kind', 'transfer');
    formData.set('payerId', fromId);
    formData.set('recipientId', toId);
    formData.set('amount', String(amount));
    formData.set('description', 'Settling up');

    startTransition(async () => {
      const result = await addPayment(roomId, { error: null }, formData);
      if (result.error) await alert({ title: 'Could not record it', message: result.error });
    });
  }

  return (
    <div className="settle">
      {dialog}
      <Avatar name={settlement.from} size="sm" />
      <div className="grow who">
        <b>{settlement.from}</b>
        <span className="arrow">→</span>
        <b>{settlement.to}</b>
      </div>
      <div className="amt neg">{formatMoney(settlement.amount)}</div>
      {!isLocked && fromId && toId && (
        <button type="button" className="btn btn-soft btn-sm" onClick={markPaid} disabled={isPending}>
          <Icon name="check" />
          {isPending ? 'Recording…' : 'Mark paid'}
        </button>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import {
  calculateBalances,
  calculateSettlements,
  calculateTripCosts,
  isSettled,
} from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import type { Participant, Payment } from '@/lib/types';

// Derived from participants + payments, so it recomputes on every render rather
// than sitting behind a "Calculate" button that can go stale.
export function BalanceSummary({
  participants,
  payments,
}: {
  participants: Participant[];
  payments: Payment[];
}) {
  // Starts collapsed to its heading so the room opens on recording payments;
  // the toggle beside the heading opens the cards.
  const [isOpen, setIsOpen] = useState(false);

  const balances = calculateBalances(participants, payments);
  const settlements = calculateSettlements(balances);

  // Settlements are computed from every balance, but only the unsettled ones are
  // listed: someone whose share exactly covers what they paid has nothing to act
  // on, and a row of $0.00 lines buries the people who do.
  const outstanding = balances.filter((balance) => !isSettled(balance.amount));

  const tripCosts = calculateTripCosts(participants, payments);
  const tripTotal = tripCosts.reduce((sum, entry) => sum + entry.cost, 0);

  return (
    <div className="section balance-section">
      <h2 className={isOpen ? undefined : 'collapsed'}>
        ⚖️ Balance Summary
        <button
          type="button"
          className="section-toggle"
          aria-expanded={isOpen}
          aria-controls="balance-summary-body"
          aria-label={isOpen ? 'Hide balance summary' : 'Show balance summary'}
          title={isOpen ? 'Hide' : 'Show'}
          onClick={() => setIsOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h2>

      {!isOpen ? null : payments.length === 0 ? (
        <div className="empty-state" id="balance-summary-body">
          Record a payment to see who owes what.
        </div>
      ) : (
        <div className="balance-grid" id="balance-summary-body">
          <div className="balance-card trip-cost-card">
            <div className="trip-cost-head">
              <h3>🧾 Trip Cost per Person</h3>
              <div className="trip-cost-total">
                <span>Total trip cost</span>
                <strong>{formatMoney(tripTotal)}</strong>
              </div>
            </div>
            <p className="trip-cost-note">
              Money out of each person&apos;s pocket: what they paid during the trip, minus cash
              they received, plus what they pay at the end (or minus what they get back).
            </p>

            <ul className="trip-cost-list">
              {tripCosts.map((entry) => {
                // paid − received − share is the same figure as their balance:
                // positive means they get money back, negative means they pay in.
                const net = entry.paid - entry.received - entry.cost;
                const share = tripTotal > 0 ? (entry.cost / tripTotal) * 100 : 0;
                return (
                  <li key={entry.participant} className="trip-cost-row">
                    <div className="trip-cost-top">
                      <span className="trip-cost-name">👤 {entry.participant}</span>
                      <span className="trip-cost-share">{Math.round(share)}% of trip</span>
                    </div>

                    {/* Paid − received ± the settlement = what it cost them. */}
                    <dl className="trip-cost-math">
                      <div>
                        <dt>Paid during trip</dt>
                        <dd>{formatMoney(entry.paid)}</dd>
                      </div>
                      <div>
                        <dt>Received during trip</dt>
                        <dd className={entry.received > 0 ? undefined : 'trip-cost-muted'}>
                          − {formatMoney(entry.received)}
                        </dd>
                      </div>
                      {isSettled(net) ? (
                        <div>
                          <dt>Settle up at end</dt>
                          <dd className="trip-cost-muted">nothing due</dd>
                        </div>
                      ) : net > 0 ? (
                        <div>
                          <dt>Gets back at end</dt>
                          <dd className="amount-positive">− {formatMoney(net)}</dd>
                        </div>
                      ) : (
                        <div>
                          <dt>Pays extra at end</dt>
                          <dd className="amount-negative">+ {formatMoney(-net)}</dd>
                        </div>
                      )}
                      <div className="trip-cost-result">
                        <dt>Trip cost them</dt>
                        <dd>{formatMoney(entry.cost)}</dd>
                      </div>
                    </dl>

                    <div className="share-bar thin trip-cost-bar" aria-hidden="true">
                      <span style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="balance-card">
            <h3>
              💳 Individual Balances <span className="section-count">{outstanding.length}</span>
            </h3>
            {outstanding.length === 0 ? (
              <div className="debt-item">✅ Everyone is square.</div>
            ) : (
              outstanding.map((balance) => (
                <div key={balance.participant} className="debt-item">
                  <span>👤 {balance.participant}</span>
                  <span className={balance.amount >= 0 ? 'amount-positive' : 'amount-negative'}>
                    {balance.amount >= 0
                      ? `Should receive ${formatMoney(balance.amount)}`
                      : `Owes ${formatMoney(Math.abs(balance.amount))}`}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="balance-card">
            <h3>
              🔄 Recommended Settlements{' '}
              <span className="section-count">{settlements.length}</span>
            </h3>
            {settlements.length === 0 ? (
              <div className="debt-item">✅ All balances are settled!</div>
            ) : (
              settlements.map((settlement, index) => (
                <div key={`${settlement.from}-${settlement.to}-${index}`} className="debt-item">
                  <span>
                    💸 {settlement.from} → {settlement.to}
                  </span>
                  <span className="amount-negative">{formatMoney(settlement.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

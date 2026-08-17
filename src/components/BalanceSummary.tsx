import { calculateBalances, calculateSettlements, isSettled } from '@/lib/balances';
import type { Participant, Payment } from '@/lib/types';

const money = (amount: number) => `$${amount.toFixed(2)}`;

// Derived from participants + payments, so it recomputes on every render rather
// than sitting behind a "Calculate" button that can go stale.
export function BalanceSummary({
  participants,
  payments,
}: {
  participants: Participant[];
  payments: Payment[];
}) {
  const balances = calculateBalances(participants, payments);
  const settlements = calculateSettlements(balances);

  // Settlements are computed from every balance, but only the unsettled ones are
  // listed: someone whose share exactly covers what they paid has nothing to act
  // on, and a row of $0.00 lines buries the people who do.
  const outstanding = balances.filter((balance) => !isSettled(balance.amount));

  return (
    <div className="section balance-section">
      <h2>⚖️ Balance Summary</h2>

      {payments.length === 0 ? (
        <div className="empty-state">Record a payment to see who owes what.</div>
      ) : (
        <div className="balance-grid">
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
                      ? `Should receive ${money(balance.amount)}`
                      : `Owes ${money(Math.abs(balance.amount))}`}
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
                  <span className="amount-negative">{money(settlement.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

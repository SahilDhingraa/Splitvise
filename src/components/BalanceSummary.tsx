import { calculateBalances, calculateSettlements } from '@/lib/balances';
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

  return (
    <div className="section balance-section">
      <h2>⚖️ Balance Summary</h2>

      {payments.length === 0 ? (
        <div className="empty-state">Record a payment to see who owes what.</div>
      ) : (
        <div className="balance-grid">
          <div className="balance-card">
            <h3>💳 Individual Balances</h3>
            {balances.map((balance) => (
              <div key={balance.participant} className="debt-item">
                <span>👤 {balance.participant}</span>
                <span className={balance.amount >= 0 ? 'amount-positive' : 'amount-negative'}>
                  {balance.amount >= 0
                    ? `Should receive ${money(balance.amount)}`
                    : `Owes ${money(Math.abs(balance.amount))}`}
                </span>
              </div>
            ))}
          </div>

          <div className="balance-card">
            <h3>🔄 Recommended Settlements</h3>
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

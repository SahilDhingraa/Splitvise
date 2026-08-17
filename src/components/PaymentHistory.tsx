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
  return (
    <div className="section payment-history-section">
      <h2>
        📜 Payment History <span className="section-count">{payments.length}</span>
      </h2>

      <ul className="payment-list">
        {payments.length === 0 ? (
          <li className="empty-state">No payments recorded yet.</li>
        ) : (
          payments.map((payment) => (
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

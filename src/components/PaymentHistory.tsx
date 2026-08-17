'use client';

import { useTransition } from 'react';
import { removePayment } from '@/app/actions';
import type { Payment } from '@/lib/types';

export function PaymentHistory({ roomId, payments }: { roomId: string; payments: Payment[] }) {
  const [isRemoving, startRemoving] = useTransition();

  function handleRemove(paymentId: string) {
    startRemoving(async () => {
      const result = await removePayment(roomId, paymentId);
      if (result.error) window.alert(result.error);
    });
  }

  return (
    <div className="section payment-history-section">
      <h2>📜 Payment History</h2>

      <ul className="payment-list">
        {payments.length === 0 ? (
          <li className="empty-state">No payments recorded yet.</li>
        ) : (
          payments.map((payment) => (
            <li key={payment.id} className="payment-item">
              <div>
                <strong>{payment.description}</strong>
                <div className="payment-details">
                  💰 ${payment.amount.toFixed(2)} paid by {payment.payer}
                  <br />
                  👥 Split among {payment.splitAmong.length}{' '}
                  {payment.splitAmong.length === 1 ? 'person' : 'people'}:{' '}
                  {payment.splitAmong.join(', ')}
                  <br />
                  🕒 <LocalTime iso={payment.createdAt} />
                </div>
              </div>

              {/* Mirrors the delete policy: the payment's creator, or the room
                  owner. Hiding the button is a courtesy; RLS is the real check. */}
              {payment.canDelete && (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => handleRemove(payment.id)}
                  disabled={isRemoving}
                >
                  Remove
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

// Rendered client-side so the timestamp uses the viewer's locale and timezone.
// `suppressHydrationWarning` covers the expected server/client mismatch: the
// server does not know the visitor's timezone.
function LocalTime({ iso }: { iso: string }) {
  return <span suppressHydrationWarning>{new Date(iso).toLocaleString()}</span>;
}

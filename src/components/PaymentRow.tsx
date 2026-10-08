'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { removePayment, updatePayment, type ActionResult } from '@/app/actions';
import { PaymentFields } from './PaymentFields';
import { isTransfer } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import type { Participant, Payment } from '@/lib/types';

const EMPTY: ActionResult = { error: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="inline-btn" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function PaymentRow({
  roomId,
  payment,
  participants,
}: {
  roomId: string;
  payment: Payment;
  participants: Participant[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isRemoving, startRemoving] = useTransition();

  const [state, formAction] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await updatePayment(roomId, payment.id, prev, formData);
    if (!result.error) setIsEditing(false);
    return result;
  }, EMPTY);

  function handleRemove() {
    const what =
      payment.kind === 'transfer'
        ? `${formatMoney(payment.amount)} given by ${payment.payer} to ${payment.splitAmong.join(', ')}`
        : `${formatMoney(payment.amount)} paid by ${payment.payer}`;
    const question = `Delete "${payment.description}" (${what})? Balances will be recalculated. This cannot be undone.`;
    if (!window.confirm(question)) return;

    startRemoving(async () => {
      const result = await removePayment(roomId, payment.id);
      if (result.error) window.alert(result.error);
    });
  }

  if (isEditing) {
    return (
      <li className="payment-item editing">
        <form action={formAction} className="payment-edit-form">
          <PaymentFields
            idPrefix={`edit-${payment.id}`}
            participants={participants}
            payment={payment}
          />

          {state.error && <p className="form-error">{state.error}</p>}

          <div className="row-actions">
            <SaveButton />
            <button
              type="button"
              className="secondary-btn inline-btn"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`payment-item${payment.kind === 'transfer' ? ' transfer-item' : ''}`}>
      <div>
        <strong>{payment.description}</strong>
        {payment.kind === 'transfer' ? (
          <span className="room-badge transfer-badge">💸 money given</span>
        ) : (
          isTransfer(payment) && (
            <span className="room-badge transfer-badge">
              💸 counts as received by {payment.splitAmong[0]}
            </span>
          )
        )}
        {/* Says an edit happened without claiming what changed -- the room has no
            history of previous values, so anything more would be invented. */}
        {payment.editedAt && <span className="room-badge muted-badge">✏️ edited</span>}
        <div className="payment-details">
          {payment.kind === 'transfer' ? (
            <>
              💸 <span className="payment-amount">{formatMoney(payment.amount)}</span> given by{' '}
              {payment.payer} → {payment.splitAmong.join(', ')}
            </>
          ) : (
            <>
              💰 <span className="payment-amount">{formatMoney(payment.amount)}</span> paid by{' '}
              {payment.payer}
              <br />
              👥 Split among {payment.splitAmong.length}{' '}
              {payment.splitAmong.length === 1 ? 'person' : 'people'}:{' '}
              {payment.splitAmong.join(', ')}
            </>
          )}
          <br />
          🕒 <LocalTime iso={payment.createdAt} />
          {payment.editedAt && (
            <>
              {' · edited '}
              <LocalTime iso={payment.editedAt} />
            </>
          )}
        </div>
      </div>

      {/* Mirrors the policies: the payment's creator, or the room owner. Hiding
          the buttons is a courtesy; RLS is the real check. */}
      <span className="row-actions">
        {payment.canEdit && (
          <button
            type="button"
            className="secondary-btn inline-btn"
            onClick={() => setIsEditing(true)}
            disabled={isRemoving}
          >
            Edit
          </button>
        )}
        {payment.canDelete && (
          <button type="button" className="remove-btn" onClick={handleRemove} disabled={isRemoving}>
            Remove
          </button>
        )}
      </span>
    </li>
  );
}

// Rendered client-side so the timestamp uses the viewer's locale and timezone.
// `suppressHydrationWarning` covers the expected server/client mismatch: the
// server does not know the visitor's timezone.
function LocalTime({ iso }: { iso: string }) {
  return <span suppressHydrationWarning>{new Date(iso).toLocaleString()}</span>;
}

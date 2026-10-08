'use client';

import { useState } from 'react';
import type { Participant, Payment, PaymentKind } from '@/lib/types';

// The payer/amount/description/split inputs, shared by recording a payment and
// editing one -- the two forms take the same fields and the same action shape,
// so they should not drift apart.
//
// `idPrefix` keeps label/input ids unique: the edit form appears inside a list,
// so several copies of these fields can be on the page at once.
export function PaymentFields({
  idPrefix,
  participants,
  payment,
}: {
  idPrefix: string;
  participants: Participant[];
  payment?: Payment;
}) {
  // Editing starts from what the payment actually says. "Everyone" only if the
  // existing split really does cover the current roster -- otherwise the radio
  // would claim a split the payment does not have.
  const coversEveryone =
    participants.length > 0 &&
    participants.every((participant) => payment?.splitAmongIds.includes(participant.id));

  const [kind, setKind] = useState<PaymentKind>(payment?.kind ?? 'expense');
  const isTransfer = kind === 'transfer';

  const [splitType, setSplitType] = useState<'all' | 'specific'>(
    payment && !coversEveryone ? 'specific' : 'all',
  );

  // Default the payer to you, since that is the overwhelmingly common case.
  const you = participants.find((participant) => participant.isYou);

  // For a transfer, default the recipient to the first person who is not the
  // giver, so the two selects do not start on the same name.
  const defaultGiver = payment?.payerId ?? you?.id ?? '';
  const defaultRecipient =
    (payment?.kind === 'transfer' ? payment.splitAmongIds[0] : undefined) ??
    participants.find((participant) => participant.id !== defaultGiver)?.id ??
    '';

  return (
    <>
      <input type="hidden" name="kind" value={kind} />
      <div className="kind-switch" role="radiogroup" aria-label="What are you recording?">
        <button
          type="button"
          role="radio"
          aria-checked={!isTransfer}
          className={!isTransfer ? 'active' : ''}
          onClick={() => setKind('expense')}
        >
          🧾 Expense
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isTransfer}
          className={isTransfer ? 'active' : ''}
          onClick={() => setKind('transfer')}
        >
          💸 Money given
        </button>
      </div>
      {isTransfer && (
        <p className="kind-hint">
          Cash handed to someone during the trip, like paying them back early. It settles balances
          but isn&apos;t counted as anyone&apos;s trip spending.
        </p>
      )}

      <div className="form-group">
        <label htmlFor={`${idPrefix}-payer`}>{isTransfer ? 'Who Gave:' : 'Who Paid:'}</label>
        <select id={`${idPrefix}-payer`} name="payerId" defaultValue={defaultGiver} required>
          <option value="" disabled>
            {isTransfer ? 'Select who gave' : 'Select payer'}
          </option>
          {participants.map((participant) => (
            <option key={participant.id} value={participant.id}>
              {participant.name}
              {participant.isYou ? ' (you)' : ''}
            </option>
          ))}
        </select>
      </div>

      {isTransfer && (
        <div className="form-group">
          <label htmlFor={`${idPrefix}-recipient`}>Given To:</label>
          <select
            id={`${idPrefix}-recipient`}
            name="recipientId"
            defaultValue={defaultRecipient}
            required
          >
            <option value="" disabled>
              Select who received
            </option>
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name}
                {participant.isYou ? ' (you)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="form-group">
        <label htmlFor={`${idPrefix}-amount`}>Amount:</label>
        <input
          id={`${idPrefix}-amount`}
          name="amount"
          type="number"
          placeholder="0.00"
          step="0.01"
          min="0.01"
          defaultValue={payment?.amount ?? ''}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${idPrefix}-description`}>
          {isTransfer ? 'Note (optional):' : 'Description:'}
        </label>
        <input
          id={`${idPrefix}-description`}
          name="description"
          type="text"
          placeholder={isTransfer ? 'e.g. Paid back for hotel' : 'What was this payment for?'}
          defaultValue={payment?.description ?? ''}
          required={!isTransfer}
        />
      </div>

      {!isTransfer && (
        <div className="form-group">
          <label>Split Among:</label>

          <div className="radio-row">
            <input
              type="radio"
              id={`${idPrefix}-split-all`}
              name="splitType"
              value="all"
              checked={splitType === 'all'}
              onChange={() => setSplitType('all')}
            />
            <label htmlFor={`${idPrefix}-split-all`} className="inline-label">
              Everyone in the room
            </label>
          </div>

          <div className="radio-row">
            <input
              type="radio"
              id={`${idPrefix}-split-specific`}
              name="splitType"
              value="specific"
              checked={splitType === 'specific'}
              onChange={() => setSplitType('specific')}
            />
            <label htmlFor={`${idPrefix}-split-specific`} className="inline-label">
              Specific people
            </label>
          </div>

          {splitType === 'specific' && (
            <div className="checkbox-group">
              {participants.map((participant) => (
                <label key={participant.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    name="splitAmong"
                    value={participant.id}
                    defaultChecked={payment?.splitAmongIds.includes(participant.id)}
                  />
                  <span>{participant.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

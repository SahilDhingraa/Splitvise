'use client';

import { useState } from 'react';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { formatMoney } from '@/lib/money';
import type { Participant, Payment, PaymentKind } from '@/lib/types';

// The payer/amount/description/split inputs, shared by recording a payment and
// editing one -- the two forms take the same fields and the same action shape,
// so they should not drift apart.
//
// `idPrefix` keeps label/input ids unique: the inline form and the phone sheet
// can both be on the page at once.
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
  // existing split really does cover the current roster -- otherwise the toggle
  // would claim a split the payment does not have.
  const coversEveryone =
    participants.length > 0 &&
    participants.every((participant) => payment?.splitAmongIds.includes(participant.id));

  const [kind, setKind] = useState<PaymentKind>(payment?.kind ?? 'expense');
  const isTransfer = kind === 'transfer';

  const [splitType, setSplitType] = useState<'all' | 'specific'>(
    payment && !coversEveryone ? 'specific' : 'all',
  );

  // Who is ticked under "Specific people". A new payment starts with everyone
  // ticked, so narrowing it down is a matter of unticking.
  const [picked, setPicked] = useState<string[]>(() =>
    payment && payment.kind === 'expense'
      ? payment.splitAmongIds
      : participants.map((participant) => participant.id),
  );

  // Held only to show the per-person preview under the split.
  const [amountText, setAmountText] = useState(payment ? String(payment.amount) : '');

  // Default the payer to you, since that is the overwhelmingly common case.
  const you = participants.find((participant) => participant.isYou);

  // For a transfer, default the recipient to the first person who is not the
  // giver, so the two selects do not start on the same name.
  const defaultGiver = payment?.payerId ?? you?.id ?? '';
  const defaultRecipient =
    (payment?.kind === 'transfer' ? payment.splitAmongIds[0] : undefined) ??
    participants.find((participant) => participant.id !== defaultGiver)?.id ??
    '';

  const option = (participant: Participant) => (
    <option key={participant.id} value={participant.id}>
      {participant.name}
      {participant.isYou ? ' (you)' : ''}
    </option>
  );

  const splitCount = splitType === 'all' ? participants.length : picked.length;
  const amount = Number(amountText);
  const preview =
    splitCount === 0
      ? 'Choose at least one person.'
      : amount > 0
        ? `${formatMoney(amount / splitCount)} each · ${splitCount} ${splitCount === 1 ? 'person' : 'people'}`
        : `Split evenly between ${splitCount} ${splitCount === 1 ? 'person' : 'people'}.`;

  const payerSelect = (
    <div className="field">
      <label className="label" htmlFor={`${idPrefix}-payer`}>
        {isTransfer ? 'Who gave' : 'Who paid'}
      </label>
      <select
        id={`${idPrefix}-payer`}
        name="payerId"
        className="select"
        defaultValue={defaultGiver}
        required
      >
        <option value="" disabled>
          {isTransfer ? 'Select who gave' : 'Select payer'}
        </option>
        {participants.map(option)}
      </select>
    </div>
  );

  return (
    <>
      <input type="hidden" name="kind" value={kind} />
      <div className="seg" role="radiogroup" aria-label="What are you recording?">
        <button
          type="button"
          role="radio"
          aria-checked={!isTransfer}
          className={!isTransfer ? 'on' : ''}
          onClick={() => setKind('expense')}
        >
          <Icon name="receipt" />
          Expense
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isTransfer}
          className={isTransfer ? 'on' : ''}
          onClick={() => setKind('transfer')}
        >
          <Icon name="arrowR" />
          Money given
        </button>
      </div>
      {isTransfer && (
        <p className="hint">
          Cash handed to someone during the trip, like paying them back early. It settles balances
          but isn&apos;t counted as anyone&apos;s trip spending.
        </p>
      )}

      {isTransfer ? (
        <div className="two">
          {payerSelect}
          <div className="field">
            <label className="label" htmlFor={`${idPrefix}-recipient`}>
              Given to
            </label>
            <select
              id={`${idPrefix}-recipient`}
              name="recipientId"
              className="select"
              defaultValue={defaultRecipient}
              required
            >
              <option value="" disabled>
                Select who received
              </option>
              {participants.map(option)}
            </select>
          </div>
        </div>
      ) : (
        payerSelect
      )}

      <div className="field">
        <label className="label" htmlFor={`${idPrefix}-amount`}>
          Amount
        </label>
        <div className="amount-wrap">
          <span className="cur" aria-hidden="true">
            ₹
          </span>
          <input
            id={`${idPrefix}-amount`}
            name="amount"
            type="number"
            inputMode="decimal"
            className="input amount"
            placeholder="0.00"
            step="0.01"
            min="0.01"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor={`${idPrefix}-description`}>
          {isTransfer ? (
            <>
              Note <span className="opt">optional</span>
            </>
          ) : (
            'What was it for'
          )}
        </label>
        <input
          id={`${idPrefix}-description`}
          name="description"
          type="text"
          className="input"
          maxLength={80}
          placeholder={isTransfer ? 'e.g. Paid back for hotel' : 'Dinner, fuel, hotel…'}
          defaultValue={payment?.description ?? ''}
          required={!isTransfer}
        />
      </div>

      {!isTransfer && (
        <div className="field">
          <span className="label">Split among</span>
          <input type="hidden" name="splitType" value={splitType} />
          <div className="seg" role="radiogroup" aria-label="Split among">
            <button
              type="button"
              role="radio"
              aria-checked={splitType === 'all'}
              className={splitType === 'all' ? 'on' : ''}
              onClick={() => setSplitType('all')}
            >
              Everyone
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={splitType === 'specific'}
              className={splitType === 'specific' ? 'on' : ''}
              onClick={() => setSplitType('specific')}
            >
              Specific people
            </button>
          </div>

          {splitType === 'specific' && (
            <div className="chips" style={{ marginTop: 10 }}>
              {participants.map((participant) => (
                <label key={participant.id} className="chip">
                  <Avatar name={participant.name} size="sm" />
                  <input
                    type="checkbox"
                    name="splitAmong"
                    value={participant.id}
                    checked={picked.includes(participant.id)}
                    onChange={(event) =>
                      setPicked((current) =>
                        event.target.checked
                          ? [...current, participant.id]
                          : current.filter((id) => id !== participant.id),
                      )
                    }
                  />
                  {participant.name}
                </label>
              ))}
            </div>
          )}

          <p className="hint">{preview}</p>
        </div>
      )}
    </>
  );
}

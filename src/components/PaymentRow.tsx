'use client';

import { useActionState, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { removePayment, updatePayment, type ActionResult } from '@/app/actions';
import { PaymentFields } from './PaymentFields';
import { LocalTime } from './LocalTime';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { Menu } from './Menu';
import { Avatar } from './Avatar';
import { useDialog } from './Dialog';
import { isTransfer } from '@/lib/balances';
import { formatMoney, formatMoneyShort } from '@/lib/money';
import type { Participant, Payment } from '@/lib/types';

const EMPTY: ActionResult = { error: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
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
  const [isOpen, setIsOpen] = useState(false);
  const [isRemoving, startRemoving] = useTransition();

  const { confirm, alert, dialog } = useDialog();

  async function handleRemove() {
    const what =
      payment.kind === 'transfer'
        ? `${formatMoney(payment.amount)} given by ${payment.payer} to ${payment.splitAmong.join(', ')}`
        : `${formatMoney(payment.amount)} paid by ${payment.payer}`;
    const ok = await confirm({
      title: `Delete “${payment.description}”?`,
      message: `${what}. Balances will be recalculated. This cannot be undone.`,
      confirmLabel: 'Delete payment',
      icon: 'trash',
      danger: true,
    });
    if (!ok) return;

    startRemoving(async () => {
      const result = await removePayment(roomId, payment.id);
      if (result.error) await alert({ title: 'Could not delete the payment', message: result.error });
      else setIsEditing(false);
    });
  }

  const isGiven = payment.kind === 'transfer';
  const count = payment.splitAmong.length;
  const everyone =
    participants.length > 0 &&
    participants.every((participant) => payment.splitAmongIds.includes(participant.id));
  const names = payment.splitAmong;
  // Every name when it fits on the line; otherwise "everyone" or "4 people".
  const fullNames =
    count <= 2 ? names.join(' & ') : `${names.slice(0, -1).join(', ')} & ${names[count - 1]}`;
  const shortNames = everyone ? 'everyone' : count <= 2 ? names.join(' & ') : `${count} people`;

  // Desktop shows every name in the split when they fit on one line, and falls
  // back to the short form when they would be cut off. Phones always use the
  // short form (CSS), so there is nothing to measure there.
  const sublineRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = sublineRef.current;
    if (!el) return;
    const fit = () => {
      el.classList.remove('short');
      if (window.innerWidth > 640 && el.scrollWidth > el.clientWidth + 1) el.classList.add('short');
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [payment, fullNames]);

  const toggle = () => setIsOpen((open) => !open);
  const canAct = payment.canEdit || payment.canDelete;

  return (
    <div className={`pay-item${isOpen ? ' open' : ''}`}>
      <div
        className="row act pay"
        data-click=""
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={toggle}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
            event.preventDefault();
            toggle();
          }
        }}
      >
        <div className={`act-ico ${isGiven ? 'transfer' : 'expense'}`}>
          <Icon name={isGiven ? 'arrowR' : 'receipt'} />
        </div>

        <div className="t">
          {payment.description || (isGiven ? 'Money given' : 'Expense')}
          {!isGiven && isTransfer(payment) && (
            <span className="pill pill-accent">counts as received by {payment.splitAmong[0]}</span>
          )}
          {/* Says an edit happened without claiming what changed -- the room has
              no history of previous values, so anything more would be invented. */}
          {payment.editedAt && (
            <span className="pill" title={new Date(payment.editedAt).toLocaleString()}>
              <Icon name="edit" />
              edited
            </span>
          )}
        </div>
        <div className="s subline" ref={sublineRef}>
          {isGiven ? (
            <>
              <b>{payment.payer}</b> gave <b>{payment.splitAmong.join(', ')}</b>
            </>
          ) : (
            <>
              <b>{payment.payer}</b> paid · <span className="nm-full">{fullNames}</span>
              <span className="nm-short">{shortNames}</span>
              {count > 0 && ` · ${formatMoneyShort(payment.amount / count)} each`}
            </>
          )}
          <span className="exp">
            <Icon name="chevD" />
          </span>
        </div>

        <div className="amt">
          {formatMoneyShort(payment.amount)}
          <div className="s time">
            <LocalTime iso={payment.createdAt} format="time" />
          </div>
        </div>

        {/* Mirrors the policies: the payment's creator, or the room owner, and
            never while locked. Hiding the controls is a courtesy; RLS is the
            real check. */}
        {canAct && (
          <Menu
            wrapClassName="acts"
            label="Payment options"
            buttonClassName="btn btn-ghost btn-sm btn-icon"
            button={<Icon name="more" />}
          >
            {(close) => (
              <>
                {payment.canEdit && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isRemoving}
                    onClick={() => {
                      close();
                      setIsEditing(true);
                    }}
                  >
                    <Icon name="edit" />
                    Edit
                  </button>
                )}
                {payment.canDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    disabled={isRemoving}
                    onClick={() => {
                      close();
                      handleRemove();
                    }}
                  >
                    <Icon name="trash" />
                    Remove
                  </button>
                )}
              </>
            )}
          </Menu>
        )}
      </div>

      {isOpen && (
        <PaymentDetail
          payment={payment}
          isRemoving={isRemoving}
          onEdit={() => setIsEditing(true)}
          onRemove={handleRemove}
        />
      )}

      {dialog}

      {isEditing && (
        <Modal onClose={() => setIsEditing(false)}>
          <EditPaymentForm
            roomId={roomId}
            payment={payment}
            participants={participants}
            isRemoving={isRemoving}
            onRemove={handleRemove}
            onDone={() => setIsEditing(false)}
          />
        </Modal>
      )}
    </div>
  );
}

// The expanded view under a row: who gave what to whom, or what each person in
// the split owes for it.
function PaymentDetail({
  payment,
  isRemoving,
  onEdit,
  onRemove,
}: {
  payment: Payment;
  isRemoving: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const header = (title: string) => (
    <div className="pd-h">
      <span>{title}</span>
      <span>
        <LocalTime iso={payment.createdAt} />
        {payment.editedAt && (
          <>
            {' · edited '}
            <LocalTime iso={payment.editedAt} />
          </>
        )}
      </span>
    </div>
  );

  const acts = (payment.canEdit || payment.canDelete) && (
    <div className="pd-acts">
      {payment.canEdit && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit} disabled={isRemoving}>
          <Icon name="edit" />
          Edit
        </button>
      )}
      {payment.canDelete && (
        <button type="button" className="btn btn-danger btn-sm" onClick={onRemove} disabled={isRemoving}>
          <Icon name="trash" />
          {isRemoving ? 'Removing…' : 'Remove'}
        </button>
      )}
    </div>
  );

  if (payment.kind === 'transfer') {
    const recipient = payment.splitAmong[0] ?? 'Someone';
    return (
      <div className="pay-detail">
        {header('Money given')}
        <div className="pd-row">
          <Avatar name={payment.payer} size="sm" />
          <span className="grow">
            <b>{payment.payer}</b> gave
          </span>
          <span className="amt">{formatMoney(payment.amount)}</span>
        </div>
        <div className="pd-row">
          <Avatar name={recipient} size="sm" />
          <span className="grow">
            <b>{recipient}</b> received
          </span>
          <span className="amt">{formatMoney(payment.amount)}</span>
        </div>
        {payment.description && <div className="pd-note">{payment.description}</div>}
        {acts}
      </div>
    );
  }

  const count = payment.splitAmongIds.length;
  const each = count > 0 ? payment.amount / count : 0;
  const payerInSplit = payment.splitAmongIds.includes(payment.payerId);
  const paidPill = (
    <span className="pill pill-accent">paid {formatMoneyShort(payment.amount)}</span>
  );

  return (
    <div className="pay-detail">
      {header(`Split between ${count} ${count === 1 ? 'person' : 'people'}`)}
      {payment.splitAmongIds.map((id, index) => (
        <div key={id} className="pd-row">
          <Avatar name={payment.splitAmong[index]} size="sm" />
          <span className="grow">
            <b>{payment.splitAmong[index]}</b>
            {id === payment.payerId && paidPill}
          </span>
          <span className="amt">{formatMoney(each)}</span>
        </div>
      ))}
      {!payerInSplit && (
        <div className="pd-row">
          <Avatar name={payment.payer} size="sm" />
          <span className="grow">
            <b>{payment.payer}</b>
            {paidPill} · not in the split
          </span>
          <span className="amt muted">{formatMoney(0)}</span>
        </div>
      )}
      {acts}
    </div>
  );
}

function EditPaymentForm({
  roomId,
  payment,
  participants,
  isRemoving,
  onRemove,
  onDone,
}: {
  roomId: string;
  payment: Payment;
  participants: Participant[];
  isRemoving: boolean;
  onRemove: () => void;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await updatePayment(roomId, payment.id, prev, formData);
    if (!result.error) onDone();
    return result;
  }, EMPTY);

  return (
    <>
      <div className="card-h">
        <div className="card-t">
          <Icon name="card" />
          Edit payment
        </div>
      </div>
      <form action={formAction} className="form">
        <PaymentFields
          idPrefix={`edit-${payment.id}`}
          participants={participants}
          payment={payment}
        />

        {state.error && <p className="err">{state.error}</p>}

        <div className="form-acts">
          {payment.canDelete && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={onRemove}
              disabled={isRemoving}
            >
              <Icon name="trash" />
              Remove
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onDone}>
            Cancel
          </button>
          <SaveButton />
        </div>
      </form>
    </>
  );
}

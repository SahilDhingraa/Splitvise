'use client';

import { useCallback, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { Modal } from './Modal';

// In-app replacements for window.confirm / prompt / alert, styled like every
// other dialog. Each call returns a promise, so callers read top to bottom:
//
//   const { confirm, alert, dialog } = useDialog();
//   if (!(await confirm({ title: 'Remove Asha?', message: '…', danger: true }))) return;
//   …
//   return <>…{dialog}</>;

type ConfirmOptions = {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  icon?: IconName;
  // Red confirm button, for things that destroy data.
  danger?: boolean;
  // When set, the confirm button stays disabled until this exact text is typed.
  // For actions a misplaced tap should never be enough to trigger.
  typeToConfirm?: string;
};

type AlertOptions = { title: string; message: React.ReactNode };

type Request =
  | ({ kind: 'confirm' } & ConfirmOptions & { resolve: (ok: boolean) => void })
  | ({ kind: 'alert' } & AlertOptions & { resolve: () => void });

export function useDialog() {
  const [request, setRequest] = useState<Request | null>(null);
  // The open request's resolver, so a dialog replaced by another still settles.
  const pending = useRef<Request | null>(null);

  const open = useCallback((next: Request) => {
    const previous = pending.current;
    if (previous?.kind === 'confirm') previous.resolve(false);
    else previous?.resolve();
    pending.current = next;
    setRequest(next);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => open({ kind: 'confirm', ...options, resolve })),
    [open],
  );

  const alert = useCallback(
    (options: AlertOptions) =>
      new Promise<void>((resolve) => open({ kind: 'alert', ...options, resolve })),
    [open],
  );

  function close(ok: boolean) {
    const current = pending.current;
    pending.current = null;
    setRequest(null);
    if (current?.kind === 'confirm') current.resolve(ok);
    else current?.resolve();
  }

  const dialog = request ? (
    <Modal onClose={() => close(false)}>
      {request.kind === 'confirm' ? (
        <ConfirmBody request={request} onAnswer={close} />
      ) : (
        <>
          <h3 className="modal-t">{request.title}</h3>
          <div className="modal-p">{request.message}</div>
          <div className="modal-acts">
            <button type="button" className="btn btn-primary" onClick={() => close(true)}>
              OK
            </button>
          </div>
        </>
      )}
    </Modal>
  ) : null;

  return { confirm, alert, dialog };
}

function ConfirmBody({
  request,
  onAnswer,
}: {
  request: ConfirmOptions;
  onAnswer: (ok: boolean) => void;
}) {
  const [typed, setTyped] = useState('');
  const blocked = request.typeToConfirm !== undefined && typed !== request.typeToConfirm;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!blocked) onAnswer(true);
      }}
    >
      <h3 className="modal-t">{request.title}</h3>
      <div className="modal-p">{request.message}</div>

      {request.typeToConfirm !== undefined && (
        <div className="field">
          <label className="label" htmlFor="confirm-typed">
            Type <span className="opt">“{request.typeToConfirm}”</span> to confirm
          </label>
          <input
            id="confirm-typed"
            className="input"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
      )}

      <div className="modal-acts">
        <button type="button" className="btn btn-ghost" onClick={() => onAnswer(false)}>
          Cancel
        </button>
        <button
          type="submit"
          className={`btn ${request.danger ? 'btn-danger-solid' : 'btn-primary'}`}
          disabled={blocked}
        >
          {request.icon && <Icon name={request.icon} />}
          {request.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </form>
  );
}

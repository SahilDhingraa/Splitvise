'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { deleteRoom, leaveRoom, renameRoom, setRoomLock } from '@/app/actions';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { useDialog } from './Dialog';
import type { Room } from '@/lib/types';

// The "⋯" menu for a room, on its card and in its header. Owner-only items mirror
// RLS: they decide what to show, the database decides what is permitted.
export function RoomMenu({
  room,
  buttonClassName,
  onMerge,
}: {
  room: Room;
  buttonClassName: string;
  // Present only where merging is possible (the room page, with two or more
  // people). Hidden while locked, mirroring what merge_participants refuses.
  onMerge?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const { confirm, alert, dialog } = useDialog();

  // Close on any click outside the menu, or on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  function choose(action: () => void) {
    setIsOpen(false);
    action();
  }

  async function handleLock() {
    const ok = await confirm(
      room.isLocked
        ? {
            title: `Unlock ${room.name}?`,
            message: 'Everyone will be able to record and remove payments again.',
            confirmLabel: 'Unlock room',
            icon: 'unlock',
          }
        : {
            title: `Lock ${room.name}?`,
            message:
              'Nobody — including you — can record or remove payments, or change who is in the room, until you unlock it. People can still open the room and read it.',
            confirmLabel: 'Lock room',
            icon: 'lock',
          },
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await setRoomLock(room.id, !room.isLocked);
      if (result.error) await alert({ title: 'Could not change the lock', message: result.error });
    });
  }

  async function handleDelete() {
    // Typing the name, rather than an OK/Cancel confirm. This wipes every payment
    // and balance in the room for everyone in it, and it cannot be undone -- a
    // misplaced click should not be enough to do that.
    const ok = await confirm({
      title: `Delete ${room.name}?`,
      message:
        'This permanently removes every payment and balance in it, for everyone in the room. This cannot be undone.',
      confirmLabel: 'Delete room',
      icon: 'trash',
      danger: true,
      typeToConfirm: room.name,
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteRoom(room.id);
      if (result?.error) await alert({ title: 'Could not delete the room', message: result.error });
    });
  }

  async function handleLeave() {
    const ok = await confirm({
      title: `Leave ${room.name}?`,
      message: 'Payments you recorded stay in the room.',
      confirmLabel: 'Leave room',
      icon: 'logout',
      danger: true,
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await leaveRoom(room.id);
      if (result?.error) await alert({ title: 'Could not leave the room', message: result.error });
    });
  }

  return (
    <div
      className="menu-wrap"
      ref={wrapRef}
      // The menu sits inside a clickable room card; keep its clicks to itself.
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={buttonClassName}
        aria-label="Room options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={isPending}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Icon name="more" />
      </button>

      {isOpen && (
        <div className="menu" role="menu">
          {room.isOwner ? (
            <>
              <button type="button" role="menuitem" onClick={() => choose(() => setIsRenaming(true))}>
                <Icon name="edit" />
                Rename room
              </button>
              <button type="button" role="menuitem" onClick={() => choose(handleLock)}>
                <Icon name={room.isLocked ? 'unlock' : 'lock'} />
                {room.isLocked ? 'Unlock room' : 'Lock room'}
              </button>
              {onMerge && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={room.isLocked}
                  onClick={() => choose(onMerge)}
                >
                  <Icon name="merge" />
                  Merge duplicates
                </button>
              )}
              <div className="menu-sep" />
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => choose(handleDelete)}
              >
                <Icon name="trash" />
                Delete room
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => choose(handleLeave)}
            >
              <Icon name="logout" />
              Leave room
            </button>
          )}
        </div>
      )}

      {dialog}

      {isRenaming && (
        <Modal onClose={() => setIsRenaming(false)}>
          <RenameRoomForm room={room} onDone={() => setIsRenaming(false)} />
        </Modal>
      )}
    </div>
  );
}

function RenameRoomForm({ room, onDone }: { room: Room; onDone: () => void }) {
  const [draft, setDraft] = useState(room.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name || name === room.name) {
      onDone();
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await renameRoom(room.id, name);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <>
      <h3 className="modal-t">Rename room</h3>
      <form className="form" onSubmit={save}>
        <div className="field">
          <label className="label" htmlFor={`rename-${room.id}`}>
            Room name
          </label>
          <input
            id={`rename-${room.id}`}
            className="input"
            type="text"
            maxLength={40}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            required
          />
        </div>
        {error && <p className="err">{error}</p>}
        <div className="modal-acts">
          <button type="button" className="btn btn-ghost" onClick={onDone}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </>
  );
}

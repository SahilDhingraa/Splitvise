'use client';

import { useState, useTransition } from 'react';
import { removeParticipant, renameParticipant } from '@/app/actions';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { Menu } from './Menu';
import { useRoomTabs } from './RoomTabs';
import { useDialog } from './Dialog';
import type { Participant } from '@/lib/types';

export function ParticipantRow({
  roomId,
  participant,
  isRoomOwner,
  involvedPayments,
  isOwner,
  isLocked,
}: {
  roomId: string;
  participant: Participant;
  // This person owns the room (as opposed to `isOwner`: the viewer does).
  isRoomOwner: boolean;
  involvedPayments: number;
  isOwner: boolean;
  isLocked: boolean;
}) {
  // Mirrors the RLS policies: the owner may rename anyone, and anyone may rename
  // themselves. Removal stays owner-only -- it cascade-deletes that person's
  // payments, which is a very different act from leaving a room, and a member
  // reaching for "Remove" on themselves almost certainly means "Leave".
  //
  // A locked room takes both away from everyone, the owner included.
  const canRename = !isLocked && (isOwner || participant.isYou);
  const canRemove = !isLocked && isOwner;
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { confirm, alert, dialog } = useDialog();
  const tabs = useRoomTabs();

  async function handleRemove() {
    const ok = await confirm({
      title: `Remove ${participant.name}?`,
      message:
        involvedPayments > 0
          ? `This also deletes ${involvedPayments} ${involvedPayments === 1 ? 'payment' : 'payments'} they were part of.`
          : 'They are not part of any payment, so nothing else changes.',
      confirmLabel: 'Remove',
      icon: 'trash',
      danger: true,
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await removeParticipant(roomId, participant.id);
      if (result.error) await alert({ title: 'Could not remove them', message: result.error });
    });
  }

  const placeholder = !participant.userId;

  return (
    <div className="row person">
      <Avatar name={participant.name} />
      <div className="grow">
        <div className="t">
          {participant.name}
          {participant.isYou && <span className="pill">You</span>}
          {isRoomOwner && <span className="pill pill-accent">Owner</span>}
          {placeholder && (
            <span className="pill pill-warn">{participant.email ? 'Invited' : 'Placeholder'}</span>
          )}
        </div>
        <div className="s">
          {placeholder
            ? participant.email
              ? `${participant.email} · takes over this entry when they join`
              : 'No account yet · anyone in the room can record payments for them'
            : (participant.email ?? 'Signed-in member')}
        </div>
      </div>

      <Menu
        label={`Options for ${participant.name}`}
        buttonClassName="btn btn-ghost btn-sm btn-icon"
        button={<Icon name="more" />}
      >
        {(close) => (
          <>
            {canRename && (
              <button
                type="button"
                role="menuitem"
                disabled={isPending}
                onClick={() => {
                  close();
                  setIsEditing(true);
                }}
              >
                <Icon name="edit" />
                Rename
              </button>
            )}
            {tabs && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  tabs.showPaymentsFor(participant.id);
                }}
              >
                <Icon name="receipt" />
                Show their payments
              </button>
            )}
            {canRemove && (
              <>
                <div className="menu-sep" />
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  disabled={isPending}
                  onClick={() => {
                    close();
                    handleRemove();
                  }}
                >
                  <Icon name="trash" />
                  Remove from room
                </button>
              </>
            )}
          </>
        )}
      </Menu>

      {dialog}

      {isEditing && (
        <Modal onClose={() => setIsEditing(false)}>
          <RenameForm
            roomId={roomId}
            participant={participant}
            onDone={() => setIsEditing(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function RenameForm({
  roomId,
  participant,
  onDone,
}: {
  roomId: string;
  participant: Participant;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(participant.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name || name === participant.name) {
      onDone();
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await renameParticipant(roomId, participant.id, name);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <>
      <h3 className="modal-t">Rename {participant.name}</h3>
      <form className="form" onSubmit={save}>
        <div className="field">
          <label className="label" htmlFor={`rename-${participant.id}`}>
            Name
          </label>
          <input
            id={`rename-${participant.id}`}
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

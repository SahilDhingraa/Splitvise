'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateDisplayName, type ActionResult } from '@/app/actions';
import { signOut } from '@/app/login/actions';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { ThemeSwitcher } from './ThemeToggle';

const EMPTY: ActionResult = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save name'}
    </button>
  );
}

// Opens the profile dialog: display name, appearance and sign out. `variant`
// picks between the user card at the foot of the rail and the avatar button in
// the phone top bar.
export function ProfileButton({
  displayName,
  email,
  variant,
}: {
  displayName: string;
  email: string;
  variant: 'rail' | 'topbar';
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === 'rail' ? (
        <button type="button" className="user-card" onClick={() => setIsOpen(true)}>
          <Avatar name={displayName} />
          <span className="grow">
            <span className="t ell">{displayName}</span>
            <span className="s ell">{email}</span>
          </span>
          <Icon name="sliders" />
        </button>
      ) : (
        <button
          type="button"
          className="tb-btn"
          aria-label="Profile"
          onClick={() => setIsOpen(true)}
        >
          <Avatar name={displayName} size="sm" />
        </button>
      )}

      {isOpen && (
        <Modal onClose={() => setIsOpen(false)}>
          <AccountSettings displayName={displayName} email={email} />
        </Modal>
      )}
    </>
  );
}

function AccountSettings({ displayName, email }: { displayName: string; email: string }) {
  const [state, formAction] = useActionState(updateDisplayName, EMPTY);

  return (
    <>
      <div className="profile-h">
        <Avatar name={displayName} size="lg" />
        <div>
          <div className="t">{displayName}</div>
          <div className="s">{email}</div>
        </div>
      </div>

      <form action={formAction} className="form">
        <div className="field">
          <label className="label" htmlFor="displayName">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            className="input"
            maxLength={40}
            defaultValue={displayName}
            required
          />
        </div>
        <p className="hint">
          This is how you appear in every room you are in. Changing it updates those rooms too.
        </p>

        {state.error && <p className="err">{state.error}</p>}
        <div className="form-acts">
          <SubmitButton />
        </div>
      </form>

      <div className="field" style={{ marginTop: 20 }}>
        <span className="label">Appearance</span>
        <ThemeSwitcher />
      </div>

      <div className="profile-foot">
        <form action={signOut}>
          <button type="submit" className="btn btn-danger btn-sm">
            <Icon name="logout" />
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

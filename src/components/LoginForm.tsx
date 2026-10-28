'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn, signUp, type AuthResult } from '@/app/login/actions';

const EMPTY: AuthResult = { error: null, message: null };

function Buttons() {
  const { pending } = useFormStatus();

  return (
    <>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? 'Working…' : 'Sign in'}
      </button>
      <div className="or">or</div>
      <button
        type="submit"
        name="intent"
        value="signup"
        className="btn btn-ghost btn-block"
        disabled={pending}
      >
        Create account
      </button>
    </>
  );
}

export function LoginForm({ next }: { next: string }) {
  // Controlled on purpose. React resets an uncontrolled form once its action
  // finishes, so a wrong password would wipe the email and password too and make
  // you retype both. Holding the values in state keeps them across a failed
  // attempt -- you only have to fix the part you got wrong.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // One form, two actions. `useActionState` binds a single action, so the buttons
  // route through a dispatcher that reads which one was clicked.
  const [state, formAction] = useActionState(
    async (prev: AuthResult, formData: FormData) =>
      formData.get('intent') === 'signup' ? signUp(prev, formData) : signIn(prev, formData),
    EMPTY,
  );

  return (
    <form action={formAction} className="form">
      <input type="hidden" name="next" value={next} />

      <div className="field">
        <label className="label" htmlFor="displayName">
          Display name <span className="opt">new accounts only</span>
        </label>
        <input
          id="displayName"
          className="input"
          name="displayName"
          type="text"
          placeholder="Only used when creating an account"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="input"
          name="email"
          type="email"
          placeholder="test@example.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="input"
          name="password"
          type="password"
          placeholder="********"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      {state.error && <p className="err">{state.error}</p>}
      {state.message && <p className="ok-msg">{state.message}</p>}

      <Buttons />
    </form>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn, signUp, type AuthResult } from '@/app/login/actions';

const EMPTY: AuthResult = { error: null, message: null };

function Buttons() {
  const { pending } = useFormStatus();

  return (
    <div className="auth-buttons">
      <button type="submit" disabled={pending}>
        {pending ? 'Working…' : 'Sign in'}
      </button>
      <button
        type="submit"
        name="intent"
        value="signup"
        className="secondary-btn"
        disabled={pending}
      >
        Create account
      </button>
    </div>
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
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />

      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="displayName">Display name</label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          placeholder="Only used when creating an account"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>

      {state.error && <p className="form-error">{state.error}</p>}
      {state.message && <p className="form-message">{state.message}</p>}

      <Buttons />
    </form>
  );
}

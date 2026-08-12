'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type AuthResult = { error: string | null; message: string | null };

// Where the confirmation email should send people back to. Taken from the
// request rather than hardcoded, so the same code works on localhost, on the LAN
// address used for phone testing, and in production.
//
// Server Actions are POSTs that Next already checks the Origin of, so the header
// is always there in practice; the host fallback is belt and braces.
async function requestOrigin(): Promise<string> {
  const h = await headers();

  const origin = h.get('origin');
  if (origin) return origin;

  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : '';
}

// Only ever redirect to a path on this site. Without this check, a crafted
// ?next=https://evil.example link would turn our own login form into an open
// redirect that lands users on someone else's page after signing in.
function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? '');
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export async function signIn(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));

  if (!email || !password) {
    return { error: 'Email and password are both required.', message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // Deliberately vague, so the form cannot be used to discover which email
  // addresses have accounts.
  if (error) return { error: 'Those credentials did not work.', message: null };

  revalidatePath('/', 'layout');
  redirect(next);
}

export async function signUp(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('displayName') ?? '').trim();
  const next = safeNext(formData.get('next'));

  if (!email || !password) {
    return { error: 'Email and password are both required.', message: null };
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.', message: null };
  }

  const origin = await requestOrigin();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Without this, Supabase falls back to the project's Site URL on its own,
      // and the confirmation link arrives as `/?code=...`. Nothing serves that
      // path, so the proxy bounces the visitor to /login and the code is never
      // exchanged -- confirming your email appears to do nothing. The route that
      // actually redeems the code is /auth/callback, so say so explicitly.
      //
      // `next` rides along so an invite link clicked while signed out still ends
      // up in the room after confirmation, rather than on the dashboard.
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,

      // Read by the handle_new_user trigger to seed the profile.
      data: { display_name: displayName || email.split('@')[0] },
    },
  });

  if (error) return { error: error.message, message: null };

  // With email confirmation on, signUp succeeds but leaves you without a session
  // until the link is clicked. Say so, rather than appearing to do nothing.
  if (data.user && !data.session) {
    return { error: null, message: 'Check your email to confirm your account, then sign in.' };
  }

  revalidatePath('/', 'layout');
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/login');
}

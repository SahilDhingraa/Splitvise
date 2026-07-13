'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type AuthResult = { error: string | null; message: string | null };

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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
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

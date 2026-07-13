import { createBrowserClient } from '@supabase/ssr';

// Supabase client for Client Components. Only used for auth calls that must run
// in the browser (sign out, session listening); all data access goes through
// Server Actions instead.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

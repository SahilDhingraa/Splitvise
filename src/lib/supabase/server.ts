import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Supabase client for Server Components, Server Actions and Route Handlers.
//
// This still uses the anon key, not service_role -- requests carry the signed-in
// user's JWT, so RLS applies exactly as it would in the browser. The server is a
// convenience, not a trust boundary: the database is still the thing enforcing
// who can see what.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, which cannot write cookies. The
            // middleware refreshes the session instead, so this is safe to ignore.
          }
        },
      },
    },
  );
}

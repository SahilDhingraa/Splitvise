import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Where Supabase sends the user after they click the confirmation link in their
// email. Exchanges the one-time code for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Same rule as the login form: only ever redirect to a path on this site. This
  // value survives a round trip through the email, so treat it as hostile.
  const requested = searchParams.get('next') ?? '';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}

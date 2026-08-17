# SplitVise

Shared expense splitting. Next.js (App Router) + Supabase.

## The model

A **room** ("Europe trip", "Imagica") is owned by one account and holds a set of **participants**.
A participant is either:

- a **linked account** — someone who joined via the room's invite link, or
- a **placeholder** — just a name, optionally with an email.

Payments point at *participants*, never at accounts directly. That is what makes **claiming** work:
add "Carol" with her email before she has ever heard of the app, split six dinners with her, and
the moment she signs up or opens the invite link, that participant row is attached to her account —
along with every payment already recorded against it. Nobody has to re-enter anything.

Who can do what:

| | Owner | Member |
| --- | --- | --- |
| Record payments | ✅ | ✅ |
| See all payments and balances | ✅ | ✅ |
| Add / remove people | ✅ | ❌ |
| Delete a payment | any, in their room | only ones they recorded |
| Delete the room | ✅ | ❌ (can leave) |
| Lock / unlock the room | ✅ | ❌ |

Leaving a room detaches your account but leaves the participant behind as a placeholder, so the
payments you recorded stay in the history and everyone's balances still add up.

**Locking** freezes a room once the trip is settled. No payments can be recorded, deleted or
re-split, and nobody can be added, renamed or removed — for everyone, the owner included, until the
owner unlocks it. Reading still works, invite links still work: people can join a locked room and
leave it, they just arrive to a read-only ledger. It is enforced by RLS (`is_room_locked()`), not by
hiding buttons.

## Architecture

There is no backend service to run. **Supabase is the backend** (Postgres + Auth); Next.js renders
the UI and runs Server Actions for mutations.

The server is a *convenience, not a trust boundary*. Server Actions use the publishable/anon key
with the caller's JWT, exactly as a browser would — so **Row Level Security in Postgres is what
actually enforces who can see what**. The `service_role` key is never used. A bug in the action
layer cannot leak another room's data.

| Path | Role |
| --- | --- |
| `src/proxy.ts` | Refreshes the session; sends signed-out visitors to `/login?next=…` |
| `src/app/page.tsx` | Your rooms |
| `src/app/rooms/[id]/` | A room: people, payments, balances, invite link |
| `src/app/join/[code]/` | Invite landing page |
| `src/app/actions.ts` | All mutations |
| `src/lib/balances.ts` | Balance + settlement math (pure, no I/O) |
| `supabase-schema.sql` | Tables, RLS policies, and the join/claim functions |

### Two things in the schema worth knowing

**`is_room_member()` is `SECURITY DEFINER` on purpose.** A policy on `participants` that asked "is
the caller a participant of this room?" by querying `participants` would re-trigger itself and
recurse forever. Running that one lookup as the definer breaks the cycle.

**Joining goes through `join_room()`, not a policy.** To join a room you must first read it by
invite code — but you are not a member yet, so no SELECT policy will show it to you. `join_room()`
and `room_preview()` are the only sanctioned way in. They expose nothing but the room's name, and
only to someone holding a valid code.

## Setup

1. **Create the tables.** Supabase dashboard → **SQL Editor** → paste `supabase-schema.sql` → Run.
   ⚠️ It drops the old single-ledger tables (`users`, `payments`, `payment_splits`) first.

2. **Configure the environment.** Copy `.env.example` to `.env.local` and paste your
   **publishable** (formerly *anon*) key from **Project Settings → API Keys**.

3. **Leave email confirmation ON.** Supabase dashboard → **Authentication → Providers → Email**.
   Placeholder claiming trusts the email on the account, so it is only as strong as confirmation.
   With it off, anyone could claim someone else's placeholder by signing up with their address.

4. **Set the redirect URLs.** **Authentication → URL Configuration** → add
   `http://localhost:3000/auth/callback` and your production equivalent.

5. **Run it.**

   ```sh
   npm install && npm run dev
   ```

## PWA

Installable on desktop and mobile. `src/app/manifest.ts` generates the manifest; `public/sw.js` is
the service worker; icons live in `public/icons/`.

**The service worker only runs in production builds.** In dev, the bundles are unhashed and change
on every edit, so a caching worker would serve stale JavaScript and manufacture bugs that don't
exist. To exercise it: `npm run build && npm start`.

**What it caches, and what it deliberately does not.** Only hashed `/_next/static/` bundles and the
logo — content-addressed assets that are identical for every visitor. It **never** caches pages or
Supabase responses. Every page here is personalised (one account's rooms, payments, balances), and
a cached page would outlive sign-out in the browser's cache directory, where the next person to use
the device could be served it. Documents are always fetched from the network; if the network is
gone, the user gets `public/offline.html` instead of someone else's data.

Note that `proxy.ts` must keep excluding `manifest.webmanifest`, `sw.js`, `offline.html` and
`icons/` from the auth redirect. Those are fetched without credentials, so redirecting them to
`/login` would hand the browser an HTML page where it expected JSON or JavaScript, and the app
would silently stop being installable.

## Deploying

Vercel: import the repo, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
add `https://<your-domain>/auth/callback` to Supabase's Redirect URLs.

**This no longer runs on GitHub Pages** — Pages serves static files only and cannot execute Server
Actions or the auth proxy. The `CNAME` file is a leftover; point `split.sah1l.com` at Vercel and
delete it once DNS has cut over.

## A note on keys

The **publishable / anon key** is meant to be public. It is inlined into the client bundle by
design, and RLS is what protects the data.

The **Postgres connection string**, the **database password**, and the **secret / `service_role`
key** are not. They bypass RLS entirely. Never put them in a `NEXT_PUBLIC_*` variable — that ships
them to every visitor's browser.

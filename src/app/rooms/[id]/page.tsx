import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getParticipants, getPayments, getRoom } from '@/lib/queries';
import { RoomHeader } from '@/components/RoomHeader';
import { ParticipantManager } from '@/components/ParticipantManager';
import { PaymentForm } from '@/components/PaymentForm';
import { BalanceSummary } from '@/components/BalanceSummary';
import { PaymentHistory } from '@/components/PaymentHistory';
import { ThemeToggle } from '@/components/ThemeToggle';

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const room = await getRoom(id);

  // Non-members get the same 404 as a room that does not exist. RLS returns
  // nothing either way, so there is no way to probe for a room you cannot see.
  if (!room) notFound();

  const [participants, payments] = await Promise.all([
    getParticipants(id),
    getPayments(id, room.isOwner),
  ]);

  // Build the invite URL from the actual request host, so it is correct in dev,
  // on a preview deploy, and in production without any configuration.
  const headerList = await headers();
  const host = headerList.get('host') ?? 'localhost:3000';

  // Trust the proxy's own header when there is one (Vercel and tunnels set it).
  // Otherwise guess from the host: plain HTTP for localhost and private LAN
  // addresses, HTTPS for anything public. Guessing "https" for a LAN IP would
  // hand out an invite link that simply does not resolve -- which is precisely
  // the link you need when testing across devices.
  const forwardedProto = headerList.get('x-forwarded-proto')?.split(',')[0].trim();
  const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  const protocol = forwardedProto ?? (isLocal ? 'http' : 'https');

  const inviteUrl = `${protocol}://${host}/join/${room.inviteCode}`;

  return (
    <div className="container">
      <ThemeToggle />

      <RoomHeader room={room} inviteUrl={inviteUrl} />

      <div className="main-content">
        <ParticipantManager
          roomId={id}
          participants={participants}
          payments={payments}
          isOwner={room.isOwner}
        />
        <PaymentForm roomId={id} participants={participants} />
        <BalanceSummary participants={participants} payments={payments} />
        <PaymentHistory roomId={id} payments={payments} />
      </div>
    </div>
  );
}

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getParticipants, getPayments, getRoom } from '@/lib/queries';
import { RoomHeader } from '@/components/RoomHeader';
import { ParticipantManager } from '@/components/ParticipantManager';
import { PaymentForm, RecordPaymentFab } from '@/components/PaymentForm';
import { BalanceSummary } from '@/components/BalanceSummary';
import { PaymentHistory } from '@/components/PaymentHistory';
import { RoomTabs } from '@/components/RoomTabs';
import { AppShell } from '@/components/AppShell';
import {
  calculateBalances,
  calculateSettlements,
  isSettled,
  isTransfer,
} from '@/lib/balances';
import { formatMoney } from '@/lib/money';

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const room = await getRoom(id);

  // Non-members get the same 404 as a room that does not exist. RLS returns
  // nothing either way, so there is no way to probe for a room you cannot see.
  if (!room) notFound();

  const [participants, payments] = await Promise.all([getParticipants(id), getPayments(room)]);

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

  const expenses = payments.filter((payment) => !isTransfer(payment));
  const totalSpent = expenses.reduce((sum, payment) => sum + payment.amount, 0);
  const balances = calculateBalances(participants, payments);
  const settlements = calculateSettlements(balances);
  const you = participants.find((participant) => participant.isYou);
  const position = balances.find((balance) => balance.participant === you?.name)?.amount ?? 0;
  const tone = isSettled(position) ? '' : position > 0 ? ' pos' : ' neg';

  return (
    <AppShell activeRoomId={id}>
      <RoomHeader
        room={room}
        inviteUrl={inviteUrl}
        participants={participants}
        payments={payments}
      />

      <section className="stats">
        <div className="stat">
          <div className="k">Total spent</div>
          <div className="v">{formatMoney(totalSpent)}</div>
          <div className="s">
            {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
          </div>
        </div>
        <div className="stat">
          <div className="k">Your position</div>
          <div className={`v${tone}`}>
            {isSettled(position) ? '' : position > 0 ? '+' : '−'}
            {formatMoney(Math.abs(position))}
          </div>
          <div className="s">
            {isSettled(position)
              ? 'you are all settled'
              : position > 0
                ? 'you get this back'
                : 'you still owe this'}
          </div>
        </div>
        <div className="stat">
          <div className="k">To settle</div>
          <div className="v">{settlements.length}</div>
          <div className="s">
            {settlements.length === 1 ? 'transfer clears the room' : 'transfers clear the room'}
          </div>
        </div>
      </section>

      <div className="room-grid">
        <div>
          <RoomTabs
            tabs={[
              {
                key: 'activity',
                label: 'Activity',
                count: payments.length,
                panel: (
                  <PaymentHistory roomId={id} payments={payments} participants={participants} />
                ),
              },
              {
                key: 'balances',
                label: 'Settle up',
                count: settlements.length,
                panel: (
                  <div className="scroll-area">
                    <BalanceSummary
                      roomId={id}
                      participants={participants}
                      payments={payments}
                      isLocked={room.isLocked}
                    />
                  </div>
                ),
              },
              {
                key: 'people',
                label: 'People',
                count: participants.length,
                panel: (
                  <div className="scroll-area">
                    <ParticipantManager
                      room={room}
                      participants={participants}
                      payments={payments}
                    />
                  </div>
                ),
              },
            ]}
          />
        </div>

        <aside className="side-col">
          <div className="card">
            <PaymentForm roomId={id} participants={participants} isLocked={room.isLocked} />
          </div>
        </aside>
      </div>

      {!room.isLocked && <RecordPaymentFab roomId={id} participants={participants} />}
    </AppShell>
  );
}

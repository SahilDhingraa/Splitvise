import type { Balance, Participant, Payment, Settlement } from './types';

// Balances are keyed by participant name, which is unique within a room.

// A cent of slack, so floating point dust does not invent a 0.001 debt. Splitting
// $10 three ways leaves someone off by a fraction of a cent no matter how it is
// rounded; that is not a debt anyone can pay.
const EPSILON = 0.01;

// Square with the room -- nothing to pay, nothing to collect.
export function isSettled(amount: number): boolean {
  return Math.abs(amount) <= EPSILON;
}

export function calculateBalances(participants: Participant[], payments: Payment[]): Balance[] {
  const totals = new Map<string, number>();
  participants.forEach((participant) => totals.set(participant.name, 0));

  payments.forEach((payment) => {
    if (payment.splitAmong.length === 0) return;
    const share = payment.amount / payment.splitAmong.length;

    totals.set(payment.payer, (totals.get(payment.payer) ?? 0) + payment.amount);

    payment.splitAmong.forEach((name) => {
      totals.set(name, (totals.get(name) ?? 0) - share);
    });
  });

  return Array.from(totals, ([participant, amount]) => ({ participant, amount }));
}

// Greedily match the largest creditor against the largest debtor. This does not
// always produce the theoretical minimum number of transfers (that problem is
// NP-hard), but it is close and it always settles everyone.
export function calculateSettlements(balances: Balance[]): Settlement[] {
  const creditors = balances
    .filter((entry) => entry.amount > EPSILON)
    .map((entry) => ({ name: entry.participant, amount: entry.amount }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter((entry) => entry.amount < -EPSILON)
    .map((entry) => ({ name: entry.participant, amount: Math.abs(entry.amount) }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > EPSILON) {
      settlements.push({ from: debtor.name, to: creditor.name, amount });
    }

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount < EPSILON) i++;
    if (debtor.amount < EPSILON) j++;
  }

  return settlements;
}

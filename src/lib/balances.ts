import type { Balance, Participant, Payment, Settlement, TripCost } from './types';

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

// Money one person handed another rather than spent on the trip: a recorded
// transfer, or an expense someone paid for exactly one OTHER person (Chaitanya
// pays, split among only Sahil). Both count as "received" for that person and
// never as anyone's share of the trip.
export function isTransfer(payment: Payment): boolean {
  if (payment.kind === 'transfer') return true;
  return payment.splitAmongIds.length === 1 && payment.splitAmongIds[0] !== payment.payerId;
}

export function calculateTripCosts(participants: Participant[], payments: Payment[]): TripCost[] {
  const costs = new Map<string, TripCost>();
  const entry = (name: string): TripCost => {
    let found = costs.get(name);
    if (!found) {
      found = { participant: name, paid: 0, received: 0, cost: 0 };
      costs.set(name, found);
    }
    return found;
  };
  participants.forEach((participant) => entry(participant.name));

  payments.forEach((payment) => {
    // Same rule as calculateBalances: a payment split among nobody is ignored.
    if (payment.splitAmong.length === 0) return;
    entry(payment.payer).paid += payment.amount;

    if (isTransfer(payment)) {
      // Cash changing hands is nobody's spending, so it never adds to a share.
      payment.splitAmong.forEach((name) => {
        entry(name).received += payment.amount / payment.splitAmong.length;
      });
      return;
    }

    const share = payment.amount / payment.splitAmong.length;
    payment.splitAmong.forEach((name) => {
      entry(name).cost += share;
    });
  });

  // paid − received − cost equals each person's balance, so settling up
  // always leaves them exactly `cost` out of pocket.
  return Array.from(costs.values()).sort((a, b) => b.cost - a.cost);
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

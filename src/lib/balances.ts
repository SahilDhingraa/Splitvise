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
//
// Works in whole paise. "Mark paid" records each settlement rounded to the
// paisa, so settlements must already be exact paisa amounts that add up to each
// person's (rounded) balance. Otherwise every recorded transfer leaves up to
// half a paisa behind, and someone with a few of them ends up with a fresh
// ₹0.01 debt that is only rounding.
export function calculateSettlements(balances: Balance[]): Settlement[] {
  // One paisa or less is square, the same slack as isSettled.
  const slack = Math.round(EPSILON * 100);

  const creditors = balances
    .map((entry) => ({ name: entry.participant, paise: Math.round(entry.amount * 100) }))
    .filter((entry) => entry.paise > slack)
    .sort((a, b) => b.paise - a.paise);

  const debtors = balances
    .map((entry) => ({ name: entry.participant, paise: -Math.round(entry.amount * 100) }))
    .filter((entry) => entry.paise > slack)
    .sort((a, b) => b.paise - a.paise);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const paise = Math.min(creditor.paise, debtor.paise);

    if (paise > slack) {
      settlements.push({ from: debtor.name, to: creditor.name, amount: paise / 100 });
    }

    creditor.paise -= paise;
    debtor.paise -= paise;

    if (creditor.paise <= slack) i++;
    if (debtor.paise <= slack) j++;
  }

  return settlements;
}

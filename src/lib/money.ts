// Every amount in the app is shown in Indian rupees, with Indian digit grouping
// (₹1,23,456.00) and always two decimal places.
const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number): string {
  return formatter.format(amount);
}

const wholeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// For tight spots like a payment row: drops the paise when there are none
// (₹1,200 rather than ₹1,200.00), and keeps them when there are.
export function formatMoneyShort(amount: number): string {
  const rounded = Math.round(amount);
  return Math.abs(amount - rounded) < 0.005 ? wholeFormatter.format(rounded) : formatter.format(amount);
}

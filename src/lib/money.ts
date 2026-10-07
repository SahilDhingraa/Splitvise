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

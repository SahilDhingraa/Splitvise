import writeExcelFile, { type Row } from 'write-excel-file/browser';
import { isTransfer } from './balances';
import type { Payment } from './types';

// Rupee symbol (en-IN locale tag). Digit grouping follows the viewer's Excel
// locale settings.
const MONEY = '[$₹-4009]#,##0.00';
const HEADER = { fontWeight: 'bold', backgroundColor: '#F4F4F5' } as const;

// Downloads the given payments (already filtered by the caller) as an .xlsx
// file, one row per payment plus a bold total row at the bottom.
export async function exportPaymentsToExcel(payments: Payment[]): Promise<void> {
  const header: Row = [
    'Date',
    'Type',
    'Description',
    'Paid / given by',
    'Amount',
    'Split among / given to',
    'Per person',
  ].map((value) => ({ value, ...HEADER }));

  const rows: Row[] = payments.map((payment) => {
    const given = isTransfer(payment);
    return [
      { value: new Date(payment.createdAt), type: Date, format: 'yyyy-mm-dd hh:mm' },
      payment.kind === 'transfer' ? 'Money given' : given ? 'Paid for one person' : 'Expense',
      payment.description,
      payment.payer,
      { value: payment.amount, type: Number, format: MONEY },
      payment.splitAmong.join(', '),
      // A transfer has no per-person share: it is one person paying another.
      !given && payment.splitAmong.length > 0
        ? { value: payment.amount / payment.splitAmong.length, type: Number, format: MONEY }
        : null,
    ];
  });

  // Spending only, matching the app: cash handed between people is not money
  // spent on the trip.
  const expenses = payments.filter((payment) => !isTransfer(payment));
  const total = expenses.reduce((sum, payment) => sum + payment.amount, 0);
  const totalRow: Row = [
    { value: 'Total spent', fontWeight: 'bold' },
    null,
    { value: `${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'}` },
    null,
    { value: total, type: Number, format: MONEY, fontWeight: 'bold' },
    null,
    null,
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  await writeExcelFile([header, ...rows, [], totalRow], {
    sheet: 'Payments',
    stickyRowsCount: 1,
    columns: [
      { width: 18 },
      { width: 14 },
      { width: 32 },
      { width: 18 },
      { width: 14 },
      { width: 36 },
      { width: 14 },
    ],
  }).toFile(`splitvise-payments-${stamp}.xlsx`);
}

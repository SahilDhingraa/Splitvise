import writeExcelFile, { type Row } from 'write-excel-file/browser';
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
    'Description',
    'Paid by',
    'Amount',
    'Split among',
    'Per person',
  ].map((value) => ({ value, ...HEADER }));

  const rows: Row[] = payments.map((payment) => [
    { value: new Date(payment.createdAt), type: Date, format: 'yyyy-mm-dd hh:mm' },
    payment.description,
    payment.payer,
    { value: payment.amount, type: Number, format: MONEY },
    payment.splitAmong.join(', '),
    payment.splitAmong.length > 0
      ? { value: payment.amount / payment.splitAmong.length, type: Number, format: MONEY }
      : null,
  ]);

  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalRow: Row = [
    { value: 'Total', fontWeight: 'bold' },
    { value: `${payments.length} ${payments.length === 1 ? 'payment' : 'payments'}` },
    null,
    { value: total, type: Number, format: MONEY, fontWeight: 'bold' },
    null,
    null,
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  await writeExcelFile([header, ...rows, [], totalRow], {
    sheet: 'Payments',
    stickyRowsCount: 1,
    columns: [{ width: 18 }, { width: 32 }, { width: 18 }, { width: 14 }, { width: 36 }, { width: 14 }],
  }).toFile(`splitvise-payments-${stamp}.xlsx`);
}

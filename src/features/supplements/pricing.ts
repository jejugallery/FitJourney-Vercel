import type { CourseDraftLine, DiscountType, PricedCourseLine } from './types.js';

const toSatang = (baht: number) => Math.round((Number(baht) || 0) * 100);
const toBaht = (satang: number) => satang / 100;

export const CASHBACK_PERCENTAGES = [0, 3, 6, 9, 12, 15, 18, 21] as const;

export function calculateCashback(finalNetTotal: number, cashbackPercent: number): number {
  const totalSatang = Math.max(0, toSatang(finalNetTotal));
  return toBaht(Math.round(totalSatang * Math.max(0, Number(cashbackPercent) || 0) / 100));
}

export function isCashbackEligibleName(name: string): boolean {
  return !String(name || '').includes('ใบสมัคร');
}

export function calculateCourseCashback(lines: Array<{ name: string; netAmount: number }>, cashbackPercent: number): number {
  const eligibleTotal = lines.reduce((total, line) => (
    isCashbackEligibleName(line.name) ? total + Math.max(0, Number(line.netAmount) || 0) : total
  ), 0);
  return calculateCashback(eligibleTotal, cashbackPercent);
}

export function calculateCourseLine(
  unitPrice: number,
  packageQuantity: number,
  discountType: DiscountType,
  discountValue = 0,
): PricedCourseLine {
  const unitPriceSatang = Math.max(0, toSatang(unitPrice));
  const gross = unitPriceSatang * Math.max(0, Math.trunc(packageQuantity));
  let discount = 0;
  if (discountType === 'percent_10') discount = Math.round(unitPriceSatang * 0.10);
  if (discountType === 'percent_15') discount = Math.round(unitPriceSatang * 0.15);
  if (discountType === 'fixed_100') discount = 10000;
  if (discountType === 'fixed_500') discount = 50000;
  if (discountType === 'custom') discount = Math.max(0, toSatang(discountValue));
  discount = Math.min(unitPriceSatang, discount);
  return { grossAmount: toBaht(gross), discountAmount: toBaht(discount), netAmount: toBaht(gross - discount) };
}

export function calculateCourseTotals(lines: CourseDraftLine[]) {
  return lines.reduce((totals, line) => {
    const priced = calculateCourseLine(line.supplement.price, line.packageQuantity, line.discountType, line.discountValue);
    totals.subtotal += priced.grossAmount;
    totals.discountTotal += priced.discountAmount;
    totals.total += priced.netAmount;
    return totals;
  }, { subtotal: 0, discountTotal: 0, total: 0 });
}

import type { CourseDraftLine, DiscountType, PricedCourseLine } from './types';

const toSatang = (baht: number) => Math.round((Number(baht) || 0) * 100);
const toBaht = (satang: number) => satang / 100;

export function calculateCourseLine(
  unitPrice: number,
  packageQuantity: number,
  discountType: DiscountType,
  discountValue = 0,
): PricedCourseLine {
  const gross = Math.max(0, toSatang(unitPrice)) * Math.max(0, Math.trunc(packageQuantity));
  let discount = 0;
  if (discountType === 'percent_10') discount = Math.round(gross * 0.10);
  if (discountType === 'percent_15') discount = Math.round(gross * 0.15);
  if (discountType === 'fixed_100') discount = 10000;
  if (discountType === 'fixed_500') discount = 50000;
  if (discountType === 'custom') discount = Math.max(0, toSatang(discountValue));
  discount = Math.min(gross, discount);
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

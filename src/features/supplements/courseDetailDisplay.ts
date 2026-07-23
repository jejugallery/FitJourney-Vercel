export function formatCourseItemPriceQuantity(unitPrice: number, packageQuantity: number): string {
  const price = Number(unitPrice || 0);
  const quantity = Math.max(0, Math.trunc(Number(packageQuantity) || 0));
  const priceLabel = price === 0
    ? 'ฟรี'
    : `฿${price.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${priceLabel} × ${quantity}`;
}

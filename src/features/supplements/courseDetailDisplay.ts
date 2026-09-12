export function formatCourseItemUnitPrice(unitPrice: number): string {
  const price = Number(unitPrice || 0);
  return price === 0
    ? 'ฟรี'
    : `฿${price.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCourseItemPriceQuantity(unitPrice: number, packageQuantity: number): string {
  const quantity = Math.max(0, Math.trunc(Number(packageQuantity) || 0));
  return `${formatCourseItemUnitPrice(unitPrice)} × ${quantity}`;
}

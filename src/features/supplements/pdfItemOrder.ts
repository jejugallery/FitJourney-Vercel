export function orderSupplementItemsForPdf<T extends { supplementName: string; unitPrice: number }>(items: T[]): T[] {
  const rank = (item: T) => {
    if (String(item.supplementName || '').includes('ใบสมัคร')) return 0;
    return Number(item.unitPrice) > 0 ? 1 : 2;
  };
  return items.map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(entry => entry.item);
}

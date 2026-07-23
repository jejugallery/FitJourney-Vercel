export function orderSupplementProducts<T>(
  items: T[],
  getName: (item: T) => string,
  getUnitPrice: (item: T) => number,
): T[] {
  const rank = (item: T) => {
    if (String(getName(item) || '').includes('ใบสมัคร')) return 0;
    return Number(getUnitPrice(item)) > 0 ? 1 : 2;
  };
  return items.map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const groupDifference = rank(a.item) - rank(b.item);
      if (groupDifference) return groupDifference;
      const nameDifference = String(getName(a.item) || '').localeCompare(String(getName(b.item) || ''), 'th');
      return nameDifference || a.index - b.index;
    })
    .map(entry => entry.item);
}

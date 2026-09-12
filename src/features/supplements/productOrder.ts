export function orderSupplementProducts<T>(
  items: T[],
  getName: (item: T) => string,
  getUnitPrice: (item: T) => number,
): T[] {
  const rank = (item: T) => {
    const name = String(getName(item) || '').toLowerCase();
    if (name.includes('ใบสมัคร')) return 0;
    if (name.includes('บอดี้คีย์') || name.includes('bodykey') || name.includes('body key')) return 1;
    return Number(getUnitPrice(item)) > 0 ? 2 : 3;
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

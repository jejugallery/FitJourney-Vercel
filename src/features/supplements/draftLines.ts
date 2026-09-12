import type { CourseDraftLine, Supplement } from './types.js';

export function createCourseDraftLine(supplement: Supplement): CourseDraftLine {
  return {
    lineId: crypto.randomUUID(),
    supplementId: supplement.id,
    supplement,
    packageQuantity: 1,
    discountType: 'none',
    discountValue: 0,
  };
}

export function countDraftLinesBySupplement(lines: CourseDraftLine[]): Record<string, number> {
  return lines.reduce<Record<string, number>>((counts, line) => {
    counts[line.supplementId] = (counts[line.supplementId] || 0) + 1;
    return counts;
  }, {});
}

export function draftLineFromSavedItem(item: any, supplements: Supplement[]): CourseDraftLine {
  const match = supplements.find(s => s.id === item.supplementId);
  const supplement: Supplement = match || {
    id: item.supplementId,
    name: item.supplementName,
    imageUrl: item.imageUrl,
    price: Number(item.unitPrice || 0),
    contentQuantity: Number(item.contentQuantity || 1),
    contentUnit: item.contentUnit || 'เม็ด',
    isActive: true,
  };
  return {
    lineId: item.id || crypto.randomUUID(),
    supplementId: item.supplementId,
    supplement,
    packageQuantity: Number(item.packageQuantity || 1),
    discountType: item.discountType || 'none',
    discountValue: Number(item.discountValue || 0),
  };
}

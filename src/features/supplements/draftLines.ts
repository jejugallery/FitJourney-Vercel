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

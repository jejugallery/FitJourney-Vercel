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

const UNITS = new Set(['เม็ด', 'ช้อน', 'ซอง', 'ใบ', 'ชิ้น']);

export class SupplementInputError extends Error {
  status = 400;
}

export function parseSupplementInput(body: any) {
  const name = String(body?.name || '').trim();
  const imageUrl = String(body?.imageUrl || '').trim();
  const rawPrice = body?.price;
  const price = Number(rawPrice);
  const contentQuantity = Number(body?.contentQuantity);
  const contentUnit = String(body?.contentUnit || '');
  if (!name) throw new SupplementInputError('กรุณากรอกชื่ออาหารเสริม');
  if (!/^https:\/\//.test(imageUrl)) throw new SupplementInputError('กรุณาอัปโหลดรูปภาพ');
  if (rawPrice === '' || rawPrice == null || !Number.isFinite(price) || price < 0) throw new SupplementInputError('ราคาต้องไม่น้อยกว่า 0');
  if (!Number.isInteger(contentQuantity) || contentQuantity <= 0) throw new SupplementInputError('จำนวนบรรจุต้องเป็นจำนวนเต็มมากกว่า 0');
  if (!UNITS.has(contentUnit)) throw new SupplementInputError('หน่วยบรรจุไม่ถูกต้อง');
  return { name, imageUrl, price, contentQuantity, contentUnit };
}

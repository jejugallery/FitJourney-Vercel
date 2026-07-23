import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import { sql } from './_db.js';
import { HttpError, requireLinkedTrainee, requireTrainer } from './_auth.js';
import { ensureSupplementSchema } from './_supplement-schema.js';

const DISCOUNTS = new Set(['none', 'percent_10', 'percent_15', 'fixed_100', 'fixed_500', 'custom']);

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function priceLine(unitPrice: number, quantity: number, type: string, customValue: number) {
  const gross = money(unitPrice * quantity);
  let discount = 0;
  if (type === 'percent_10') discount = money(gross * 0.10);
  if (type === 'percent_15') discount = money(gross * 0.15);
  if (type === 'fixed_100') discount = 100;
  if (type === 'fixed_500') discount = 500;
  if (type === 'custom') discount = Math.max(0, money(customValue));
  discount = Math.min(gross, discount);
  return { grossAmount: gross, discountAmount: discount, netAmount: money(gross - discount) };
}

async function courseItems(courseId: string) {
  return sql`SELECT * FROM supplement_course_items WHERE course_id = ${courseId} ORDER BY sort_order ASC`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureSupplementSchema();
    const actor = await requireTrainer(req);

    if (req.method === 'GET') {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (id) {
        const rows = await sql`SELECT * FROM supplement_courses WHERE id = ${id} AND trainer_id = ${actor.userId}`;
        if (!rows.length) throw new HttpError(404, 'ไม่พบประวัติคอร์ส');
        return res.status(200).json({ ...rows[0], items: await courseItems(id) });
      }
      const traineeId = typeof req.query.traineeId === 'string' ? req.query.traineeId : '';
      if (traineeId) await requireLinkedTrainee(actor.userId, traineeId);
      const rows = traineeId
        ? await sql`SELECT *, (SELECT COUNT(*)::int FROM supplement_course_items i WHERE i.course_id = c.id) AS item_count FROM supplement_courses c WHERE trainer_id = ${actor.userId} AND trainee_id = ${traineeId} ORDER BY created_at DESC`
        : await sql`SELECT *, (SELECT COUNT(*)::int FROM supplement_course_items i WHERE i.course_id = c.id) AS item_count FROM supplement_courses c WHERE trainer_id = ${actor.userId} ORDER BY created_at DESC`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const traineeId = String(req.body?.traineeId || '');
      const trainee = await requireLinkedTrainee(actor.userId, traineeId);
      const draftLines = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!draftLines.length) throw new HttpError(400, 'กรุณาเลือกอาหารเสริมอย่างน้อย 1 รายการ');
      if (draftLines.length > 50) throw new HttpError(400, 'รายการอาหารเสริมมากเกินไป');

      const uniqueIds = [...new Set(draftLines.map((line: any) => String(line.supplementId || '')))];
      if (uniqueIds.length !== draftLines.length || uniqueIds.some(id => !id)) throw new HttpError(400, 'รายการอาหารเสริมซ้ำหรือไม่ถูกต้อง');
      const uniqueIdsJson = JSON.stringify(uniqueIds);
      const products = await sql`SELECT * FROM supplements WHERE id IN (SELECT jsonb_array_elements_text(${uniqueIdsJson}::jsonb)) AND is_active = TRUE`;
      if (products.length !== uniqueIds.length) throw new HttpError(409, 'มีอาหารเสริมที่ถูกลบ กรุณาโหลดรายการใหม่');
      const productMap = new Map(products.map((product: any) => [product.id, product]));

      const items = draftLines.map((line: any, index: number) => {
        const product: any = productMap.get(String(line.supplementId));
        const quantity = Number(line.packageQuantity);
        const discountType = String(line.discountType || 'none');
        const discountValue = Number(line.discountValue || 0);
        if (!Number.isInteger(quantity) || quantity <= 0) throw new HttpError(400, `จำนวนสินค้าแถวที่ ${index + 1} ไม่ถูกต้อง`);
        if (!DISCOUNTS.has(discountType) || !Number.isFinite(discountValue) || discountValue < 0) throw new HttpError(400, `ส่วนลดแถวที่ ${index + 1} ไม่ถูกต้อง`);
        const priced = priceLine(Number(product.price), quantity, discountType, discountValue);
        return {
          id: crypto.randomBytes(10).toString('hex'), supplementId: product.id, supplementName: product.name,
          imageUrl: product.image_url, contentQuantity: Number(product.content_quantity), contentUnit: product.content_unit,
          unitPrice: Number(product.price), packageQuantity: quantity, discountType,
          discountValue: discountType === 'custom' ? discountValue : discountType.startsWith('percent') ? Number(discountType.slice(-2)) : discountType === 'fixed_100' ? 100 : discountType === 'fixed_500' ? 500 : 0,
          ...priced, sortOrder: index,
        };
      });

      const subtotal = money(items.reduce((sum, item) => sum + item.grossAmount, 0));
      const discountTotal = money(items.reduce((sum, item) => sum + item.discountAmount, 0));
      const total = money(items.reduce((sum, item) => sum + item.netAmount, 0));
      const courseId = crypto.randomBytes(10).toString('hex');
      const itemsJson = JSON.stringify(items);
      const inserted = await sql`
        WITH new_course AS (
          INSERT INTO supplement_courses (id, trainer_id, trainer_name, trainee_id, trainee_name, subtotal, discount_total, total)
          VALUES (${courseId}, ${actor.userId}, ${actor.displayName}, ${trainee.userId}, ${trainee.nickname}, ${subtotal}, ${discountTotal}, ${total})
          RETURNING *
        ), input_items AS (
          SELECT * FROM jsonb_to_recordset(${itemsJson}::jsonb) AS x(
            id TEXT, "supplementId" TEXT, "supplementName" TEXT, "imageUrl" TEXT, "contentQuantity" INTEGER,
            "contentUnit" TEXT, "unitPrice" NUMERIC, "packageQuantity" INTEGER, "discountType" TEXT,
            "discountValue" NUMERIC, "grossAmount" NUMERIC, "discountAmount" NUMERIC, "netAmount" NUMERIC, "sortOrder" INTEGER
          )
        ), new_items AS (
          INSERT INTO supplement_course_items (id, course_id, supplement_id, supplement_name, image_url, content_quantity,
            content_unit, unit_price, package_quantity, discount_type, discount_value, gross_amount, discount_amount, net_amount, sort_order)
          SELECT id, ${courseId}, "supplementId", "supplementName", "imageUrl", "contentQuantity", "contentUnit", "unitPrice",
            "packageQuantity", "discountType", "discountValue", "grossAmount", "discountAmount", "netAmount", "sortOrder" FROM input_items
          RETURNING id
        )
        SELECT new_course.* FROM new_course, (SELECT COUNT(*) FROM new_items) saved_items
      `;
      return res.status(201).json({ ...inserted[0], items: await courseItems(courseId) });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error('Supplement courses API error:', error);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
}

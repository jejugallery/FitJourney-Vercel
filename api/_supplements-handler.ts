import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import { sql } from './_db.js';
import { HttpError, requireSuperadmin, requireTrainer } from './_auth.js';
import { ensureSupplementSchema } from './_supplement-schema.js';

const UNITS = new Set(['เม็ด', 'ช้อน', 'ซอง']);

function validate(body: any) {
  const name = String(body.name || '').trim();
  const imageUrl = String(body.imageUrl || '').trim();
  const price = Number(body.price);
  const contentQuantity = Number(body.contentQuantity);
  const contentUnit = String(body.contentUnit || '');
  if (!name) throw new HttpError(400, 'กรุณากรอกชื่ออาหารเสริม');
  if (!/^https:\/\//.test(imageUrl)) throw new HttpError(400, 'กรุณาอัปโหลดรูปภาพ');
  if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, 'ราคาต้องมากกว่า 0');
  if (!Number.isInteger(contentQuantity) || contentQuantity <= 0) throw new HttpError(400, 'จำนวนบรรจุต้องเป็นจำนวนเต็มมากกว่า 0');
  if (!UNITS.has(contentUnit)) throw new HttpError(400, 'หน่วยบรรจุไม่ถูกต้อง');
  return { name, imageUrl, price, contentQuantity, contentUnit };
}

export default async function supplementsHandler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureSupplementSchema();
    if (req.method === 'GET') {
      const actor = await requireTrainer(req);
      const includeArchived = req.query.includeArchived === 'true' && actor.isSuperadmin;
      const rows = includeArchived
        ? await sql`SELECT * FROM supplements ORDER BY is_active DESC, updated_at DESC`
        : await sql`SELECT * FROM supplements WHERE is_active = TRUE ORDER BY name ASC`;
      return res.status(200).json(rows);
    }

    const actor = await requireSuperadmin(req);
    if (req.method === 'POST') {
      const item = validate(req.body);
      const id = crypto.randomBytes(10).toString('hex');
      const rows = await sql`
        INSERT INTO supplements (id, name, image_url, price, content_quantity, content_unit, created_by, updated_by)
        VALUES (${id}, ${item.name}, ${item.imageUrl}, ${item.price}, ${item.contentQuantity}, ${item.contentUnit}, ${actor.userId}, ${actor.userId})
        RETURNING *
      `;
      return res.status(201).json(rows[0]);
    }

    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) throw new HttpError(400, 'ไม่พบรหัสอาหารเสริม');
    if (req.method === 'PUT') {
      const item = validate(req.body);
      const rows = await sql`
        UPDATE supplements SET name = ${item.name}, image_url = ${item.imageUrl}, price = ${item.price},
          content_quantity = ${item.contentQuantity}, content_unit = ${item.contentUnit},
          updated_by = ${actor.userId}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND is_active = TRUE RETURNING *
      `;
      if (!rows.length) throw new HttpError(404, 'ไม่พบอาหารเสริมที่ต้องการแก้ไข');
      return res.status(200).json(rows[0]);
    }
    if (req.method === 'DELETE') {
      const rows = await sql`
        UPDATE supplements SET is_active = FALSE, archived_by = ${actor.userId}, archived_at = CURRENT_TIMESTAMP,
          updated_by = ${actor.userId}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND is_active = TRUE RETURNING id
      `;
      if (!rows.length) throw new HttpError(404, 'ไม่พบอาหารเสริมที่ต้องการลบ');
      return res.status(200).json({ id, archived: true });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error('Supplements API error:', error);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
}

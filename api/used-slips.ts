import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { slipId } = req.query;

    if (req.method === 'GET') {
      if (!slipId || typeof slipId !== 'string') {
        return res.status(400).json({ error: 'slipId query parameter is required' });
      }

      const rows = await sql`SELECT * FROM used_slips WHERE slip_id = ${slipId}`;
      return res.status(200).json({ exists: rows.length > 0, data: rows[0] || null });
    }

    if (req.method === 'POST') {
      const { slipId: bodySlipId, billingId, userId, slipUrl } = req.body;

      if (!bodySlipId || !billingId || !userId) {
        return res.status(400).json({ error: 'slipId, billingId, and userId are required' });
      }

      const result = await sql`
        INSERT INTO used_slips (slip_id, billing_id, user_id, slip_url, submitted_at)
        VALUES (${bodySlipId}, ${billingId}, ${userId}, ${slipUrl || ''}, CURRENT_TIMESTAMP)
        ON CONFLICT (slip_id) DO NOTHING
        RETURNING *
      `;

      return res.status(201).json({ success: true, data: result[0] || null });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Database Error in used-slips:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

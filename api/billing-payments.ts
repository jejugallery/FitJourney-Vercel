import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { billingId, userId } = req.query;

    if (req.method === 'GET') {
      if (!billingId || typeof billingId !== 'string') {
        return res.status(400).json({ error: 'billingId is required' });
      }

      if (userId && typeof userId === 'string') {
        // Fetch a specific user's payment for this billing
        const rows = await sql`
          SELECT * FROM billing_payments 
          WHERE billing_id = ${billingId} AND user_id = ${userId}
        `;
        if (rows.length === 0) {
          return res.status(200).json(null);
        }
        return res.status(200).json(rows[0]);
      }

      // Fetch all payments for this billing
      const rows = await sql`
        SELECT * FROM billing_payments 
        WHERE billing_id = ${billingId}
        ORDER BY submitted_at ASC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const {
        billingId: bodyBillingId,
        userId: bodyUserId,
        displayName,
        pictureUrl,
        slipUrl,
        slipId,
        friends,
        slips,
      } = req.body;

      const targetBillingId = bodyBillingId || billingId;
      const targetUserId = bodyUserId || userId;

      if (!targetBillingId || !targetUserId) {
        return res.status(400).json({ error: 'billingId and userId are required' });
      }

      // Save/upsert the payment record
      const friendsJson = friends ? JSON.stringify(friends) : '[]';
      const slipsJson = slips ? JSON.stringify(slips) : '[]';

      const result = await sql`
        INSERT INTO billing_payments (
          billing_id, user_id, display_name, picture_url, slip_url, 
          slip_id, friends, slips, submitted_at
        ) VALUES (
          ${targetBillingId}, ${targetUserId}, ${displayName || ''}, ${pictureUrl || ''}, ${slipUrl || ''}, 
          ${slipId || null}, ${friendsJson}::jsonb, ${slipsJson}::jsonb, CURRENT_TIMESTAMP
        )
        ON CONFLICT (billing_id, user_id) DO UPDATE SET
          display_name = COALESCE(EXCLUDED.display_name, billing_payments.display_name),
          picture_url = COALESCE(EXCLUDED.picture_url, billing_payments.picture_url),
          slip_url = EXCLUDED.slip_url,
          slip_id = EXCLUDED.slip_id,
          friends = EXCLUDED.friends,
          slips = EXCLUDED.slips,
          submitted_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      return res.status(200).json(result[0]);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Database Error in billing-payments:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

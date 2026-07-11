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
    const { userId } = req.query;

    if (req.method === 'GET') {
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'userId parameter is required' });
      }

      const rows = await sql`
        SELECT * FROM saved_accounts 
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { id, userId: bodyUserId, accountName, bankName, accountNumber } = req.body;

      const targetUserId = bodyUserId || userId;

      if (!id || !targetUserId || !accountName || !bankName || !accountNumber) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      const result = await sql`
        INSERT INTO saved_accounts (id, user_id, account_name, bank_name, account_number, updated_at)
        VALUES (${id}, ${targetUserId}, ${accountName}, ${bankName}, ${accountNumber}, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, id) DO UPDATE SET
          account_name = EXCLUDED.account_name,
          bank_name = EXCLUDED.bank_name,
          account_number = EXCLUDED.account_number,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      return res.status(200).json(result[0]);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Database Error in saved-bank-accounts:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

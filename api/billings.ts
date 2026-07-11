import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db.js';
import * as crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id } = req.query;

    if (req.method === 'GET') {
      if (id && typeof id === 'string') {
        const rows = await sql`SELECT * FROM billings WHERE id = ${id}`;
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Billing not found' });
        }
        return res.status(200).json(rows[0]);
      } else {
        const rows = await sql`SELECT * FROM billings ORDER BY created_at DESC`;
        return res.status(200).json(rows);
      }
    }

    if (req.method === 'POST') {
      const {
        name,
        amount,
        bankName,
        accountName,
        accountNumber,
        description,
        invitationText,
        invitationColor,
        buttonColor,
        createdBy,
      } = req.body;

      if (!name || !amount || !bankName || !accountName || !accountNumber) {
        return res.status(400).json({ error: 'Required fields are missing' });
      }

      const billingId = crypto.randomBytes(10).toString('hex');

      await sql`
        INSERT INTO billings (
          id, name, amount, bank_name, account_name, account_number, 
          description, invitation_text, invitation_color, button_color, 
          status, created_by
        ) VALUES (
          ${billingId}, ${name}, ${amount}, ${bankName}, ${accountName}, ${accountNumber}, 
          ${description || ''}, ${invitationText || ''}, ${invitationColor || ''}, ${buttonColor || ''}, 
          'pending', ${createdBy || ''}
        )
      `;

      return res.status(201).json({ id: billingId, name, amount });
    }

    if (req.method === 'PUT') {
      const billingId = id || req.body.id;
      if (!billingId || typeof billingId !== 'string') {
        return res.status(400).json({ error: 'Billing ID is required' });
      }

      const { status, name, amount, bankName, accountName, accountNumber, description, invitationText, invitationColor, buttonColor } = req.body;

      const result = await sql`
        UPDATE billings SET
          status = COALESCE(${status}, status),
          name = COALESCE(${name}, name),
          amount = COALESCE(${amount}, amount),
          bank_name = COALESCE(${bankName}, bank_name),
          account_name = COALESCE(${accountName}, account_name),
          account_number = COALESCE(${accountNumber}, accountNumber),
          description = COALESCE(${description}, description),
          invitation_text = COALESCE(${invitationText}, invitation_text),
          invitation_color = COALESCE(${invitationColor}, invitation_color),
          button_color = COALESCE(${buttonColor}, button_color)
        WHERE id = ${billingId}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Billing not found' });
      }

      return res.status(200).json(result[0]);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Database Error in billings:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db.js';
import * as crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id, inviteeId, appointmentId, status, countOnly } = req.query;

    if (req.method === 'GET') {
      if (inviteeId && typeof inviteeId === 'string') {
        if (status === 'pending' && countOnly === 'true') {
          // Count unviewed pending invitations
          const result = await sql`
            SELECT COUNT(*)::int as count 
            FROM appointment_invitations 
            WHERE invitee_id = ${inviteeId} AND status = 'pending' AND viewed = FALSE
          `;
          return res.status(200).json({ count: result[0].count });
        }
        
        const rows = await sql`
          SELECT ai.*, a.name as appointment_name, a.datetime as appointment_datetime,
                 a.location as appointment_location, a.image_url as appointment_image_url
          FROM appointment_invitations ai
          JOIN appointments a ON ai.appointment_id = a.id
          WHERE ai.invitee_id = ${inviteeId}
          ORDER BY ai.created_at DESC
        `;
        return res.status(200).json(rows);
      }

      if (appointmentId && typeof appointmentId === 'string') {
        const rows = await sql`
          SELECT * FROM appointment_invitations 
          WHERE appointment_id = ${appointmentId}
          ORDER BY created_at DESC
        `;
        return res.status(200).json(rows);
      }

      if (id && typeof id === 'string') {
        const rows = await sql`SELECT * FROM appointment_invitations WHERE id = ${id}`;
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Invitation not found' });
        }
        return res.status(200).json(rows[0]);
      }

      const rows = await sql`SELECT * FROM appointment_invitations ORDER BY created_at DESC`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { appointmentId, inviterId, inviteeId, role, status } = req.body;

      if (!appointmentId || !inviterId || !inviteeId) {
        return res.status(400).json({ error: 'appointmentId, inviterId, and inviteeId are required' });
      }

      const invitationId = crypto.randomBytes(10).toString('hex');

      await sql`
        INSERT INTO appointment_invitations (id, appointment_id, inviter_id, invitee_id, role, status, viewed)
        VALUES (${invitationId}, ${appointmentId}, ${inviterId}, ${inviteeId}, ${role || ''}, ${status || 'pending'}, FALSE)
      `;

      return res.status(201).json({ id: invitationId, appointmentId, inviteeId, status: status || 'pending' });
    }

    if (req.method === 'PUT') {
      const invitationId = id || req.body.id;
      if (!invitationId || typeof invitationId !== 'string') {
        return res.status(400).json({ error: 'Invitation ID is required' });
      }

      const { status, viewed } = req.body;

      let result;
      if (status !== undefined && viewed !== undefined) {
        result = await sql`
          UPDATE appointment_invitations 
          SET status = ${status}, viewed = ${viewed}
          WHERE id = ${invitationId}
          RETURNING *
        `;
      } else if (status !== undefined) {
        result = await sql`
          UPDATE appointment_invitations 
          SET status = ${status}
          WHERE id = ${invitationId}
          RETURNING *
        `;
      } else if (viewed !== undefined) {
        result = await sql`
          UPDATE appointment_invitations 
          SET viewed = ${viewed}
          WHERE id = ${invitationId}
          RETURNING *
        `;
      } else {
        return res.status(400).json({ error: 'Status or viewed is required' });
      }

      if (result.length === 0) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      return res.status(200).json(result[0]);
    }

    if (req.method === 'DELETE') {
      if (appointmentId && typeof appointmentId === 'string') {
        // Delete all invitations for this appointment
        await sql`DELETE FROM appointment_invitations WHERE appointment_id = ${appointmentId}`;
        return res.status(200).json({ message: 'Invitations deleted successfully' });
      }

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invitation ID or appointmentId is required' });
      }

      await sql`DELETE FROM appointment_invitations WHERE id = ${id}`;
      return res.status(200).json({ message: 'Invitation deleted successfully' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Database Error in appointment-invitations:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

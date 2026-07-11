import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db';
import * as crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id, inviteeId, eventId, status, countOnly } = req.query;

    if (req.method === 'GET') {
      if (inviteeId && typeof inviteeId === 'string') {
        if (status === 'pending' && countOnly === 'true') {
          // Count unviewed pending invitations
          const result = await sql`
            SELECT COUNT(*)::int as count 
            FROM event_invitations 
            WHERE invitee_id = ${inviteeId} AND status = 'pending' AND viewed = FALSE
          `;
          return res.status(200).json({ count: result[0].count });
        }
        
        const rows = await sql`
          SELECT ei.*, e.name as event_name, e.datetime as event_datetime,
                 e.location as event_location, e.image_url as event_image_url
          FROM event_invitations ei
          JOIN events e ON ei.event_id = e.id
          WHERE ei.invitee_id = ${inviteeId}
          ORDER BY ei.created_at DESC
        `;
        return res.status(200).json(rows);
      }

      if (eventId && typeof eventId === 'string') {
        const rows = await sql`
          SELECT * FROM event_invitations 
          WHERE event_id = ${eventId}
          ORDER BY created_at DESC
        `;
        return res.status(200).json(rows);
      }

      if (id && typeof id === 'string') {
        const rows = await sql`SELECT * FROM event_invitations WHERE id = ${id}`;
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Invitation not found' });
        }
        return res.status(200).json(rows[0]);
      }

      const rows = await sql`SELECT * FROM event_invitations ORDER BY created_at DESC`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { eventId, inviterId, inviteeId, role, status } = req.body;

      if (!eventId || !inviterId || !inviteeId) {
        return res.status(400).json({ error: 'eventId, inviterId, and inviteeId are required' });
      }

      const invitationId = crypto.randomBytes(10).toString('hex');

      await sql`
        INSERT INTO event_invitations (id, event_id, inviter_id, invitee_id, role, status, viewed)
        VALUES (${invitationId}, ${eventId}, ${inviterId}, ${inviteeId}, ${role || ''}, ${status || 'pending'}, FALSE)
      `;

      return res.status(201).json({ id: invitationId, eventId, inviteeId, status: status || 'pending' });
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
          UPDATE event_invitations 
          SET status = ${status}, viewed = ${viewed}
          WHERE id = ${invitationId}
          RETURNING *
        `;
      } else if (status !== undefined) {
        result = await sql`
          UPDATE event_invitations 
          SET status = ${status}
          WHERE id = ${invitationId}
          RETURNING *
        `;
      } else if (viewed !== undefined) {
        result = await sql`
          UPDATE event_invitations 
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
      if (eventId && typeof eventId === 'string') {
        // Delete all invitations for this event
        await sql`DELETE FROM event_invitations WHERE event_id = ${eventId}`;
        return res.status(200).json({ message: 'Invitations deleted successfully' });
      }

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invitation ID or eventId is required' });
      }

      await sql`DELETE FROM event_invitations WHERE id = ${id}`;
      return res.status(200).json({ message: 'Invitation deleted successfully' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Database Error in event-invitations:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

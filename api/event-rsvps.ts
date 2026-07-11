import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { eventId, userId } = req.query;

    if (req.method === 'GET') {
      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ error: 'eventId is required' });
      }

      if (userId && typeof userId === 'string') {
        // Check if user already RSVPed
        const rows = await sql`
          SELECT * FROM event_rsvps 
          WHERE event_id = ${eventId} AND user_id = ${userId}
        `;
        return res.status(200).json({ exists: rows.length > 0, data: rows[0] || null });
      }

      // Get all RSVPs for this event ordered by joined_at
      const rows = await sql`
        SELECT * FROM event_rsvps 
        WHERE event_id = ${eventId} 
        ORDER BY joined_at ASC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { eventId, userId, displayName, pictureUrl } = req.body;

      if (!eventId || !userId) {
        return res.status(400).json({ error: 'eventId and userId are required' });
      }

      const eventRows = await sql`
        SELECT COALESCE((to_jsonb(events)->>'rsvp_enabled')::boolean, TRUE) AS rsvp_enabled
        FROM events WHERE id = ${eventId}
      `;
      if (eventRows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      if (!eventRows[0].rsvp_enabled) {
        return res.status(403).json({ error: 'ปิดการรับลงชื่อแล้ว' });
      }

      // Use upsert to handle duplicate join requests
      const result = await sql`
        INSERT INTO event_rsvps (event_id, user_id, display_name, picture_url, joined_at)
        VALUES (${eventId}, ${userId}, ${displayName || ''}, ${pictureUrl || ''}, CURRENT_TIMESTAMP)
        ON CONFLICT (event_id, user_id) DO UPDATE SET
          display_name = COALESCE(EXCLUDED.display_name, event_rsvps.display_name),
          picture_url = COALESCE(EXCLUDED.picture_url, event_rsvps.picture_url)
        RETURNING *
      `;

      return res.status(201).json(result[0]);
    }

    if (req.method === 'DELETE') {
      const targetEventId = eventId || req.body.eventId;
      const targetUserId = userId || req.body.userId;

      if (!targetEventId || typeof targetEventId !== 'string' || !targetUserId || typeof targetUserId !== 'string') {
        return res.status(400).json({ error: 'eventId and userId are required' });
      }

      await sql`
        DELETE FROM event_rsvps 
        WHERE event_id = ${targetEventId} AND user_id = ${targetUserId}
      `;
      return res.status(200).json({ message: 'RSVP withdrawn successfully' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Database Error in event-rsvps:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

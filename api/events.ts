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
    const { id } = req.query;

    if (req.method === 'GET') {
      if (id && typeof id === 'string') {
        const rows = await sql`SELECT * FROM events WHERE id = ${id}`;
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Event not found' });
        }
        return res.status(200).json(rows[0]);
      } else {
        const rows = await sql`SELECT * FROM events ORDER BY created_at DESC`;
        return res.status(200).json(rows);
      }
    }

    if (req.method === 'POST') {
      const {
        name,
        imageUrl,
        datetime,
        startDatetimeIso,
        endDatetimeDisplay,
        endDatetimeIso,
        location,
        description,
        invitationText,
        invitationColor,
        buttonColor,
        videoThumbnailUrl,
        createdBy,
        linkType,
        linkLabel,
        linkUrl,
        detailUrl,
      } = req.body;

      if (!name || !datetime) {
        return res.status(400).json({ error: 'Name and datetime are required' });
      }

      const eventId = crypto.randomBytes(10).toString('hex');

      await sql`
        INSERT INTO events (
          id, name, image_url, datetime, start_datetime_iso, 
          end_datetime_display, end_datetime_iso, location, 
          description, invitation_text, invitation_color, 
          button_color, video_thumbnail_url, created_by,
          link_type, link_label, link_url, detail_url
        ) VALUES (
          ${eventId}, ${name}, ${imageUrl || ''}, ${datetime}, ${startDatetimeIso || null}, 
          ${endDatetimeDisplay || null}, ${endDatetimeIso || null}, ${location || ''}, 
          ${description || ''}, ${invitationText || ''}, ${invitationColor || ''}, 
          ${buttonColor || ''}, ${videoThumbnailUrl || ''}, ${createdBy || ''},
          ${linkType || 'none'}, ${linkLabel || ''}, ${linkUrl || ''}, ${detailUrl || ''}
        )
      `;

      return res.status(201).json({ id: eventId, name, datetime });
    }

    if (req.method === 'PUT') {
      const eventId = id || req.body.id;
      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      const {
        name,
        imageUrl,
        datetime,
        startDatetimeIso,
        endDatetimeDisplay,
        endDatetimeIso,
        location,
        description,
        invitationText,
        invitationColor,
        buttonColor,
        videoThumbnailUrl,
        linkType,
        linkLabel,
        linkUrl,
        detailUrl,
        rsvpEnabled,
        requesterId,
      } = req.body;

      if (typeof rsvpEnabled === 'boolean') {
        await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_enabled BOOLEAN NOT NULL DEFAULT TRUE`;
        const toggleResult = await sql`
          UPDATE events SET rsvp_enabled = ${rsvpEnabled}
          WHERE id = ${eventId} AND created_by = ${requesterId || ''}
          RETURNING *
        `;
        if (toggleResult.length === 0) {
          return res.status(403).json({ error: 'Only the event creator can change RSVP availability' });
        }
        return res.status(200).json(toggleResult[0]);
      }

      const result = await sql`
        UPDATE events SET
          name = COALESCE(${name}, name),
          image_url = COALESCE(${imageUrl}, image_url),
          datetime = COALESCE(${datetime}, datetime),
          start_datetime_iso = COALESCE(${startDatetimeIso}, start_datetime_iso),
          end_datetime_display = COALESCE(${endDatetimeDisplay}, end_datetime_display),
          end_datetime_iso = COALESCE(${endDatetimeIso}, end_datetime_iso),
          location = COALESCE(${location}, location),
          description = COALESCE(${description}, description),
          invitation_text = COALESCE(${invitationText}, invitation_text),
          invitation_color = COALESCE(${invitationColor}, invitation_color),
          button_color = COALESCE(${buttonColor}, button_color),
          video_thumbnail_url = COALESCE(${videoThumbnailUrl}, video_thumbnail_url),
          link_type = COALESCE(${linkType}, link_type),
          link_label = COALESCE(${linkLabel}, link_label),
          link_url = COALESCE(${linkUrl}, link_url),
          detail_url = COALESCE(${detailUrl}, detail_url)
        WHERE id = ${eventId}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      return res.status(200).json(result[0]);
    }

    if (req.method === 'DELETE') {
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      await sql`DELETE FROM events WHERE id = ${id}`;
      return res.status(200).json({ message: 'Event deleted successfully' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Database Error in events:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

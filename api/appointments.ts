import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db.js';
import * as crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
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
        const rows = await sql`SELECT * FROM appointments WHERE id = ${id}`;
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Appointment not found' });
        }
        return res.status(200).json(rows[0]);
      } else {
        const rows = await sql`SELECT * FROM appointments ORDER BY created_at DESC`;
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
        linkType,
        linkUrl,
        createdBy,
      } = req.body;

      if (!name || !datetime) {
        return res.status(400).json({ error: 'Name and datetime are required' });
      }

      const appointmentId = crypto.randomBytes(10).toString('hex'); // Generate 20-character alphanumeric ID

      await sql`
        INSERT INTO appointments (
          id, name, image_url, datetime, start_datetime_iso, 
          end_datetime_display, end_datetime_iso, location, 
          description, link_type, link_url, created_by
        ) VALUES (
          ${appointmentId}, ${name}, ${imageUrl || ''}, ${datetime}, ${startDatetimeIso || null}, 
          ${endDatetimeDisplay || null}, ${endDatetimeIso || null}, ${location || ''}, 
          ${description || ''}, ${linkType || 'none'}, ${linkUrl || ''}, ${createdBy || ''}
        )
      `;

      return res.status(201).json({ id: appointmentId, name, datetime });
    }

    if (req.method === 'PUT') {
      const appointmentId = id || req.body.id;
      if (!appointmentId || typeof appointmentId !== 'string') {
        return res.status(400).json({ error: 'Appointment ID is required' });
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
        linkType,
        linkUrl,
      } = req.body;

      const result = await sql`
        UPDATE appointments SET
          name = COALESCE(${name}, name),
          image_url = COALESCE(${imageUrl}, image_url),
          datetime = COALESCE(${datetime}, datetime),
          start_datetime_iso = COALESCE(${startDatetimeIso}, start_datetime_iso),
          end_datetime_display = COALESCE(${endDatetimeDisplay}, end_datetime_display),
          end_datetime_iso = COALESCE(${endDatetimeIso}, end_datetime_iso),
          location = COALESCE(${location}, location),
          description = COALESCE(${description}, description),
          link_type = COALESCE(${linkType}, link_type),
          link_url = COALESCE(${linkUrl}, link_url)
        WHERE id = ${appointmentId}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      return res.status(200).json(result[0]);
    }

    if (req.method === 'DELETE') {
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Appointment ID is required' });
      }

      await sql`DELETE FROM appointments WHERE id = ${id}`;
      return res.status(200).json({ message: 'Appointment deleted successfully' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Database Error in appointments:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

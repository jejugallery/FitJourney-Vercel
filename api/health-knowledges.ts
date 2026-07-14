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
        const rows = await sql`SELECT * FROM health_knowledges WHERE id = ${id}`;
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Health knowledge not found' });
        }
        return res.status(200).json(rows[0]);
      } else {
        const rows = await sql`SELECT * FROM health_knowledges ORDER BY created_at DESC`;
        return res.status(200).json(rows);
      }
    }

    if (req.method === 'POST') {
      const {
        title,
        category,
        videoUrl,
        videoThumbnailUrl,
        imageUrl,
        description,
        isChallenge,
        createdBy,
      } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const knowledgeId = crypto.randomBytes(10).toString('hex');
      const finalVideoThumbnailUrl = videoThumbnailUrl || imageUrl || '';

      await sql`
        INSERT INTO health_knowledges (
          id, title, category, video_url, video_thumbnail_url, description, is_challenge, created_by
        ) VALUES (
          ${knowledgeId}, ${title}, ${category || ''}, ${videoUrl || ''}, ${finalVideoThumbnailUrl}, 
          ${description || ''}, ${isChallenge || false}, ${createdBy || ''}
        )
      `;

      return res.status(201).json({ id: knowledgeId, title });
    }

    if (req.method === 'PUT') {
      const knowledgeId = id || req.body.id;
      if (!knowledgeId || typeof knowledgeId !== 'string') {
        return res.status(400).json({ error: 'Knowledge ID is required' });
      }

      const {
        title,
        category,
        videoUrl,
        videoThumbnailUrl,
        imageUrl,
        description,
        isChallenge,
      } = req.body;

      const finalVideoThumbnailUrl = videoThumbnailUrl !== undefined ? videoThumbnailUrl : imageUrl;

      const result = await sql`
        UPDATE health_knowledges SET
          title = COALESCE(${title}, title),
          category = COALESCE(${category}, category),
          video_url = COALESCE(${videoUrl}, video_url),
          video_thumbnail_url = COALESCE(${finalVideoThumbnailUrl}, video_thumbnail_url),
          description = COALESCE(${description}, description),
          is_challenge = COALESCE(${isChallenge}, is_challenge)
        WHERE id = ${knowledgeId}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Health knowledge not found' });
      }

      return res.status(200).json(result[0]);
    }

    if (req.method === 'DELETE') {
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Knowledge ID is required' });
      }

      await sql`DELETE FROM health_knowledges WHERE id = ${id}`;
      return res.status(200).json({ message: 'Health knowledge deleted successfully' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Database Error in health-knowledges:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

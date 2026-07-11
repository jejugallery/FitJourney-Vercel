import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db';
import * as crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { knowledgeId } = req.query;

    if (req.method === 'GET') {
      if (!knowledgeId || typeof knowledgeId !== 'string') {
        return res.status(400).json({ error: 'knowledgeId query parameter is required' });
      }

      const rows = await sql`
        SELECT * FROM knowledge_notes 
        WHERE knowledge_id = ${knowledgeId}
        ORDER BY created_at DESC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { knowledgeId: bodyKnowledgeId, userId, displayName, pictureUrl, note } = req.body;

      const targetKnowledgeId = bodyKnowledgeId || knowledgeId;

      if (!targetKnowledgeId || !userId || !note) {
        return res.status(400).json({ error: 'knowledgeId, userId, and note are required' });
      }

      const noteId = crypto.randomBytes(10).toString('hex');

      const result = await sql`
        INSERT INTO knowledge_notes (id, knowledge_id, user_id, display_name, picture_url, note, created_at)
        VALUES (${noteId}, ${targetKnowledgeId}, ${userId}, ${displayName || ''}, ${pictureUrl || ''}, ${note}, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      return res.status(201).json(result[0]);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Database Error in knowledge-notes:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

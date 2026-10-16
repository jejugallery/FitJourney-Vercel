import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db.js';
import axios from 'axios';
import * as crypto from 'crypto';

let tablesPromise: Promise<void> | null = null;
const ensureSpyGameTables = () => {
  if (!tablesPromise) {
    tablesPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS spy_game_rooms (
          id TEXT PRIMARY KEY,
          host_id TEXT NOT NULL,
          host_name TEXT NOT NULL,
          category TEXT DEFAULT 'food',
          status TEXT DEFAULT 'waiting',
          common_word TEXT,
          spy_word TEXT,
          spy_user_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS spy_game_players (
          room_id TEXT NOT NULL REFERENCES spy_game_rooms(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          picture_url TEXT,
          word TEXT,
          is_spy BOOLEAN DEFAULT FALSE,
          is_host BOOLEAN DEFAULT FALSE,
          card_viewed BOOLEAN DEFAULT FALSE,
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (room_id, user_id)
        );
      `;
    })().catch(err => {
      tablesPromise = null;
      console.error('[Database] Create spy_game tables error:', err);
    });
  }
  return tablesPromise;
};

const getGeminiApiKeys = async (): Promise<string[]> => {
  let apiKeys: string[] = [];
  try {
    const res = await axios.get(
      'https://firestore.googleapis.com/v1/projects/fitjourneythailand/databases/(default)/documents/system_configs/gemini'
    );
    const values = res.data?.fields?.apiKeys?.arrayValue?.values || [];
    apiKeys = values.map((v: any) => v.stringValue || '').filter(Boolean);
  } catch (err: any) {
    console.warn('[Spy Game] Could not fetch keys from Firestore:', err.message);
  }

  if (apiKeys.length === 0) {
    const keysString =
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEYS ||
      process.env.VITE_GEMINI_API_KEY ||
      '';
    apiKeys = keysString.split(',').map((k: string) => k.trim()).filter(Boolean);
  }
  return apiKeys;
};

const FALLBACK_WORDS: Record<string, [string, string][]> = {
  food: [
    ['ข้าวมันไก่', 'ข้าวหมกไก่'],
    ['ชาบู', 'หมูกระทะ'],
    ['ส้มตำไทย', 'ส้มตำปูปลาร้า'],
    ['ก๋วยเตี๋ยวน้ำตก', 'ก๋วยเตี๋ยวต้มยำ'],
    ['ผัดกะเพรา', 'ผัดพริกเผา'],
    ['ชานมไข่มุก', 'ชาเขียวมัทฉะ'],
    ['พิซซ่า', 'เบอร์เกอร์'],
    ['ไอศกรีม', 'บิงซู'],
    ['ข้าวเหนียวมะม่วง', 'ข้าวเหนียวทุเรียน'],
    ['ต้มยำกุ้ง', 'ต้มข่าไก่'],
    ['ไก่ทอด', 'หมูทอด'],
    ['ผัดไทย', 'ผัดซีอิ๊ว'],
    ['แกงเขียวหวาน', 'แกงเผ็ด'],
    ['เฟรนช์ฟรายส์', 'มันฝรั่งทอดกรอบ'],
    ['ซูชิ', 'ซาชิมิ'],
    ['กาแฟดำ', 'ชาดำเย็น'],
    ['หมูปิ้ง', 'ไก่ปิ้ง'],
    ['โรตี', 'เครป'],
  ],
  daily: [
    ['แปรงสีฟัน', 'ยาสีฟัน'],
    ['สบู่เหลว', 'แชมพู'],
    ['ช้อน', 'ส้อม'],
    ['ผ้าเช็ดตัว', 'ผ้าเช็ดหน้า'],
    ['พัดลม', 'แอร์'],
    ['หมอนหนุน', 'หมอนข้าง'],
    ['แก้วน้ำ', 'กระบอกน้ำ'],
    ['หวี', 'แปรงผม'],
    ['กรรไกร', 'คัตเตอร์'],
    ['สมุด', 'กระดาษ'],
    ['ปากกา', 'ดินสอ'],
    ['รองเท้าแตะ', 'รองเท้าผ้าใบ'],
    ['ร่ม', 'เสื้อกันฝน'],
    ['กระเป๋าเป้', 'กระเป๋าสะพาย'],
    ['นาฬิกาข้อมือ', 'นาฬิกาปลุก'],
    ['แว่นตา', 'แว่นกันแดด'],
    ['เตารีด', 'ไดร์เป่าผม'],
    ['ทิชชู่เปียก', 'ทิชชู่แห้ง'],
  ],
};

function getRandomFallbackWords(category: string): { commonWord: string; spyWord: string } {
  const list = FALLBACK_WORDS[category] || FALLBACK_WORDS.food;
  const pair = list[Math.floor(Math.random() * list.length)];
  const swap = Math.random() < 0.5;
  return {
    commonWord: swap ? pair[1] : pair[0],
    spyWord: swap ? pair[0] : pair[1],
  };
}

async function generateSpyWords(category: string): Promise<{ commonWord: string; spyWord: string }> {
  const categoryName = category === 'daily' ? 'ของใช้ในชีวิตประจำวัน' : 'อาหาร';
  const prompt = `คิดคำศัพท์ภาษาไทย 2 คำ ในหมวดหมู่ "${categoryName}" สำหรับเล่นเกมจับสายลับ (Undercover / Spy Game)
ข้อกำหนดสำคัญ:
1. คำ 2 คำนี้ต้องเป็นสิ่งของหรืออาหารประเภทเดียวกันหรือคล้ายคลึงกันมาก (เพื่อให้ผู้เล่นใบ้คำแล้วจับได้ยาก)
2. เป็นคำที่คนไทยทั่วไปรู้จักดี ชัดเจน สั้นกระชับ ไม่กำกวม
ตัวอย่างถ้าเป็นหมวดอาหาร: ข้าวมันไก่ กับ ข้าวหมกไก่, หรือ ชาบู กับ หมูกระทะ
ตัวอย่างถ้าเป็นหมวดของใช้: แปรงสีฟัน กับ ยาสีฟัน, หรือ สบู่เหลว กับ แชมพู

ตอบกลับเป็น JSON เท่านั้น (ห้ามมีคำอธิบายอื่น ห้ามใส่ \`\`\`json):
{
  "word1": "คำแรก",
  "word2": "คำที่สอง"
}`;

  try {
    const apiKeys = await getGeminiApiKeys();
    const models = [
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash-lite',
    ];

    for (const apiKey of apiKeys) {
      for (const model of models) {
        try {
          const res = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
          );
          let raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(raw);
          if (parsed.word1 && parsed.word2 && parsed.word1.trim() !== parsed.word2.trim()) {
            const swap = Math.random() < 0.5;
            return {
              commonWord: swap ? parsed.word2.trim() : parsed.word1.trim(),
              spyWord: swap ? parsed.word1.trim() : parsed.word2.trim(),
            };
          }
        } catch (e) {
          // continue
        }
      }
    }
  } catch (err) {
    console.warn('[Spy Game] AI word generation failed, using fallback list');
  }

  return getRandomFallbackWords(category);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  await ensureSpyGameTables();

  const action = (req.query.action as string) || (req.body?.action as string) || 'get-room';

  try {
    // 1. GET ROOM / GET STATE
    if (action === 'get-room') {
      const roomId = ((req.query.roomId || req.body?.roomId) as string)?.trim().toLowerCase();
      const userId = ((req.query.userId || req.body?.userId) as string)?.trim();

      if (!roomId) {
        return res.status(400).json({ error: 'Missing roomId' });
      }

      const rooms = await sql`
        SELECT * FROM spy_game_rooms WHERE LOWER(id) = ${roomId} LIMIT 1
      `;
      if (rooms.length === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const room = rooms[0];
      const players = await sql`
        SELECT user_id, display_name, picture_url, is_host, card_viewed, joined_at
        ${room.status === 'revealed' ? sql`, word, is_spy` : sql``}
        FROM spy_game_players
        WHERE LOWER(room_id) = ${roomId}
        ORDER BY joined_at ASC
      `;

      let me: any = null;
      if (userId) {
        const meRows = await sql`
          SELECT * FROM spy_game_players
          WHERE LOWER(room_id) = ${roomId} AND user_id = ${userId}
          LIMIT 1
        `;
        if (meRows.length > 0) {
          me = meRows[0];
        }
      }

      // Hide secret game words from room response unless revealed
      const sanitizedRoom = {
        id: room.id,
        hostId: room.host_id,
        hostName: room.host_name,
        category: room.category,
        status: room.status,
        createdAt: room.created_at,
        updatedAt: room.updated_at,
        ...(room.status === 'revealed' ? {
          commonWord: room.common_word,
          spyWord: room.spy_word,
          spyUserId: room.spy_user_id,
        } : {}),
      };

      return res.status(200).json({
        room: sanitizedRoom,
        players,
        me: me ? {
          userId: me.user_id,
          displayName: me.display_name,
          pictureUrl: me.picture_url,
          isHost: me.is_host,
          word: me.word, // Player's own word only!
          isSpy: room.status === 'revealed' ? me.is_spy : undefined,
          cardViewed: me.card_viewed,
        } : null,
        isHost: me ? me.is_host : false,
      });
    }

    // 2. JOIN ROOM (First user becomes Host)
    if (action === 'join') {
      const { roomId: rawRoomId, userId, displayName, pictureUrl } = req.body || {};
      const roomId = rawRoomId?.trim().toLowerCase();

      if (!roomId || !userId || !displayName) {
        return res.status(400).json({ error: 'Missing required join fields' });
      }

      const existingRooms = await sql`
        SELECT * FROM spy_game_rooms WHERE LOWER(id) = ${roomId} LIMIT 1
      `;

      let isHost = false;

      if (existingRooms.length === 0) {
        // First player in room -> Host!
        isHost = true;
        await sql`
          INSERT INTO spy_game_rooms (id, host_id, host_name, category, status)
          VALUES (${roomId}, ${userId}, ${displayName}, 'food', 'waiting')
        `;
      } else {
        isHost = existingRooms[0].host_id === userId;
      }

      // Upsert player
      await sql`
        INSERT INTO spy_game_players (room_id, user_id, display_name, picture_url, is_host)
        VALUES (${roomId}, ${userId}, ${displayName}, ${pictureUrl || ''}, ${isHost})
        ON CONFLICT (room_id, user_id)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          picture_url = COALESCE(EXCLUDED.picture_url, spy_game_players.picture_url),
          is_host = CASE WHEN spy_game_players.is_host THEN TRUE ELSE EXCLUDED.is_host END
      `;

      return res.status(200).json({ success: true, isHost });
    }

    // 3. UPDATE CATEGORY (Host only)
    if (action === 'update-category') {
      const { roomId: rawRoomId, userId, category } = req.body || {};
      const roomId = rawRoomId?.trim().toLowerCase();

      if (!roomId || !userId || !category) {
        return res.status(400).json({ error: 'Missing fields' });
      }

      const rooms = await sql`
        SELECT * FROM spy_game_rooms WHERE LOWER(id) = ${roomId} LIMIT 1
      `;
      if (rooms.length === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (rooms[0].host_id !== userId) {
        return res.status(403).json({ error: 'Only the Host can change the category' });
      }

      const validCategory = category === 'daily' ? 'daily' : 'food';
      await sql`
        UPDATE spy_game_rooms
        SET category = ${validCategory}, updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(id) = ${roomId}
      `;

      return res.status(200).json({ success: true, category: validCategory });
    }

    // 4. START GAME (Host only -> AI Generates 2 Words & Distributes Roles)
    if (action === 'start') {
      const { roomId: rawRoomId, userId } = req.body || {};
      const roomId = rawRoomId?.trim().toLowerCase();

      if (!roomId || !userId) {
        return res.status(400).json({ error: 'Missing fields' });
      }

      const rooms = await sql`
        SELECT * FROM spy_game_rooms WHERE LOWER(id) = ${roomId} LIMIT 1
      `;
      if (rooms.length === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const room = rooms[0];
      if (room.host_id !== userId) {
        return res.status(403).json({ error: 'Only the Host can start the game' });
      }

      const players = await sql`
        SELECT user_id, display_name FROM spy_game_players
        WHERE LOWER(room_id) = ${roomId}
        ORDER BY joined_at ASC
      `;

      if (players.length < 2) {
        return res.status(400).json({ error: 'ต้องมีผู้เล่นอย่างน้อย 2 คนขึ้นไป' });
      }

      // Generate words via AI (or fallback)
      const { commonWord, spyWord } = await generateSpyWords(room.category || 'food');

      // Randomly select 1 Spy
      const spyIndex = Math.floor(Math.random() * players.length);
      const spyPlayer = players[spyIndex];

      // Update room state
      await sql`
        UPDATE spy_game_rooms
        SET
          status = 'playing',
          common_word = ${commonWord},
          spy_word = ${spyWord},
          spy_user_id = ${spyPlayer.user_id},
          updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(id) = ${roomId}
      `;

      // Update each player's word
      for (const p of players) {
        const isSpy = p.user_id === spyPlayer.user_id;
        const assignedWord = isSpy ? spyWord : commonWord;
        await sql`
          UPDATE spy_game_players
          SET
            word = ${assignedWord},
            is_spy = ${isSpy},
            card_viewed = false
          WHERE LOWER(room_id) = ${roomId} AND user_id = ${p.user_id}
        `;
      }

      return res.status(200).json({ success: true, status: 'playing' });
    }

    // 5. REVEAL GAME RESULTS (Host only)
    if (action === 'reveal') {
      const { roomId: rawRoomId, userId } = req.body || {};
      const roomId = rawRoomId?.trim().toLowerCase();

      const rooms = await sql`
        SELECT * FROM spy_game_rooms WHERE LOWER(id) = ${roomId} LIMIT 1
      `;
      if (rooms.length === 0) return res.status(404).json({ error: 'Room not found' });
      if (rooms[0].host_id !== userId) return res.status(403).json({ error: 'Host only' });

      await sql`
        UPDATE spy_game_rooms
        SET status = 'revealed', updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(id) = ${roomId}
      `;

      return res.status(200).json({ success: true, status: 'revealed' });
    }

    // 6. RESET ROOM / PLAY AGAIN (Host only)
    if (action === 'reset') {
      const { roomId: rawRoomId, userId } = req.body || {};
      const roomId = rawRoomId?.trim().toLowerCase();

      const rooms = await sql`
        SELECT * FROM spy_game_rooms WHERE LOWER(id) = ${roomId} LIMIT 1
      `;
      if (rooms.length === 0) return res.status(404).json({ error: 'Room not found' });
      if (rooms[0].host_id !== userId) return res.status(403).json({ error: 'Host only' });

      await sql`
        UPDATE spy_game_rooms
        SET
          status = 'waiting',
          common_word = NULL,
          spy_word = NULL,
          spy_user_id = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(id) = ${roomId}
      `;

      await sql`
        UPDATE spy_game_players
        SET word = NULL, is_spy = false, card_viewed = false
        WHERE LOWER(room_id) = ${roomId}
      `;

      return res.status(200).json({ success: true, status: 'waiting' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    console.error('[Spy Game API Error]:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

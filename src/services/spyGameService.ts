import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fetchGeminiWithFallback } from '../utils/geminiHelper';

export interface SpyPlayer {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  isHost: boolean;
  word?: string;
  isSpy?: boolean;
  cardViewed?: boolean;
  joinedAt?: number;
  // Aliases for compatibility
  user_id: string;
  display_name: string;
  picture_url?: string;
  is_host: boolean;
  is_spy?: boolean;
  card_viewed?: boolean;
}

export interface SpyRoom {
  id: string;
  roomName?: string;
  hostId: string;
  hostName: string;
  category: 'food' | 'daily';
  status: 'waiting' | 'playing' | 'revealed';
  commonWord?: string;
  spyWord?: string;
  spyUserId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const POETIC_ROOM_NAMES = [
  'สายลมที่พัดผ่าน',
  'แสงจันทร์กระจ่าง',
  'ประกายดาวราตรี',
  'หยาดน้ำค้างยามเช้า',
  'ลำธารเงียบสงบ',
  'กลิ่นหอมดอกโมก',
  'สนธยาสีคราม',
  'หมอกขาวเหนือยอดดอย',
  'ท่วงทำนองสายฝน',
  'อรุณรุ่งเรืองรอง',
  'คลื่นกระทบฝั่ง',
  'บทกวีแห่งสายน้ำ',
  'ไอหมอกฤดูหนาว',
  'เสียงกระซิบแห่งขุนเขา',
  'เมฆลอยละล่อง',
  'หิ่งห้อยใต้แสงดาว',
  'แสงตะวันอบอุ่น',
  'เงาจันทร์ในธารน้ำ',
  'กลีบกุหลาบแรกแย้ม',
  'เงาไม้ใต้ร่มเย็น'
];

export async function generatePoeticRoomNameWithAI(): Promise<string> {
  const fallback = POETIC_ROOM_NAMES[Math.floor(Math.random() * POETIC_ROOM_NAMES.length)];
  try {
    const prompt = 'คิดชื่อห้องเกมภาษาไทยสั้นๆ สไตล์บทกวี ไพเราะ มีความหมาย ซาบซึ้ง ความยาว 2-4 คำ เช่น สายลมที่พัดผ่าน, แสงจันทร์กระจ่าง, ประกายดาวราตรี ตอบมาแค่ชื่อเดียวสั้นๆ ไม่มีเครื่องหมายคำพูด ไม่มีคำอธิบาย';
    const res = await fetchGeminiWithFallback(['gemini-2.5-flash-lite', 'gemini-1.5-flash'], [{ parts: [{ text: prompt }] }]);
    const text = res.rawText?.trim()?.replace(/["'«»“”\n]/g, '');
    if (text && text.length >= 2 && text.length <= 30) {
      return text;
    }
  } catch (e) {
    // fallback
  }
  return fallback;
}

export const FALLBACK_WORDS: Record<string, [string, string][]> = {
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

export function getRandomFallbackWords(category: string): { commonWord: string; spyWord: string } {
  const list = FALLBACK_WORDS[category] || FALLBACK_WORDS.food;
  const pair = list[Math.floor(Math.random() * list.length)];
  const swap = Math.random() < 0.5;
  return {
    commonWord: swap ? pair[1] : pair[0],
    spyWord: swap ? pair[0] : pair[1],
  };
}

export async function generateSpyWordsWithAI(category: 'food' | 'daily'): Promise<{ commonWord: string; spyWord: string }> {
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
    const models = [
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-2.5-flash-lite',
    ];
    const res = await fetchGeminiWithFallback(models, [{ parts: [{ text: prompt }] }]);
    let raw = res.rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(raw);
    if (parsed.word1 && parsed.word2 && parsed.word1.trim() !== parsed.word2.trim()) {
      const swap = Math.random() < 0.5;
      return {
        commonWord: swap ? parsed.word2.trim() : parsed.word1.trim(),
        spyWord: swap ? parsed.word1.trim() : parsed.word2.trim(),
      };
    }
  } catch (err) {
    console.warn('[SpyGame] Gemini generation failed, using fallback list:', err);
  }

  return getRandomFallbackWords(category);
}

/**
 * Join or initialize room in Firestore
 */
export async function joinSpyGameRoom(
  roomId: string,
  user: { userId: string; displayName: string; pictureUrl?: string },
  suggestedRoomName?: string
): Promise<void> {
  const cleanRoomId = roomId.trim().toLowerCase();
  const roomRef = doc(db, 'spy_game_rooms', cleanRoomId);
  const playerRef = doc(db, 'spy_game_rooms', cleanRoomId, 'players', user.userId);

  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    // Room doesn't exist: Current user is the host and creates the room
    const poeticName = suggestedRoomName?.trim() || (await generatePoeticRoomNameWithAI());
    await setDoc(roomRef, {
      id: cleanRoomId,
      roomName: poeticName,
      hostId: user.userId,
      hostName: user.displayName,
      category: 'food',
      status: 'waiting',
      commonWord: '',
      spyWord: '',
      spyUserId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(playerRef, {
      userId: user.userId,
      displayName: user.displayName,
      pictureUrl: user.pictureUrl || '',
      isHost: true,
      isSpy: false,
      word: '',
      cardViewed: false,
      joinedAt: Date.now(),
    });
  } else {
    // Room exists: Add or update player
    const roomData = roomSnap.data() as SpyRoom;
    const playerSnap = await getDoc(playerRef);

    const isHost = roomData.hostId === user.userId;

    if (!roomData.roomName && suggestedRoomName?.trim()) {
      await updateDoc(roomRef, {
        roomName: suggestedRoomName.trim(),
      });
    }

    if (!playerSnap.exists()) {
      await setDoc(playerRef, {
        userId: user.userId,
        displayName: user.displayName,
        pictureUrl: user.pictureUrl || '',
        isHost,
        isSpy: false,
        word: '',
        cardViewed: false,
        joinedAt: Date.now(),
      });
    } else {
      // Just update display name / picture if changed
      await updateDoc(playerRef, {
        displayName: user.displayName,
        pictureUrl: user.pictureUrl || '',
        isHost,
      });
    }
  }
}

/**
 * Update room category (Host only)
 */
export async function updateSpyRoomCategory(roomId: string, category: 'food' | 'daily'): Promise<void> {
  const cleanRoomId = roomId.trim().toLowerCase();
  const roomRef = doc(db, 'spy_game_rooms', cleanRoomId);
  await updateDoc(roomRef, {
    category,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Start game (Host only): generate words and assign roles to all players
 */
export async function startSpyGame(
  roomId: string,
  category: 'food' | 'daily',
  players: SpyPlayer[]
): Promise<void> {
  if (players.length < 2) {
    throw new Error('ต้องมีผู้เล่นอย่างน้อย 2 คนขึ้นไปเพื่อเริ่มเกม');
  }

  const cleanRoomId = roomId.trim().toLowerCase();
  const { commonWord, spyWord } = await generateSpyWordsWithAI(category);

  // Pick random spy
  const spyIndex = Math.floor(Math.random() * players.length);
  const spyPlayer = players[spyIndex];

  const batch = writeBatch(db);

  // Update room
  const roomRef = doc(db, 'spy_game_rooms', cleanRoomId);
  batch.update(roomRef, {
    status: 'playing',
    category,
    commonWord,
    spyWord,
    spyUserId: spyPlayer.userId,
    updatedAt: serverTimestamp(),
  });

  // Assign cards to each player
  for (const player of players) {
    const isSpy = player.userId === spyPlayer.userId;
    const playerRef = doc(db, 'spy_game_rooms', cleanRoomId, 'players', player.userId);
    batch.update(playerRef, {
      isSpy,
      word: isSpy ? spyWord : commonWord,
      cardViewed: false,
    });
  }

  await batch.commit();
}

/**
 * Mark player card as viewed
 */
export async function markSpyCardViewed(roomId: string, userId: string): Promise<void> {
  const cleanRoomId = roomId.trim().toLowerCase();
  const playerRef = doc(db, 'spy_game_rooms', cleanRoomId, 'players', userId);
  await updateDoc(playerRef, {
    cardViewed: true,
  });
}

/**
 * Reveal spy and words (Host only)
 */
export async function revealSpyGame(roomId: string): Promise<void> {
  const cleanRoomId = roomId.trim().toLowerCase();
  const roomRef = doc(db, 'spy_game_rooms', cleanRoomId);
  await updateDoc(roomRef, {
    status: 'revealed',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Reset game for new round (Host only)
 */
export async function resetSpyGame(roomId: string, players: SpyPlayer[]): Promise<void> {
  const cleanRoomId = roomId.trim().toLowerCase();
  const batch = writeBatch(db);

  const roomRef = doc(db, 'spy_game_rooms', cleanRoomId);
  batch.update(roomRef, {
    status: 'waiting',
    commonWord: '',
    spyWord: '',
    spyUserId: '',
    updatedAt: serverTimestamp(),
  });

  for (const player of players) {
    const playerRef = doc(db, 'spy_game_rooms', cleanRoomId, 'players', player.userId);
    batch.update(playerRef, {
      isSpy: false,
      word: '',
      cardViewed: false,
    });
  }

  await batch.commit();
}

/**
 * Realtime listener for room doc
 */
export function subscribeToSpyRoom(
  roomId: string,
  onUpdate: (room: SpyRoom | null) => void
): () => void {
  const cleanRoomId = roomId.trim().toLowerCase();
  const roomRef = doc(db, 'spy_game_rooms', cleanRoomId);
  return onSnapshot(
    roomRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as SpyRoom);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.error('[SpyGame] Room listener error:', err);
    }
  );
}

/**
 * Realtime listener for players in room
 */
export function subscribeToSpyPlayers(
  roomId: string,
  onUpdate: (players: SpyPlayer[]) => void
): () => void {
  const cleanRoomId = roomId.trim().toLowerCase();
  const playersCol = collection(db, 'spy_game_rooms', cleanRoomId, 'players');
  return onSnapshot(
    playersCol,
    (snap) => {
      const list: SpyPlayer[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const p: SpyPlayer = {
          userId: d.userId || d.user_id || docSnap.id,
          displayName: d.displayName || d.display_name || 'ผู้เล่น',
          pictureUrl: d.pictureUrl || d.picture_url || '',
          isHost: !!(d.isHost ?? d.is_host),
          word: d.word || '',
          isSpy: !!(d.isSpy ?? d.is_spy),
          cardViewed: !!(d.cardViewed ?? d.card_viewed),
          joinedAt: d.joinedAt || 0,
          // Compatibility aliases
          user_id: d.userId || d.user_id || docSnap.id,
          display_name: d.displayName || d.display_name || 'ผู้เล่น',
          picture_url: d.pictureUrl || d.picture_url || '',
          is_host: !!(d.isHost ?? d.is_host),
          is_spy: !!(d.isSpy ?? d.is_spy),
          card_viewed: !!(d.cardViewed ?? d.card_viewed),
        };
        list.push(p);
      });
      // Sort by joinedAt
      list.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
      onUpdate(list);
    },
    (err) => {
      console.error('[SpyGame] Players listener error:', err);
    }
  );
}

import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  limit,
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
  status: 'waiting' | 'playing' | 'revealed' | 'closed';
  commonWord?: string;
  spyWord?: string;
  spyUserId?: string;
  usedWords?: string[];
  createdAt?: any;
  updatedAt?: any;
  lastActiveAt?: number;
  expiresAt?: any;
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
    const res = await fetchGeminiWithFallback(['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'], [{ parts: [{ text: prompt }] }]);
    const text = res.rawText?.trim()?.replace(/["'«»“”\n]/g, '');
    if (text && text.length >= 2 && text.length <= 30) {
      return text;
    }
  } catch (e) {
    // fallback
  }
  return fallback;
}

export const FALLBACK_WORDS: Record<string, string[]> = {
  food: [
    'ข้าวมันไก่', 'ข้าวหมกไก่', 'ข้าวขาหมู', 'ข้าวผัดกุ้ง', 'ข้าวคลุกกะปิ', 'ข้าวไข่เจียว', 'ข้าวซอย', 'ข้าวต้มปลา',
    'ส้มตำไทย', 'ส้มตำปูปลาร้า', 'ลาบหมู', 'น้ำตกคอหมูย่าง', 'ตับหวาน', 'ซุปหน่อไม้', 'ยำวุ้นเส้น',
    'ชาบู', 'หมูกระทะ', 'จิ้มจุ่ม', 'สุกี้ยากี้', 'หมูจุ่ม',
    'ต้มยำกุ้ง', 'ต้มข่าไก่', 'แกงส้มชะอมกุ้ง', 'แกงเขียวหวานไก่', 'แกงมัสมั่น', 'ต้มแซ่บกระดูกอ่อน', 'แกงจืดเต้าหู้หมูสับ', 'แกงไตปลา',
    'ผัดกะเพรา', 'ผัดซีอิ๊ว', 'ผัดไทย', 'ราดหน้า', 'ก๋วยเตี๋ยวเรือ', 'ก๋วยเตี๋ยวต้มยำ', 'บะหมี่เกี๊ยวหมูแดง', 'ผัดพริกแกง',
    'ไก่ทอดหาดใหญ่', 'หมูปิ้ง', 'ไก่ย่าง', 'ทอดมันกุ้ง', 'คอหมูย่าง', 'ปีกไก่ทอด', 'หมูกรอบ', 'แหนมเนือง',
    'ซูชิ', 'ราเมง', 'ทาโกะยากิ', 'ปิ้งย่างเกาหลี', 'คิมบับ', 'ต๊อกบกกี',
    'พิซซ่า', 'เบอร์เกอร์', 'เฟรนช์ฟรายส์', 'สเต็ก', 'สปาเกตตีคาโบนาร่า',
    'ข้าวเหนียวมะม่วง', 'บิงซู', 'ไอศกรีม', 'ชานมไข่มุก', 'โรตี', 'บัวลอย', 'ลอดช่อง', 'ปาท่องโก๋', 'กล้วยทอด', 'เครปญี่ปุ่น',
    'ทุเรียน', 'มังคุด', 'มะม่วงน้ำปลาหวาน', 'แตงโมปั่น', 'ชาเขียวมัทฉะ', 'กาแฟโบราณ',
  ],
  daily: [
    'แปรงสีฟัน', 'ยาสีฟัน', 'สบู่เหลว', 'ยาสระผม', 'ครีมนวดผม', 'โฟมล้างหน้า', 'มีดโกนหนวด', 'ไหมขัดฟัน', 'น้ำยาบ้วนปาก',
    'ผ้าเช็ดตัว', 'ผ้าเช็ดหน้า', 'หมวกคลุมผม', 'ไดร์เป่าผม', 'หวี', 'กรรไกรตัดเล็บ', 'ครีมทาผิว', 'น้ำหอม', 'แป้งฝุ่น',
    'หมอนหนุน', 'หมอนข้าง', 'ผ้าห่ม', 'ผ้าปูที่นอน', 'เตียงนอน', 'นาฬิกาปลุก', 'โคมไฟหัวเตียง',
    'แว่นตา', 'แว่นกันแดด', 'นาฬิกาข้อมือ', 'กระเป๋าสะพาย', 'กระเป๋าเป้', 'กระเป๋าสตางค์', 'หมวกแก๊ป', 'ร่มพับ', 'เสื้อกันฝน', 'รองเท้าแตะ', 'รองเท้าผ้าใบ',
    'ช้อนส้อม', 'ตะเกียบ', 'จานชาม', 'แก้วน้ำ', 'กระบอกน้ำเก็บความเย็น', 'หลอดดูดน้ำ', 'มีดทำครัว', 'เขียง', 'กระทะ', 'หม้อหุงข้าว', 'กาต้มน้ำร้อน', 'ไมโครเวฟ',
    'กรรไกร', 'คัตเตอร์', 'สมุดโน้ต', 'ปากกา', 'ดินสอ', 'ยางลบ', 'สก็อตเทป', 'แม็กเย็บกระดาษ', 'ไม้บรรทัด',
    'โทรศัพท์มือถือ', 'สายชาร์จ', 'พาวเวอร์แบงค์', 'หูฟัง', 'แล็ปท็อป', 'รีโมททีวี', 'พัดลม', 'เครื่องฟอกอากาศ', 'ปลั๊กพ่วง',
    'ไม้กวาด', 'ที่โกยผง', 'ไม้ถูพื้น', 'น้ำยาล้างจาน', 'ผงซักฟอก', 'น้ำยาปรับผ้านุ่ม', 'ถังขยะ', 'ทิชชู่เปียก', 'ทิชชู่ม้วน',
  ],
};

export const SUB_THEMES: Record<string, string[]> = {
  food: [
    'อาหารจานเดียว / เมนูตามสั่งยอดนิยม',
    'เมนูเส้น / ก๋วยเตี๋ยว / บะหมี่ / สปาเกตตี',
    'สตรีทฟู้ด / เมนูของว่าง / ของทอด / ปิ้งย่างเสียบไม้',
    'อาหารอีสานรสแซ่บ / ซีฟู้ดทะเล',
    'เมนูต้ม / ซุป / แกงไทยรสเข้มข้น',
    'ของหวาน / ขนมไทย / เบเกอรี่ / ไอศกรีม',
    'เครื่องดื่ม / ชา / กาแฟ / ชานม / น้ำปั่น',
    'อาหารนานาชาติยอดฮิตในไทย (ญี่ปุ่น, เกาหลี, ฝรั่ง)',
    'อาหารเช้า / ของกินเล่นตามตลาดนัด',
  ],
  daily: [
    'ของใช้ในห้องน้ำ / ผลิตภัณฑ์ทำความสะอาดร่างกาย',
    'ของใช้ในห้องนอน / เครื่องนอนเพื่อการพักผ่อน',
    'เครื่องเขียน / อุปกรณ์บนโต๊ะทำงานหรือห้องเรียน',
    'เครื่องใช้ไฟฟ้าขนาดเล็กหรือแก็ดเจ็ตในบ้าน',
    'ของใช้ในครัว / บนโต๊ะอาหาร',
    'ของใช้พกติดตัว / ของสำคัญในกระเป๋าสะพาย',
    'เครื่องแต่งกาย / รองเท้า / เครื่องประดับ',
    'อุปกรณ์ทำความสะอาดบ้าน / ซักรีด',
    'แกดเจ็ต / อุปกรณ์อิเล็กทรอนิกส์ส่วนบุคคล',
  ],
};

export function getRandomFallbackWords(category: string, usedWords: string[] = []): { commonWord: string; spyWord: string } {
  const list = FALLBACK_WORDS[category] || FALLBACK_WORDS.food;
  const available = list.filter((w) => !usedWords.includes(w));
  const pool = available.length > 0 ? available : list;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return {
    commonWord: pick,
    spyWord: 'ไม่มีคำศัพท์ (SPY)',
  };
}

export async function generateSpyWordsWithAI(
  category: 'food' | 'daily',
  usedWords: string[] = []
): Promise<{ commonWord: string; spyWord: string }> {
  const categoryName = category === 'daily' ? 'ของใช้ในชีวิตประจำวัน' : 'อาหาร';
  const subThemes = SUB_THEMES[category] || SUB_THEMES.food;
  const randomTheme = subThemes[Math.floor(Math.random() * subThemes.length)];
  const randomSeed = Math.floor(Math.random() * 1000000);

  const excludePrompt = usedWords.length > 0
    ? `\nข้อห้ามสำคัญที่สุด: ห้ามสุ่มหรือเลือกคำต่อไปนี้เด็ดขาดเพราะเพิ่งเล่นไปแล้ว: [${usedWords.slice(-30).join(', ')}]`
    : '';

  const prompt = `คิดคำศัพท์ภาษาไทย 1 คำ ในหมวดหมู่ "${categoryName}" เพื่อใช้เล่นเกมจับสายลับ (Undercover Game)
จุดเน้นประเภทของรอบนี้: "${randomTheme}"
(Random Seed ID: ${randomSeed})
${excludePrompt}

ข้อกำหนดและเกณฑ์การเลือก:
1. ต้องเป็นคำศัพท์ภาษาไทยที่คนทั่วไปรู้จักคุ้นเคยเป็นอย่างดี (ความยาว 1-4 พยางค์)
2. มีเอกลักษณ์เฉพาะตัว ชัดเจน ไม่กำกวม เพื่อให้ผู้เล่นนำไปคิดคำใบ้ได้สนุกและหลากหลาย
3. ห้ามซ้ำกับคำที่ระบุในข้อห้ามด้านบนอย่างเด็ดขาด และขอคำที่สดใหม่ แปลกใหม่ ไม่จำเจ

ตอบกลับเป็นรูปแบบ JSON เท่านั้น (ห้ามมี markdown หรือคำอธิบายใดๆ ทั้งสิ้น):
{
  "word": "คำศัพท์ภาษาไทย"
}`;

  try {
    const models = [
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ];
    const res = await fetchGeminiWithFallback(
      models,
      [{ parts: [{ text: prompt }] }],
      {
        temperature: 1.0,
        topP: 0.95,
      }
    );
    let raw = res.rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(raw);
    const word = (parsed.word || parsed.word1 || '').trim();
    if (word && typeof word === 'string' && !usedWords.includes(word)) {
      return {
        commonWord: word,
        spyWord: 'ไม่มีคำศัพท์ (SPY)',
      };
    }
  } catch (err) {
    console.warn('[SpyGame] Gemini generation failed, using fallback list:', err);
  }

  return getRandomFallbackWords(category, usedWords);
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
      lastActiveAt: Date.now(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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

    const updates: Record<string, any> = {
      lastActiveAt: Date.now(),
      updatedAt: serverTimestamp(),
    };
    if (!roomData.roomName && suggestedRoomName?.trim()) {
      updates.roomName = suggestedRoomName.trim();
    }
    await updateDoc(roomRef, updates);

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

  // Trigger background cleanup for inactive rooms older than 24h
  cleanupExpiredSpyRooms().catch(() => {});
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
  const roomRef = doc(db, 'spy_game_rooms', cleanRoomId);
  const roomSnap = await getDoc(roomRef);
  const currentRoomData = roomSnap.data();
  const existingUsedWords: string[] = Array.isArray(currentRoomData?.usedWords)
    ? currentRoomData.usedWords
    : [];

  const { commonWord, spyWord } = await generateSpyWordsWithAI(category, existingUsedWords);

  // Pick random spy
  const spyIndex = Math.floor(Math.random() * players.length);
  const spyPlayer = players[spyIndex];

  const batch = writeBatch(db);

  // Update room with new word and keep history of last 50 used words to prevent repeats
  const updatedUsedWords = [...existingUsedWords.slice(-50), commonWord];

  batch.update(roomRef, {
    status: 'playing',
    category,
    commonWord,
    spyWord,
    spyUserId: spyPlayer.userId,
    usedWords: updatedUsedWords,
    updatedAt: serverTimestamp(),
  });

  // Assign cards to each player
  for (const player of players) {
    const isSpy = player.userId === spyPlayer.userId;
    const playerRef = doc(db, 'spy_game_rooms', cleanRoomId, 'players', player.userId);
    batch.update(playerRef, {
      isSpy,
      word: isSpy ? '' : commonWord,
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

/**
 * Leave Room:
 * - If last player leaves: delete room entirely
 * - If host leaves and other players remain: pass host to next player
 * - If regular player leaves: remove player doc
 */
export async function leaveSpyGameRoom(
  roomId: string,
  userId: string,
  players: SpyPlayer[]
): Promise<void> {
  const cleanRoomId = roomId.trim().toLowerCase();
  const playerRef = doc(db, 'spy_game_rooms', cleanRoomId, 'players', userId);
  await deleteDoc(playerRef).catch(() => {});

  const remaining = players.filter((p) => p.userId !== userId);
  const roomRef = doc(db, 'spy_game_rooms', cleanRoomId);

  if (remaining.length === 0) {
    // Last player left: Delete room document completely
    await deleteDoc(roomRef).catch(() => {});
  } else {
    // If leaving player was host, assign host to first remaining player
    const leavingWasHost = players.find((p) => p.userId === userId)?.isHost;
    if (leavingWasHost) {
      const newHost = remaining[0];
      await updateDoc(roomRef, {
        hostId: newHost.userId,
        hostName: newHost.displayName,
        lastActiveAt: Date.now(),
      }).catch(() => {});

      const newHostPlayerRef = doc(db, 'spy_game_rooms', cleanRoomId, 'players', newHost.userId);
      await updateDoc(newHostPlayerRef, {
        isHost: true,
      }).catch(() => {});
    } else {
      await updateDoc(roomRef, {
        lastActiveAt: Date.now(),
      }).catch(() => {});
    }
  }
}

/**
 * Close Room (Host only):
 * Deletes room and all players, notifying everyone that room is closed
 */
export async function closeSpyGameRoom(roomId: string): Promise<void> {
  const cleanRoomId = roomId.trim().toLowerCase();
  const roomRef = doc(db, 'spy_game_rooms', cleanRoomId);

  // Notify connected clients that room is closed
  await updateDoc(roomRef, {
    status: 'closed',
    lastActiveAt: Date.now(),
  }).catch(() => {});

  // Delete all players in subcollection
  const playersCol = collection(db, 'spy_game_rooms', cleanRoomId, 'players');
  const playerSnaps = await getDocs(playersCol);
  const batch = writeBatch(db);
  playerSnaps.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  batch.delete(roomRef);
  await batch.commit().catch(() => {});
}

/**
 * Auto-Cleanup routine:
 * Removes inactive rooms older than 24 hours to keep Firestore database clean
 */
export async function cleanupExpiredSpyRooms(): Promise<void> {
  try {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const q = query(
      collection(db, 'spy_game_rooms'),
      where('lastActiveAt', '<', oneDayAgo),
      limit(5)
    );
    const snaps = await getDocs(q);
    for (const roomDoc of snaps.docs) {
      const roomId = roomDoc.id;
      const playersCol = collection(db, 'spy_game_rooms', roomId, 'players');
      const pSnaps = await getDocs(playersCol);
      const batch = writeBatch(db);
      pSnaps.forEach((p) => batch.delete(p.ref));
      batch.delete(roomDoc.ref);
      await batch.commit().catch(() => {});
    }
  } catch (err) {
    // Non-blocking catch
    console.warn('[SpyGame] Inactive rooms cleanup:', err);
  }
}

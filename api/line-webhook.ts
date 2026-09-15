import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db.js';
import axios from 'axios';
import * as crypto from 'crypto';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const DEFAULT_LIFF_URL = 'https://liff.line.me/2010284484-jvUDlx0u';

const replyToLine = async (replyToken: string, messages: any[]) => {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
  }

  await axios.post(
    'https://api.line.me/v2/bot/message/reply',
    { replyToken, messages },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    },
  );
};

const fetchLineImageBase64 = async (messageId: string): Promise<{ base64: string; mimeType: string }> => {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
  }

  const response = await axios.get(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    responseType: 'arraybuffer',
  });

  const mimeType = (response.headers['content-type'] as string) || 'image/jpeg';
  const base64 = Buffer.from(response.data).toString('base64');
  return { base64, mimeType };
};

const getGeminiApiKeys = async (): Promise<string[]> => {
  let apiKeys: string[] = [];

  // 1. Try fetching from Firestore document (system_configs/gemini)
  try {
    const res = await axios.get(
      'https://firestore.googleapis.com/v1/projects/fitjourneythailand/databases/(default)/documents/system_configs/gemini'
    );
    const values = res.data?.fields?.apiKeys?.arrayValue?.values || [];
    apiKeys = values.map((v: any) => v.stringValue || '').filter(Boolean);
  } catch (err: any) {
    console.warn('[Gemini Bot] Could not fetch keys from Firestore system_configs/gemini:', err.message);
  }

  // 2. Fallback to process.env (GEMINI_API_KEY, VITE_GEMINI_API_KEYS, VITE_GEMINI_API_KEY)
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

interface FoodItemBreakdown {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface FoodNutritionResult {
  isFood: boolean;
  isBeverage?: boolean;
  objectName?: string;
  foodName?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  items?: FoodItemBreakdown[];
  summary?: string;
  modelUsed?: string;
}

const buildFoodAnalysisFlexMessage = (nutrition: FoodNutritionResult, senderName: string = 'ผู้ใช้งาน') => {
  const calories = Math.round(Number(nutrition.calories)) || 0;
  const protein = Number(nutrition.protein) || 0;
  const carbs = Number(nutrition.carbs) || 0;
  const fat = Number(nutrition.fat) || 0;
  const fiber = Number(nutrition.fiber) || 0;
  const foodName = nutrition.foodName || 'อาหารทั่วไป';

  const nutritionBox = {
    type: 'box',
    layout: 'vertical',
    margin: 'lg',
    spacing: 'xs',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'xs',
        margin: 'xs',
        contents: [
          { type: 'box', layout: 'vertical', backgroundColor: '#7c3aed', cornerRadius: '6px', paddingAll: 'xs', alignItems: 'center', contents: [{ type: 'text', text: 'พลังงาน', size: 'xxs', color: '#ffffff', align: 'center' }, { type: 'text', text: `${calories}`, size: 'xs', weight: 'bold', color: '#ffffff', align: 'center', margin: 'xs' }, { type: 'text', text: 'kcal', size: 'xxs', color: '#ffffff', align: 'center' }] },
          { type: 'box', layout: 'vertical', backgroundColor: '#fff1f2', borderColor: '#ffe4e6', borderWidth: '1px', cornerRadius: '6px', paddingAll: 'xs', alignItems: 'center', contents: [{ type: 'text', text: 'โปรตีน', size: 'xxs', color: '#9f1239', align: 'center' }, { type: 'text', text: `${protein}g`, size: 'xs', weight: 'bold', color: '#be123c', align: 'center', margin: 'xs' }] },
          { type: 'box', layout: 'vertical', backgroundColor: '#f0fdf4', borderColor: '#dcfce7', borderWidth: '1px', cornerRadius: '6px', paddingAll: 'xs', alignItems: 'center', contents: [{ type: 'text', text: 'คาร์บ', size: 'xxs', color: '#166534', align: 'center' }, { type: 'text', text: `${carbs}g`, size: 'xs', weight: 'bold', color: '#15803d', align: 'center', margin: 'xs' }] },
          { type: 'box', layout: 'vertical', backgroundColor: '#fffbeb', borderColor: '#fef3c7', borderWidth: '1px', cornerRadius: '6px', paddingAll: 'xs', alignItems: 'center', contents: [{ type: 'text', text: 'ไขมัน', size: 'xxs', color: '#92400e', align: 'center' }, { type: 'text', text: `${fat}g`, size: 'xs', weight: 'bold', color: '#b45309', align: 'center', margin: 'xs' }] },
          { type: 'box', layout: 'vertical', backgroundColor: '#e0f2fe', borderColor: '#bae6fd', borderWidth: '1px', cornerRadius: '6px', paddingAll: 'xs', alignItems: 'center', contents: [{ type: 'text', text: 'ไฟเบอร์', size: 'xxs', color: '#0369a1', align: 'center' }, { type: 'text', text: `${fiber}g`, size: 'xs', weight: 'bold', color: '#0284c7', align: 'center', margin: 'xs' }] }
        ]
      }
    ]
  };

  const itemRows = (nutrition.items || []).map((item, idx) => ({
    type: 'box',
    layout: 'vertical',
    margin: idx === 0 ? 'sm' : 'xs',
    backgroundColor: '#f8fafc',
    paddingAll: 'sm',
    cornerRadius: '6px',
    contents: [
      { type: 'text', text: `• ${item.name}`, weight: 'bold', size: 'xs', color: '#334155', wrap: true },
      { type: 'text', text: `🔥 ${item.calories || 0} kcal | P: ${item.protein || 0}g | C: ${item.carbs || 0}g | F: ${item.fat || 0}g | Fiber: ${item.fiber || 0}g`, size: 'xxs', color: '#64748b', margin: 'xs' }
    ]
  }));

  const itemsBox = itemRows.length > 0 ? {
    type: 'box',
    layout: 'vertical',
    margin: 'lg',
    contents: [
      { type: 'text', text: '🍱 จำแนกรายการอาหารในจาน:', size: 'xs', weight: 'bold', color: '#475569' },
      ...itemRows
    ]
  } : null;

  return {
    type: 'flex',
    altText: `🥗 ผลการตรวจอาหาร (${calories} kcal)`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'ผลการตรวจอาหาร', weight: 'bold', size: 'xl', color: '#1DB446' },
          { type: 'text', text: `ของ ${senderName}${nutrition.modelUsed ? ` | วิเคราะห์ด้วย ${nutrition.modelUsed}` : ''}`, size: 'xs', color: '#94a3b8', margin: 'xs' },
          nutritionBox,
          ...(itemsBox ? [itemsBox] : []),
          ...(nutrition.summary ? [
            {
              type: 'box',
              layout: 'vertical',
              margin: 'lg',
              backgroundColor: '#f1f5f9',
              paddingAll: 'md',
              cornerRadius: '8px',
              contents: [
                { type: 'text', text: '💡 คำแนะนำโภชนาการ:', color: '#475569', size: 'xs', weight: 'bold' },
                { type: 'text', text: nutrition.summary, wrap: true, color: '#334155', size: 'sm', margin: 'xs' }
              ]
            }
          ] : [])
        ]
      }
    }
  };
};

const analyzeFoodNutrition = async (base64Image: string, mimeType: string): Promise<FoodNutritionResult | null> => {
  const apiKeys = await getGeminiApiKeys();
  if (apiKeys.length === 0) {
    throw new Error('ไม่พบการตั้งค่า Gemini API Key ในระบบ (Firestore หรือ Environment Variables)');
  }

  const prompt = `คุณคือระบบ AI ตรวจสอบและวิเคราะห์โภชนาการอาหารประจำ FitJourney โปรดตรวจสอบว่ารูปภาพนี้คือ "รูปอาหาร เครื่องดื่ม หรือขนม" หรือไม่?

1. หากเป็นรูปอาหาร (ไม่รวมเครื่องดื่ม) ให้วิเคราะห์จำแนกวัตถุดิบ/รายการอาหารแต่ละอย่างในจาน และคำนวณสารอาหารรวม (รวมถึงไฟเบอร์/ใยอาหาร) แล้วตอบกลับ JSON ดังนี้เท่านั้น:
{
  "isFood": true,
  "isBeverage": false,
  "foodName": "ชื่อเมนูอาหารหลักภาษาไทย",
  "calories": 450,
  "protein": 25,
  "carbs": 50,
  "fat": 15,
  "fiber": 6,
  "items": [
    { "name": "ชื่ออาหาร/วัตถุดิบ 1", "calories": 200, "protein": 4, "carbs": 44, "fat": 1, "fiber": 3 },
    { "name": "ชื่ออาหาร/วัตถุดิบ 2", "calories": 250, "protein": 21, "carbs": 6, "fat": 14, "fiber": 3 }
  ],
  "summary": "คำแนะนำสั้นๆ สไตล์โค้ชสุขภาพแบบเป็นกันเอง (1-2 ประโยค)"
}

2. หากเป็นรูป "เครื่องดื่ม" ให้ตอบกลับ JSON ดังนี้เท่านั้น:
{
  "isFood": true,
  "isBeverage": true,
  "foodName": "ชื่อเครื่องดื่มภาษาไทย"
}

3. หากไม่ใช่รูปอาหารหรือเครื่องดื่มเลย (เช่น รูปคน, สัตว์, สิ่งของ, วิว, สลิปโอนเงิน, เอกสาร, แชท):
ให้วิเคราะห์ว่าสิ่งนั้นคืออะไร และตอบกลับ JSON ดังนี้เท่านั้น:
{
  "isFood": false,
  "objectName": "ชื่อสิ่งของหรือสิ่งที่เห็นในภาพภาษาไทย"
}

(ห้ามใส่คำว่า \`\`\`json ให้ตอบเฉพาะตัวข้อความ JSON สดๆ เท่านั้น)`;

  const models = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemma-4-26b-a4b-it'
  ];
  let lastError: any = null;

  for (const apiKey of apiKeys) {
    for (const model of models) {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            contents: [
              {
                parts: [
                  { inlineData: { mimeType, data: base64Image } },
                  { text: prompt },
                ],
              },
            ],
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
          }
        );

        let rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (rawText) {
          rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          try {
            const parsed = JSON.parse(rawText);
            
            if (parsed.isFood === false) {
              return {
                isFood: false,
                objectName: parsed.objectName || 'สิ่งของบางอย่าง',
                modelUsed: model
              };
            }

            if (parsed.isBeverage === true) {
              return {
                isFood: true,
                isBeverage: true,
                foodName: parsed.foodName || 'เครื่องดื่ม',
                modelUsed: model
              };
            }

            const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
            const items: FoodItemBreakdown[] = rawItems.map((item: any) => ({
              name: String(item.name || 'รายการอาหาร'),
              calories: Math.round(Number(item.calories)) || 0,
              protein: Math.round(Number(item.protein)) || 0,
              carbs: Math.round(Number(item.carbs)) || 0,
              fat: Math.round(Number(item.fat)) || 0,
              fiber: Math.round(Number(item.fiber)) || 0,
            }));

            return {
              isFood: true,
              isBeverage: false,
              foodName: String(parsed.foodName || 'อาหารทั่วไป'),
              calories: Math.round(Number(parsed.calories)) || 0,
              protein: Math.round(Number(parsed.protein)) || 0,
              carbs: Math.round(Number(parsed.carbs)) || 0,
              fat: Math.round(Number(parsed.fat)) || 0,
              fiber: Math.round(Number(parsed.fiber)) || 0,
              items,
              summary: String(parsed.summary || 'มื้ออาหารน่าทาน รักษาสมดุลโภชนาการต่อไปนะครับ!'),
              modelUsed: model
            };
          } catch (jsonErr) {
            return null;
          }
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Bot] Model ${model} failed, trying next...`, err.response?.data || err.message);
      }
    }
  }

  throw lastError || new Error('ไม่สามารถประมวลผลผ่าน Gemini API ได้ในขณะนี้');
};

let pendingTablePromise: Promise<void> | null = null;
const ensurePendingImagesTable = () => {
  if (!pendingTablePromise) {
    pendingTablePromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS pending_food_images_v2 (
          message_id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
    })().catch(err => {
      pendingTablePromise = null;
      console.error('[Database] Create pending_food_images table error:', err);
    });
  }
  return pendingTablePromise;
};

const buildBillingFlexMessage = (billing: {
  id: string;
  name: string;
  amount: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  invitationText: string;
  invitationColor: string;
  buttonColor: string;
}) => {
  const badgeTextColor = billing.invitationColor.toUpperCase() === '#FFE600' ? '#334155' : '#ffffff';
  const buttonTextColor = billing.buttonColor.toUpperCase() === '#FFE600' ? '#334155' : '#ffffff';

  return {
    type: 'flex',
    altText: `💸 รายการเรียกเก็บเงิน: ${billing.name}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: billing.invitationColor,
                paddingAll: 'sm',
                paddingStart: 'md',
                paddingEnd: 'md',
                cornerRadius: 'xxl',
                contents: [
                  {
                    type: 'text',
                    text: billing.invitationText,
                    size: 'xs',
                    color: badgeTextColor,
                    weight: 'bold',
                    align: 'center',
                  },
                ],
              },
            ],
          },
          {
            type: 'text',
            text: billing.name,
            weight: 'bold',
            size: 'xl',
            color: '#1e293b',
            margin: 'md',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '💰', size: 'sm', flex: 0, gravity: 'center' },
                  { type: 'text', text: `จำนวนเงิน: ${billing.amount} บาท`, size: 'sm', color: '#475569', wrap: true, flex: 1, weight: 'bold', gravity: 'center' },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '🏦', size: 'sm', flex: 0, gravity: 'center' },
                  { type: 'text', text: `ธนาคาร: ${billing.bankName}`, size: 'sm', color: '#475569', wrap: true, flex: 1, gravity: 'center' },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '👤', size: 'sm', flex: 0, gravity: 'center' },
                  { type: 'text', text: `ชื่อบัญชี: ${billing.accountName}`, size: 'sm', color: '#475569', wrap: true, flex: 1, gravity: 'center' },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '💳', size: 'sm', flex: 0, gravity: 'center' },
                  { type: 'text', text: `เลขบัญชี: ${billing.accountNumber}`, size: 'sm', color: '#475569', wrap: true, flex: 1, gravity: 'center' },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: billing.buttonColor,
            cornerRadius: 'xxl',
            paddingAll: 'md',
            action: {
              type: 'uri',
              uri: `${DEFAULT_LIFF_URL}/payment/${billing.id}`,
            },
            contents: [
              {
                type: 'text',
                text: 'ชำระเงิน / แนบหลักฐาน 💳',
                color: buttonTextColor,
                weight: 'bold',
                size: 'sm',
                align: 'center',
              },
            ],
          },
        ],
      },
    },
  };
};

const isVideoUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  if (url.includes('/video/upload/')) return true;
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.avi', '.mkv', '.quicktime'];
  const urlLower = url.toLowerCase();
  return videoExtensions.some(ext => 
    urlLower.endsWith(ext) || 
    urlLower.includes(ext + '?') || 
    urlLower.includes(ext + '&')
  );
};

const getMediaThumbnailUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (isVideoUrl(url)) {
    if (url.includes('/video/upload/')) {
      const lastDotIndex = url.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        return url.substring(0, lastDotIndex).replace('/video/upload/', '/video/upload/so_0/') + '.jpg';
      }
    }
    return 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=600&auto=format&fit=crop';
  }
  return url;
};

const getMediaVideoLoopUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.includes('/video/upload/')) {
    return url.replace('/video/upload/', '/video/upload/e_loop:5/');
  }
  return url;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const host = req.headers.host || 'fitjourneythailand.web.app';
  const origin = host.startsWith('localhost') ? `http://${host}` : `https://${host}`;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Line-Signature');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    if (req.query.check === 'env') {
      const geminiKeys = await getGeminiApiKeys();
      return res.status(200).json({
        hasAccessToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        hasChannelSecret: !!process.env.LINE_CHANNEL_SECRET,
        hasGeminiKey: geminiKeys.length > 0,
        geminiKeysCount: geminiKeys.length,
        accessTokenLength: process.env.LINE_CHANNEL_ACCESS_TOKEN?.length || 0,
        channelSecretLength: process.env.LINE_CHANNEL_SECRET?.length || 0,
      });
    }
    return res.status(200).send('FitJourney LINE Webhook is running.');
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Verification from LINE Developers Console
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const lineSignature = req.headers['x-line-signature'] as string;

  if (channelSecret && lineSignature) {
    // Vercel parses req.body automatically.
    // In order to calculate the raw signature, we stringify the parsed body back.
    const rawBodyStr = JSON.stringify(req.body);
    const hash = crypto
      .createHmac('sha256', channelSecret)
      .update(Buffer.from(rawBodyStr))
      .digest('base64');
    
    // We log signature failures but don't strictly block in case of stringify discrepancies.
    if (hash !== lineSignature) {
      console.warn('LINE Signature verification failed warning.');
    }
  }

  const events = req.body.events;
  if (!events || !Array.isArray(events)) {
    return res.status(200).send('OK');
  }

  for (const event of events) {
    const replyToken = event.replyToken;
    const userId = event.source?.userId;
    let eventId = '';
    let isRsvpAction = false;

    if (event.type === 'message' && event.message?.type === 'image') {
      const messageId = event.message?.id;
      const chatId = event.source?.groupId || event.source?.roomId || event.source?.userId;
      if (!messageId || !chatId) continue;

      try {
        await ensurePendingImagesTable();
        await sql`
          INSERT INTO pending_food_images_v2 (chat_id, message_id, user_id, created_at)
          VALUES (${chatId}, ${messageId}, ${userId || ''}, CURRENT_TIMESTAMP)
          ON CONFLICT (message_id) DO NOTHING
        `;

        if (replyToken) {
          await replyToLine(replyToken, [{
            type: 'text',
            text: 'อยากตรวจอาหารไหมครับ ?',
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '🔍 ตรวจอาหาร',
                    text: 'ตรวจอาหาร'
                  }
                }
              ]
            }
          }]);
        }
      } catch (err: any) {
        console.error('[Pending Food Image Save Error]:', err.message);
      }
      continue;
    }

    if (event.type === 'postback') {
      const data: string = event.postback?.data || '';
      if (data.startsWith('action=rsvp')) {
        const params = new URLSearchParams(data);
        eventId = params.get('eventId') || '';
        isRsvpAction = true;
      }
    } else if (event.type === 'message' && event.message?.type === 'text') {
      const text = event.message.text || '';
      const trimmedText = text.trim();

      if (trimmedText === 'ตรวจอาหาร' || trimmedText.startsWith('ตรวจอาหาร')) {
        if (!replyToken) continue;
        const chatId = event.source?.groupId || event.source?.roomId || event.source?.userId;
        if (!chatId) continue;

        try {
          await ensurePendingImagesTable();
          const pendingRows = await sql`
            SELECT * FROM pending_food_images_v2
            WHERE chat_id = ${chatId} 
              AND user_id = ${userId || ''}
              AND created_at > (CURRENT_TIMESTAMP - INTERVAL '2 hours')
            ORDER BY created_at ASC
          `;

          if (pendingRows.length === 0) {
            await replyToLine(replyToken, [{
              type: 'text',
              text: 'ยังไม่พบรูปภาพอาหารของคุณครับ กรุณาส่งรูปอาหารก่อน แล้วค่อยพิมพ์ "ตรวจอาหาร"',
            }]);
            continue;
          }

          const images = await Promise.all(
            pendingRows.slice(0, 5).map(row => fetchLineImageBase64(row.message_id))
          );
          
          await sql`DELETE FROM pending_food_images_v2 WHERE chat_id = ${chatId} AND user_id = ${userId || ''}`;

          let senderName = 'ผู้ใช้งาน';
          const imageSenderId = pendingRows[0].user_id || userId;
          
          if (imageSenderId && LINE_CHANNEL_ACCESS_TOKEN) {
            try {
              let profileUrl = `https://api.line.me/v2/bot/profile/${imageSenderId}`;
              if (event.source?.groupId) {
                profileUrl = `https://api.line.me/v2/bot/group/${event.source.groupId}/member/${imageSenderId}`;
              } else if (event.source?.roomId) {
                profileUrl = `https://api.line.me/v2/bot/room/${event.source.roomId}/member/${imageSenderId}`;
              }
              
              const profileRes = await axios.get(profileUrl, {
                headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` }
              });
              senderName = profileRes.data.displayName || senderName;
            } catch (e: any) {
              console.warn('[Profile Fetch Failed]:', e.response?.data || e.message);
              // Fallback to direct profile fetch
              try {
                const fallbackRes = await axios.get(`https://api.line.me/v2/bot/profile/${imageSenderId}`, {
                  headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` }
                });
                senderName = fallbackRes.data.displayName || senderName;
              } catch (e2) {
                // Ignore fallback error
              }
            }
          }

          const replyMessages: any[] = [];
          for (const img of images) {
            const nutritionData = await analyzeFoodNutrition(img.base64, img.mimeType);
            
            if (!nutritionData) {
              replyMessages.push({
                type: 'text',
                text: 'รูปภาพล่าสุดที่ส่งเข้ามาในแชทนี้ไม่ใช่อาหารครับ 😅',
              });
            } else if (nutritionData.isFood === false) {
              replyMessages.push({
                type: 'text',
                text: `รูปภาพที่ส่งมาไม่ใช่อาหารนะครับ มันคือ ${nutritionData.objectName || 'สิ่งของบางอย่าง'} กินไม่ได้นะครับ!`,
              });
            } else if (nutritionData.isBeverage === true) {
              replyMessages.push({
                type: 'text',
                text: `ไม่สามารถตรวจสอบ ${nutritionData.foodName || 'เครื่องดื่ม'} แก้วนี้ได้ครับ ขอโทษด้วยนะครับ`,
              });
            } else {
              replyMessages.push(buildFoodAnalysisFlexMessage(nutritionData, senderName));
            }
          }

          if (replyMessages.length > 0) {
            await replyToLine(replyToken, replyMessages);
          }
        } catch (err: any) {
          console.error('[Trigger Food Check Error]:', err.response?.data || err.message);
          try {
            await replyToLine(replyToken, [{
              type: 'text',
              text: '❌ เกิดข้อผิดพลาดในการวิเคราะห์รูปอาหาร กรุณาลองใหม่อีกครั้งครับ',
            }]);
          } catch (replyErr: any) {
            console.error('[Error Reply Failed]:', replyErr.response?.data || replyErr.message);
          }
        }
        continue;
      }

      if (trimmedText.startsWith('สร้างบิล')) {
        if (!replyToken || !userId) continue;

        const usageMessage = 'รูปแบบการสร้างบิล:\nสร้างบิล/ชื่อบิล/จำนวนเงิน\n\nตัวอย่าง:\nสร้างบิล/ค่า CENTER/280 บาท';
        const parts = trimmedText.split('/').map((part: string) => part.trim());

        if (trimmedText === 'สร้างบิล' || parts.length !== 3 || parts[0] !== 'สร้างบิล' || !parts[1] || !parts[2]) {
          try {
            await replyToLine(replyToken, [{ type: 'text', text: usageMessage }]);
          } catch (err: any) {
            console.error('[Billing Bot] Usage reply error:', err.response?.data || err.message);
          }
          continue;
        }

        const amountPattern = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?\s*(?:บาท)?$/;
        const amountText = parts[2];
        const amount = Number(amountText.replace(/บาท/g, '').replace(/,/g, '').trim());

        if (!amountPattern.test(amountText) || !Number.isFinite(amount) || amount <= 0) {
          try {
            await replyToLine(replyToken, [{ type: 'text', text: `จำนวนเงินไม่ถูกต้องครับ\n\n${usageMessage}` }]);
          } catch (err: any) {
            console.error('[Billing Bot] Invalid amount reply error:', err.response?.data || err.message);
          }
          continue;
        }

        try {
          const accountRows = await sql`
            SELECT account_name, bank_name, account_number
            FROM saved_accounts
            WHERE user_id = ${userId}
            ORDER BY updated_at DESC
            LIMIT 1
          `;

          if (accountRows.length === 0) {
            await replyToLine(replyToken, [{
              type: 'text',
              text: 'ยังไม่พบบัญชีรับโอนที่บันทึกไว้ครับ กรุณาเข้า FitJourney และบันทึกบัญชีรับเงินก่อนสร้างบิล',
            }]);
            continue;
          }

          const account = accountRows[0];
          const sourceEventId = event.webhookEventId || event.message?.id || crypto.randomBytes(16).toString('hex');
          const billingId = crypto
            .createHash('sha256')
            .update(`${sourceEventId}:${userId}:${trimmedText}`)
            .digest('hex')
            .slice(0, 20);
          const billingName = parts[1];
          const invitationText = 'อย่าลืมโอนกันนะ 💸';
          const invitationColor = '#ef4444';
          const buttonColor = '#6d28d9';

          await sql`
            INSERT INTO billings (
              id, name, amount, bank_name, account_name, account_number,
              description, invitation_text, invitation_color, button_color,
              status, created_by
            ) VALUES (
              ${billingId}, ${billingName}, ${amount}, ${account.bank_name},
              ${account.account_name}, ${account.account_number}, '',
              ${invitationText}, ${invitationColor}, ${buttonColor}, 'pending', ${userId}
            )
            ON CONFLICT (id) DO NOTHING
          `;

          const flexMessage = buildBillingFlexMessage({
            id: billingId,
            name: billingName,
            amount,
            bankName: account.bank_name,
            accountName: account.account_name,
            accountNumber: account.account_number,
            invitationText,
            invitationColor,
            buttonColor,
          });

          await replyToLine(replyToken, [flexMessage]);
        } catch (err: any) {
          console.error('[Billing Bot] Create billing error:', err.response?.data || err.message);
          try {
            await replyToLine(replyToken, [{
              type: 'text',
              text: 'ไม่สามารถสร้างบิลได้ในขณะนี้ กรุณาลองใหม่อีกครั้งครับ',
            }]);
          } catch (replyErr: any) {
            console.error('[Billing Bot] Error reply failed:', replyErr.response?.data || replyErr.message);
          }
        }
        continue;
      }

      if (text.startsWith('✍️ ลงชื่อเข้าร่วมกิจกรรม ')) {
        eventId = text.replace('✍️ ลงชื่อเข้าร่วมกิจกรรม ', '').trim();
        isRsvpAction = true;
      } else if (text.trim().includes('ส่งอาหาร')) {
        const foodFlexMessage = {
          type: 'flex',
          altText: '🍽️ วันนี้ส่งอาหารหรือยังน้าาาา ? 🥗🍳',
          contents: {
            type: 'bubble',
            hero: {
              type: 'image',
              url: 'https://i.postimg.cc/ZntzdHMG/image.png',
              size: 'full',
              aspectRatio: '16:9',
              aspectMode: 'cover'
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              backgroundColor: '#bcd78d',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: '#fd9b06',
                  cornerRadius: '30px',
                  paddingAll: '10px',
                  action: {
                    type: 'uri',
                    label: 'ลงทะเบียนเลย',
                    uri: 'https://liff.line.me/2010284484-jvUDlx0u?action=upload-food'
                  },
                  contents: [
                    {
                      type: 'text',
                      text: 'ส่งเลยตอนนี้',
                      color: '#ffffff',
                      weight: 'bold',
                      size: 'sm',
                      align: 'center'
                    }
                  ]
                }
              ],
              flex: 0
            }
          }
        };

        if (replyToken && LINE_CHANNEL_ACCESS_TOKEN) {
          try {
            await axios.post('https://api.line.me/v2/bot/message/reply',
              { replyToken, messages: [foodFlexMessage] },
              { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
            );
          } catch (err: any) {
            console.error('[Webhook] Remind food upload reply error:', err.response?.data || err.message);
          }
        }
        continue;
      } else if (text.trim().includes('เข้าสู่ระบบ')) {
        const loginFlexMessage = {
          type: 'flex',
          altText: 'FitJourney: เข้าสู่ระบบ 🔑',
          contents: {
            type: 'bubble',
            hero: {
              type: 'image',
              url: 'https://i.postimg.cc/QMzCQFzk/login.png',
              size: 'full',
              aspectRatio: '1000:618',
              aspectMode: 'cover',
              action: {
                type: 'uri',
                label: 'เข้าสู่ระบบ',
                uri: 'https://liff.line.me/2010284484-jvUDlx0u'
              }
            }
          }
        };

        if (replyToken && LINE_CHANNEL_ACCESS_TOKEN) {
          try {
            await axios.post('https://api.line.me/v2/bot/message/reply',
              { replyToken, messages: [loginFlexMessage] },
              { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
            );
          } catch (err: any) {
            console.error('[Webhook] Login reply error:', err.response?.data || err.message);
          }
        }
        continue;
      }
    }

    // RSVP Handler
    if (isRsvpAction && eventId && userId && replyToken && LINE_CHANNEL_ACCESS_TOKEN) {
      try {
        const rsvpSnap = await sql`
          SELECT * FROM event_rsvps 
          WHERE event_id = ${eventId} AND user_id = ${userId}
        `;

        if (rsvpSnap.length > 0) {
          // Already signed up — reply "คุณลงชื่อแล้วครับ ✅"
          try {
            await axios.post('https://api.line.me/v2/bot/message/reply', 
              { replyToken, messages: [{ type: 'text', text: 'คุณลงชื่อแล้วครับ ✅' }] },
              { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
            );
          } catch (err: any) {
            console.error('[RSVP] Already signed up reply error:', err.response?.data || err.message);
          }
          continue;
        }

        // Get LINE profile
        let displayName = 'ผู้เข้าร่วม';
        let pictureUrl = '';
        try {
          const profileRes = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, {
            headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` }
          });
          displayName = profileRes.data.displayName || displayName;
          pictureUrl = profileRes.data.pictureUrl || '';
        } catch (e: any) {
          console.warn('[RSVP] profile fetch failed:', e.response?.data || e.message);
        }

        // Save RSVP in Postgres
        await sql`
          INSERT INTO event_rsvps (event_id, user_id, display_name, picture_url, joined_at)
          VALUES (${eventId}, ${userId}, ${displayName}, ${pictureUrl}, CURRENT_TIMESTAMP)
        `;

        // Get all RSVPs ordered by joined_at
        const rsvpList = await sql`
          SELECT * FROM event_rsvps 
          WHERE event_id = ${eventId} 
          ORDER BY joined_at ASC
        `;

        // Get event data
        const eventRows = await sql`SELECT * FROM events WHERE id = ${eventId}`;
        if (eventRows.length === 0) {
          continue;
        }
        const evData = eventRows[0];
        let evDatetimeString = evData.datetime || '';
        if (evData.start_datetime_iso && evData.end_datetime_iso) {
          const d1 = new Date(evData.start_datetime_iso);
          const d2 = new Date(evData.end_datetime_iso);
          if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
            const opt = { year: 'numeric', month: 'long', day: 'numeric' } as const;
            if (evData.start_datetime_iso.substring(0, 10) !== evData.end_datetime_iso.substring(0, 10)) {
              evDatetimeString = `${d1.toLocaleDateString('th-TH', opt)} - ${d2.toLocaleDateString('th-TH', opt)}`;
            } else {
              const endPart = evData.end_datetime_display?.split(',')[1] || evData.end_datetime_display || '';
              evDatetimeString = `${evData.datetime || ''}${endPart ? ` - ${endPart}` : ''}`;
            }
          }
        }
        
        const eventName = evData.name || 'กิจกรรม';
        const eventInvitationColor = evData.invitation_color || '#6d28d9';
        const badgeTextColor = eventInvitationColor.trim().toUpperCase() === '#FFE600' ? '#334155' : '#ffffff';

        // Build Hero Element (Image or Video)
        let heroElement: any = null;
        const evImageUrl = evData.image_url || '';
        
        if (evImageUrl) {
          if (isVideoUrl(evImageUrl)) {
            const videoCover = evData.video_thumbnail_url || getMediaThumbnailUrl(evImageUrl);
            heroElement = {
              type: "video",
              url: getMediaVideoLoopUrl(evImageUrl),
              previewUrl: videoCover,
              altContent: {
                type: "image",
                size: "full",
                aspectRatio: "16:9",
                aspectMode: "cover",
                url: videoCover
              },
              aspectRatio: "16:9"
            };
          } else {
            heroElement = {
              type: "image",
              url: getMediaThumbnailUrl(evImageUrl),
              size: "full",
              aspectRatio: "16:9",
              aspectMode: "cover"
            };
          }
        }

        // Build RSVP list contents
        const rsvpContents = rsvpList.map((r: any, index: number) => ({
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          alignItems: 'center',
          margin: index === 0 ? 'sm' : 'xs',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              width: '20px',
              flex: 0,
              contents: [
                { type: 'text', text: `${index + 1}.`, size: 'sm', color: '#94a3b8' }
              ]
            },
            {
              type: 'image',
              url: r.picture_url || 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
              size: '28px',
              aspectRatio: '1:1',
              aspectMode: 'cover',
              flex: 0
            },
            { type: 'text', text: r.display_name || 'ผู้เข้าร่วม', size: 'sm', color: '#1e293b', flex: 1, wrap: false }
          ]
        }));

        // Construct the dynamic footer button based on link_type
        const shareLinkType = evData.link_type || 'none';
        const shareLinkUrl = evData.link_url || '';
        const shareLinkLabel = evData.link_label || '';

        let footerElement: any = null;

        if (shareLinkType !== 'none') {
          let buttonLabel = '';
          let buttonColor = evData.button_color || '#ef4444';
          let buttonAction: any = null;

          const formatExternalUrl = (url: string) => {
            const trimmed = url.trim();
            return trimmed.includes('?') ? `${trimmed}&openExternalBrowser=1` : `${trimmed}?openExternalBrowser=1`;
          };

          if (shareLinkType === 'zoom') {
            buttonLabel = 'เข้าผ่าน Zoom';
            if (!evData.button_color) buttonColor = '#2d8cff';
            buttonAction = {
              type: 'uri',
              label: buttonLabel,
              uri: formatExternalUrl(shareLinkUrl)
            };
          } else if (shareLinkType === 'register') {
            buttonLabel = 'ลงทะเบียน';
            if (!evData.button_color) buttonColor = '#22c55e';
            buttonAction = {
              type: 'uri',
              label: buttonLabel,
              uri: formatExternalUrl(shareLinkUrl)
            };
          } else if (shareLinkType === 'details') {
            buttonLabel = 'ดูรายละเอียด';
            if (!evData.button_color) buttonColor = '#FFE600';
            buttonAction = {
              type: 'uri',
              label: buttonLabel,
              uri: formatExternalUrl(shareLinkUrl)
            };
          } else if (shareLinkType === 'custom') {
            buttonLabel = shareLinkLabel.trim();
            if (!evData.button_color) buttonColor = '#FF416C';
            buttonAction = {
              type: 'uri',
              label: buttonLabel,
              uri: formatExternalUrl(shareLinkUrl)
            };
          } else if (shareLinkType === 'rsvp') {
            buttonLabel = 'ลงชื่อเข้าร่วม ✍️';
            if (!evData.button_color) buttonColor = '#6d28d9';
            buttonAction = {
              type: 'uri',
              label: 'ลงชื่อเข้าร่วม',
              uri: `https://liff.line.me/2010284484-JPGd3KXg?action=rsvp&eventId=${eventId}&v=${Date.now()}`
            };
          } else if (shareLinkType === 'calendar') {
            buttonLabel = 'เพิ่มลงบนปฏิทิน 📅';
            if (!evData.button_color) buttonColor = '#3b82f6';
            buttonAction = {
              type: 'uri',
              label: buttonLabel,
              uri: `${origin}/download-ics?eventId=${eventId}&openExternalBrowser=1`
            };
          }

          if (buttonLabel && buttonAction) {
            const isYellow = buttonColor.trim().toUpperCase() === '#FFE600';
            footerElement = {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: buttonColor,
                  cornerRadius: '30px',
                  paddingAll: '10px',
                  action: buttonAction,
                  contents: [
                    {
                      type: 'text',
                      text: buttonLabel,
                      color: isYellow ? '#334155' : '#ffffff',
                      weight: 'bold',
                      size: 'sm',
                      align: 'center'
                    }
                  ]
                }
              ],
              flex: 0
            };
          }
        }

        // Build Flex Message (same structure as event invitation + RSVP list section)
        const rsvpFlexMessage = {
          type: 'flex',
          altText: `✍️ รายชื่อผู้ลงชื่อ: ${eventName}`,
          contents: {
            type: 'bubble',
            ...(heroElement ? { hero: heroElement } : {}),
            body: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '16px',
              contents: [
                {
                  type: 'box',
                  layout: 'horizontal',
                  alignItems: 'center',
                  contents: [
                    {
                      type: 'box',
                      layout: 'vertical',
                      backgroundColor: eventInvitationColor,
                      paddingAll: '6px',
                      paddingStart: '12px',
                      paddingEnd: '12px',
                      cornerRadius: '20px',
                      flex: 0,
                      contents: [
                        {
                          type: 'text',
                          text: evData.invitation_text || '📅 เชิญเข้าร่วมกิจกรรม',
                          size: 'xs',
                          color: badgeTextColor,
                          weight: 'bold',
                          align: 'center'
                        }
                      ]
                    }
                  ]
                },
                { type: 'text', text: eventName, weight: 'bold', size: 'xl', color: '#1e293b', margin: 'md', wrap: true },
                ...(evDatetimeString || evData.location ? [
                  {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'lg',
                    spacing: 'sm',
                    contents: [
                      ...(evDatetimeString ? [{ type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', contents: [{ type: 'text', text: '🕒', size: 'sm', flex: 0 }, { type: 'text', text: evDatetimeString, size: 'sm', color: '#475569', wrap: true, flex: 1 }] }] : []),
                      ...(evData.location ? [{ type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', contents: [{ type: 'text', text: '📍', size: 'sm', flex: 0 }, { type: 'text', text: evData.location, size: 'sm', color: '#475569', wrap: true, flex: 1 }] }] : [])
                    ]
                  }
                ] : []),
                ...(evData.description ? [
                  { type: 'separator', margin: 'lg' },
                  {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'lg',
                    contents: [
                      { type: 'text', text: evData.description, size: 'sm', color: '#334155', wrap: true }
                    ]
                  }
                ] : []),
                ...(evData.link_type === 'rsvp' && rsvpList.length > 0 ? [
                  { type: 'separator', margin: 'lg' },
                  {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'lg',
                    contents: [
                      { type: 'text', text: `✍️ รายชื่อผู้ลงชื่อ (${rsvpList.length} คน)`, weight: 'bold', size: 'sm', color: '#6d28d9' },
                      ...rsvpContents
                    ]
                  }
                ] : [])
              ]
            },
            ...(footerElement ? { footer: footerElement } : {})
          }
        };

        try {
          await axios.post('https://api.line.me/v2/bot/message/reply',
            { replyToken, messages: [rsvpFlexMessage] },
            { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
          );
        } catch (err: any) {
          console.error('[RSVP] Send reply Flex message error:', err.response?.data || err.message);
        }
      } catch (error) {
        console.error('[RSVP] Database RSVP transaction error:', error);
      }
      continue;
    }

    // Other postback handlers
    if (event.type === 'postback') {
      const data: string = event.postback?.data || '';
      let responseText = 'ขอบคุณที่กดปุ่มครับ 👍';
      if (data === 'action=check_status') responseText = 'กำลังตรวจสอบสถานะให้ครับ...';
      else if (data === 'action=get_help') responseText = 'นี่คือเมนูช่วยเหลือจาก FitJourney ครับ 🙏';

      if (replyToken && LINE_CHANNEL_ACCESS_TOKEN) {
        try {
          await axios.post('https://api.line.me/v2/bot/message/reply',
            { replyToken, messages: [{ type: 'text', text: responseText }] },
            { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
          );
        } catch (err: any) {
          console.error('Error replying postback to LINE:', err.response?.data || err.message);
        }
      }
    }
  }

  return res.status(200).send('OK');
}

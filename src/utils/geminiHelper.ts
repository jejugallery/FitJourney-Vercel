import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface GeminiResponse {
  rawText: string;
  modelUsed: string;
  keyIndex: number;
}

export async function fetchGeminiWithFallback(
  model: string | string[],
  contents: any[]
): Promise<GeminiResponse> {
  const models = Array.isArray(model) ? model : [model];
  let apiKeys: string[] = [];

  // 1. พยายามดึงคีย์จาก Firestore ก่อน
  try {
    const configDoc = await getDoc(doc(db, 'system_configs', 'gemini'));
    if (configDoc.exists()) {
      const data = configDoc.data();
      if (data.apiKeys && Array.isArray(data.apiKeys)) {
        apiKeys = data.apiKeys.map((k: string) => k.trim()).filter(Boolean);
      }
    }
  } catch (firestoreErr) {
    console.warn("ไม่สามารถดึงข้อมูล Gemini Keys จาก Firestore ได้ จะใช้ค่าสำรองจาก .env:", firestoreErr);
  }

  // 2. หากดึงข้อมูลจาก Firestore ไม่สำเร็จ หรือไม่มีข้อมูล ให้ใช้ค่าจาก .env เดิม
  if (apiKeys.length === 0) {
    const keysString = import.meta.env.VITE_GEMINI_API_KEYS || import.meta.env.VITE_GEMINI_API_KEY || "";
    apiKeys = keysString.split(",").map((k: string) => k.trim()).filter(Boolean);
  }

  if (apiKeys.length === 0) {
    throw new Error("ไม่พบการตั้งค่า Gemini API Keys ทั้งบน Firestore และในระบบสภาพแวดล้อม (.env)");
  }

  let lastError: any = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];

    for (const currentModel of models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

        let response: Response;
        try {
          response = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ contents }),
            signal: controller.signal,
          });
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr.name === 'AbortError') {
            lastError = new Error(`Gemini API timeout (Key Index ${i}, Model ${currentModel}): ใช้เวลานานเกินไป กำลังลองโมเดล/คีย์ถัดไป...`);
            console.warn(`Gemini timeout on Key ${i + 1} Model ${currentModel}`);
            continue;
          }
          throw fetchErr;
        }
        clearTimeout(timeoutId);

        if (response.ok) {
          const geminiData = await response.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          return {
            rawText,
            modelUsed: currentModel,
            keyIndex: i
          };
        }

        const errorText = await response.text();
        lastError = new Error(`Gemini API error (Key Index ${i}, Model ${currentModel}): ${response.status} - ${errorText}`);
      } catch (err: any) {
        lastError = err;
      }
      console.warn(`คีย์ลำดับที่ ${i + 1} ใช้โมเดล ${currentModel} ไม่สำเร็จ กำลังลองโมเดล/คีย์ถัดไป...`);
    }
  }

  throw lastError || new Error("การทำงานล้มเหลวทุกคีย์และทุกโมเดลของ Gemini API");
}

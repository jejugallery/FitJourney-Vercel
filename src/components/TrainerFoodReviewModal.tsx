import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useLiff } from '../context/LiffContext';
import liff from '@line/liff';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import FoodNutritionCard, { parseNutrition } from './FoodNutritionCard';
import SuccessPopup from './SuccessPopup';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { fetchGeminiWithFallback } from '../utils/geminiHelper';

export default function TrainerFoodReviewModal({ trainerId, initialTraineeId, onClose }: { trainerId: string, initialTraineeId?: string | null, onClose: () => void }) {
  const { profile } = useLiff();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(initialTraineeId || null);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [lastTraineeId, setLastTraineeId] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [aiNutritionData, setAiNutritionData] = useState<Record<string, any>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [traineeMap, setTraineeMap] = useState<Record<string, { name: string, pictureUrl: string }>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [selectedTraineeGoal, setSelectedTraineeGoal] = useState<string | null>(null);

  const [reminding, setReminding] = useState(false);
  const [showRemindSuccess, setShowRemindSuccess] = useState(false);
  const [traineeMapLoaded, setTraineeMapLoaded] = useState(false);
  const [showNotMyTraineePopup, setShowNotMyTraineePopup] = useState(false);

  const handleRemindFood = async () => {
    try {
      if (!liff.isApiAvailable('shareTargetPicker')) {
        alert('อุปกรณ์นี้ไม่รองรับการแชร์ข้อความผ่าน LINE (shareTargetPicker)');
        return;
      }

      setReminding(true);

      const flexMessage = {
        type: "flex",
        altText: "🍽️ วันนี้ส่งอาหารหรือยังน้าาาา ? 🥗🍳",
        contents: {
          type: "bubble",
          hero: {
            type: "image",
            url: "https://i.postimg.cc/ZntzdHMG/image.png",
            size: "full",
            aspectRatio: "16:9",
            aspectMode: "cover"
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            backgroundColor: "#bcd78d",
            contents: [
              {
                type: "box",
                layout: "vertical",
                backgroundColor: "#fd9b06",
                cornerRadius: "30px",
                paddingAll: "10px",
                action: {
                  type: "uri",
                  label: "ลงทะเบียนเลย",
                  uri: "https://liff.line.me/2010284484-HzKokXFF"
                },
                contents: [
                  {
                    type: "text",
                    text: "ส่งเลยตอนนี้",
                    color: "#ffffff",
                    weight: "bold",
                    size: "sm",
                    align: "center"
                  }
                ]
              }
            ],
            paddingAll: "lg",
            flex: 0
          }
        }
      };

      const res = await liff.shareTargetPicker([flexMessage as any]);
      if (res) {
        setShowRemindSuccess(true);
        setTimeout(() => setShowRemindSuccess(false), 2000);
      }
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการแชร์: ' + (err.message || ""));
    } finally {
      setReminding(false);
    }
  };

  useEffect(() => {
    if (!selectedTraineeId) {
      setSelectedTraineeGoal(null);
      return;
    }
    const fetchGoal = async () => {
      try {
        const q = query(
          collection(db, 'recommendation'),
          where('targetId', '==', selectedTraineeId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docs = snap.docs.map(d => d.data());
          docs.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
          });
          const latestGoal = docs[0].goal;
          const goalText = latestGoal === 'maintain' ? 'รักษามวลกล้ามเนื้อ' : latestGoal === 'lose' ? 'ลดน้ำหนัก' : latestGoal === 'build' ? 'เพิ่มกล้ามเนื้อ' : null;
          setSelectedTraineeGoal(goalText);
        } else {
          setSelectedTraineeGoal(null);
        }
      } catch (err) {
        console.error("Error fetching selected trainee goal:", err);
        setSelectedTraineeGoal(null);
      }
    };
    fetchGoal();
  }, [selectedTraineeId]);

  useEffect(() => {
    // Lock body and html scroll
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    let unsubscribe: () => void;

    const setupRealtimeLogs = () => {
      setLoading(true);
      setErrorMsg(null);

      // 1. Fetch trainee info in parallel (non-blocking)
      const fetchTrainees = async () => {
        try {
          const tQuery1 = query(collection(db, 'trainees'), where('trainerIds', 'array-contains', trainerId));
          const tQuery2 = query(collection(db, 'trainees'), where('trainerId', '==', trainerId));
          const [tSnap1, tSnap2] = await Promise.all([getDocs(tQuery1), getDocs(tQuery2)]);
          const newMap: Record<string, { name: string, pictureUrl: string }> = {};
          const processDoc = (doc: any) => {
            const t = doc.data();
            if (t.userId) {
              newMap[t.userId] = { name: t.nickname || 'ลูกเทรน', pictureUrl: t.pictureUrl || '' };
            }
          };
          tSnap1.forEach(processDoc);
          tSnap2.forEach(processDoc);
          setTraineeMap(newMap);
          setTraineeMapLoaded(true);
        } catch (err: any) {
          console.error("Error fetching trainees:", err);
          setTraineeMapLoaded(true); // still mark loaded so the check can run
        }
      };
      fetchTrainees();

      // 2. Setup onSnapshot for food logs (immediate, non-blocking)
      try {
        const q = query(
          collection(db, 'foodLogs'),
          where('trainerIds', 'array-contains', trainerId),
          where('reviewed', '==', false)
        );
        
        unsubscribe = onSnapshot(q, (snap) => {
          const now = Date.now();
          const data = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((doc: any) => {
              if (doc.submittedAt === undefined) return false;
              if (doc.submittedAt === null) return true;
              const t = doc.submittedAt.toMillis ? doc.submittedAt.toMillis() : 0;
              return (now - t) <= 24 * 60 * 60 * 1000;
            });
            
          data.sort((a: any, b: any) => {
            const tA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
            const tB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
            return tB - tA; // newer first
          });
          setLogs(data);
          setLoading(false);
        }, (error) => {
          console.error(error);
          setErrorMsg('เกิดข้อผิดพลาดในการโหลดข้อมูล (onSnapshot): ' + error.message);
          setLoading(false);
        });

      } catch (err: any) {
        console.error(err);
        setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อ (onSnapshot): ' + err.message);
        setLoading(false);
      }
    };

    setupRealtimeLogs();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [trainerId]);

  const getTraineeNameForFlex = async (log: any) => {
    const mappedName = traineeMap[log.traineeId]?.name;
    if (mappedName) return mappedName;

    try {
      const directSnap = await getDoc(doc(db, 'trainees', log.traineeId));
      if (directSnap.exists()) {
        const data = directSnap.data();
        return data.nickname || data.displayName || data.name || 'ลูกเทรน';
      }

      const traineeSnap = await getDocs(query(collection(db, 'trainees'), where('userId', '==', log.traineeId)));
      if (!traineeSnap.empty) {
        const data = traineeSnap.docs[0].data();
        return data.nickname || data.displayName || data.name || 'ลูกเทรน';
      }
    } catch (err) {
      console.error("Error fetching trainee name for Flex:", err);
    }

    return log.traineeName || log.nickname || log.displayName || 'ลูกเทรน';
  };

  const buildReviewFlexMessage = (log: any, commentText: string, tName: string, tImage: string, nutritionData: any, traineeName: string) => {
    const nutrition = nutritionData || log.nutrition || parseNutrition(log);
    let nutritionBox: any = null;

    if (nutrition) {
      const calories = Math.round(Number(nutrition.calories)) || 0;
      const protein = Number(nutrition.protein) || 0;
      const carbs = Number(nutrition.carbs) || 0;
      const fat = Number(nutrition.fat) || 0;
      const foodName = nutrition.foodName || "";

      nutritionBox = {
        type: "box",
        layout: "vertical",
        margin: "lg",
        spacing: "xs",
        contents: [
          ...(foodName ? [
            {
              type: "text",
              text: `🍽️ ${foodName}`,
              weight: "bold",
              size: "sm",
              color: "#1e293b",
              wrap: true
            }
          ] : []),
          {
            type: "box",
            layout: "horizontal",
            spacing: "xs",
            contents: [
              {
                type: "box",
                layout: "vertical",
                backgroundColor: "#7c3aed",
                cornerRadius: "8px",
                paddingAll: "sm",
                alignItems: "center",
                contents: [
                  { type: "text", text: "พลังงาน", size: "xxs", color: "#ffffff", align: "center" },
                  { type: "text", text: `${calories}`, size: "sm", weight: "bold", color: "#ffffff", align: "center", margin: "xs" },
                  { type: "text", text: "kcal", size: "xxs", color: "#ffffff", align: "center" }
                ]
              },
              {
                type: "box",
                layout: "vertical",
                backgroundColor: "#fff1f2",
                borderColor: "#ffe4e6",
                borderWidth: "1px",
                cornerRadius: "8px",
                paddingAll: "sm",
                alignItems: "center",
                contents: [
                  { type: "text", text: "โปรตีน", size: "xxs", color: "#9f1239", align: "center" },
                  { type: "text", text: `${protein}g`, size: "sm", weight: "bold", color: "#be123c", align: "center", margin: "xs" }
                ]
              },
              {
                type: "box",
                layout: "vertical",
                backgroundColor: "#f0fdf4",
                borderColor: "#dcfce7",
                borderWidth: "1px",
                cornerRadius: "8px",
                paddingAll: "sm",
                alignItems: "center",
                contents: [
                  { type: "text", text: "คาร์บ", size: "xxs", color: "#166534", align: "center" },
                  { type: "text", text: `${carbs}g`, size: "sm", weight: "bold", color: "#15803d", align: "center", margin: "xs" }
                ]
              },
              {
                type: "box",
                layout: "vertical",
                backgroundColor: "#fffbeb",
                borderColor: "#fef3c7",
                borderWidth: "1px",
                cornerRadius: "8px",
                paddingAll: "sm",
                alignItems: "center",
                contents: [
                  { type: "text", text: "ไขมัน", size: "xxs", color: "#92400e", align: "center" },
                  { type: "text", text: `${fat}g`, size: "sm", weight: "bold", color: "#b45309", align: "center", margin: "xs" }
                ]
              }
            ]
          }
        ]
      };
    }

    const textMessage = commentText || "เทรนเนอร์ได้ตรวจอาหารของคุณแล้ว";

    return {
      type: "flex",
      altText: "เทรนเนอร์ตรวจอาหารของคุณแล้ว",
      contents: {
        type: "bubble",
        hero: {
          type: "image",
          url: log.imageUrl || "https://firebasestorage.googleapis.com/v0/b/fitjourneythailand.appspot.com/o/default-food.png?alt=media",
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover",
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "ผลตรวจอาหาร",
              weight: "bold",
              size: "xl",
              color: "#1DB446"
            },
            {
              type: "text",
              text: `ของ ${traineeName}`,
              size: "xs",
              color: "#94a3b8",
              margin: "xs"
            },
            ...(nutritionBox ? [nutritionBox] : []),
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: "คอมเมนต์จาก:",
                  color: "#94a3b8",
                  size: "sm"
                },
                {
                  type: "box",
                  layout: "horizontal",
                  spacing: "md",
                  margin: "md",
                  alignItems: "center",
                  contents: [
                    {
                      type: "image",
                      url: tImage || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png",
                      flex: 0,
                      size: "40px",
                      aspectRatio: "1:1",
                      aspectMode: "cover"
                    },
                    {
                      type: "text",
                      text: tName || "เทรนเนอร์ของคุณ",
                      weight: "bold",
                      size: "md",
                      color: "#333333"
                    }
                  ]
                },
                {
                  type: "box",
                  layout: "vertical",
                  margin: "lg",
                  spacing: "sm",
                  contents: [
                    {
                      type: "text",
                      text: textMessage,
                      wrap: true,
                      color: "#666666",
                      size: "sm"
                    }
                  ]
                }
              ]
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: 'sm',
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#ef4444",
              height: "sm",
              action: {
                type: "uri",
                label: "ส่งอาหารเพิ่ม",
                uri: "https://liff.line.me/2010284484-HzKokXFF"
              }
            }
          ],
          flex: 0
        }
      }
    };
  };

  const handleShareLogToLine = async (log: any, commentText: string, tName: string, tImage: string, nutritionData: any) => {
    try {
      if (!liff.isApiAvailable('shareTargetPicker')) {
        alert('อุปกรณ์นี้ไม่รองรับการแชร์ข้อความผ่าน LINE (shareTargetPicker)');
        return;
      }

      const traineeName = await getTraineeNameForFlex(log);
      const flexMessage = buildReviewFlexMessage(log, commentText, tName, tImage, nutritionData, traineeName);
      await liff.shareTargetPicker([flexMessage as any]);
    } catch (err) {
      console.error("Error sharing food log:", err);
      alert("เกิดข้อผิดพลาดในการแชร์");
    }
  };

  const handleSaveComment = async (logId: string) => {
    const text = commentTexts[logId] || '';
    if (!text.trim()) {
      alert('กรุณาพิมพ์คอมเมนต์ก่อนบันทึก');
      return;
    }
    setSubmitting(true);
    try {
      const logToUpdate = logs.find(l => l.id === logId);
      if (!logToUpdate) throw new Error("Log not found");

      const trainerDoc = await getDoc(doc(db, 'trainers', trainerId));
      const tName = trainerDoc.exists() ? (trainerDoc.data().nickname || trainerDoc.data().displayName) : (profile?.displayName || 'เทรนเนอร์ของคุณ');
      const tImage = trainerDoc.exists() ? trainerDoc.data().pictureUrl : (profile?.pictureUrl || '');

      const nutritionData = aiNutritionData[logId] || null;

      await updateDoc(doc(db, 'foodLogs', logId), {
        comment: text,
        reviewed: true,
        reviewedAt: new Date(),
        reviewerName: tName,
        reviewerImage: tImage,
        ...(nutritionData ? { nutrition: nutritionData } : {})
      });

      // Call Firebase Function to send LINE Flex Message (Removed as requested)

      // Check if this was opened via direct route link
      if (initialTraineeId) {
        const traineeName = await getTraineeNameForFlex(logToUpdate);
        const flexMessage = buildReviewFlexMessage(logToUpdate, text, tName, tImage, nutritionData, traineeName);
        if (liff.isInClient()) {
          try {
            await liff.sendMessages([flexMessage as any]);
          } catch (sendErr) {
            console.error("liff.sendMessages failed:", sendErr);
            alert("ไม่สามารถส่ง Flex Message อัตโนมัติได้ กรุณาแชร์แบบปกติ");
            await handleShareLogToLine(logToUpdate, text, tName, tImage, nutritionData);
          }
        } else {
          // Fallback for browser tests
          console.log("Mock reply message sent outside LIFF client:", flexMessage);
        }

        const remainingCount = logs.filter(l => l.traineeId === logToUpdate.traineeId && l.id !== logId).length;
        if (remainingCount > 0) {
          // If there are still food logs waiting, go back to the trainee's food list
          setSelectedLogId(null);
        } else {
          // Otherwise close the window
          if (liff.isInClient()) {
            liff.closeWindow();
          } else {
            onClose();
          }
        }
      } else {
        // Normal flow: ask to share via LINE target picker
        const wantToShare = window.confirm("ต้องการแชร์ผลตรวจนี้ผ่าน LINE หรือไม่?");
        if (wantToShare) {
          await handleShareLogToLine(logToUpdate, text, tName, tImage, nutritionData);
        }

        setCommentTexts(prev => {
          const copy = { ...prev };
          delete copy[logId];
          return copy;
        });
        setSelectedTraineeId(null);
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnalyzeFood = async (log: any) => {
    setAiLoading(prev => ({ ...prev, [log.id]: true }));
    try {


      // Fetch the image and convert it to Base64
      const imgRes = await fetch(log.imageUrl);
      const blob = await imgRes.blob();
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const mimeType = blob.type || 'image/jpeg';

      const prompt = `คุณเป็นนักโภชนาการผู้เชี่ยวชาญ วิเคราะห์อาหารในภาพและประมาณคุณค่าทางโภชนาการรวมต่อ 1 จานหรือ 1 ที่ในภาพ พร้อมทั้งวิเคราะห์และจำแนกประมาณค่าสารอาหารแยกตามแต่ละวัตถุดิบที่พบในภาชนะ
ข้อกำหนดสำคัญด้านความแม่นยำ:
- กรุณาประมาณปริมาณขนาดวัตถุดิบและพลังงานอย่างเป็นจริงและสมเหตุสมผลตามขนาดจานอาหารทั่วไป ห้ามประเมินปริมาณเยอะเกินความเป็นจริง (Avoid overestimating)
- หากไม่มั่นใจในน้ำหนักวัตถุดิบ ให้ใช้เกณฑ์มาตรฐานที่สมจริงสำหรับการเสิร์ฟต่อ 1 จานทั่วไป (เช่น ข้าวสวย 1 ทัพพี ~100-150g, เนื้อสัตว์ปรุงสุก ~70-100g)
- คำนึงถึงการใช้น้ำมันและส่วนประกอบที่เป็นไขมันอย่างระมัดระวัง (อย่าระบุน้ำมันพืช/เนยมากเกินไป ยกเว้นเป็นอาหารทอดหรือผัดที่มีความมันเยิ้มให้เห็นเด่นชัด)
- ผลรวมพลังงานและสารอาหารทั้งหมด (protein, carbs, fat, calories) จะต้องสอดคล้องสมเหตุสมผลกับผลรวมของวัตถุดิบแต่ละชนิดที่ระบุด้านล่าง

ตอบเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น:
{
  "foodName": "ชื่ออาหารภาษาไทย",
  "portion": "ปริมาณโดยรวมที่ประมาณ เช่น 1 จาน (350g)",
  "protein": 0.0,
  "carbs": 0.0,
  "fat": 0.0,
  "calories": 0,
  "ingredients": [
    {
      "name": "ชื่อวัตถุดิบภาษาไทย (เช่น อกไก่, ข้าวกล้อง, ไข่ดาว, บรอกโคลี)",
      "portion": "ปริมาณวัตถุดิบประมาณ เช่น 100g, 1 ฟอง",
      "protein": 0.0,
      "carbs": 0.0,
      "fat": 0.0,
      "calories": 0
    }
  ]
}`;

      const res = await fetchGeminiWithFallback(['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemma-4-26b-a4b-it'], [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ]);
      const rawText = res.rawText;
      console.log('Gemini client-side food raw response:', rawText);
      
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const foodData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      if (foodData && Object.keys(foodData).length > 0) {
        setAiNutritionData(prev => ({
          ...prev,
          [log.id]: foodData
        }));
      } else {
        alert('AI ไม่สามารถวิเคราะห์ภาพนี้ได้ หรือคำตอบไม่ถูกต้อง');
      }
    } catch (err: any) {
      console.error('AI analysis error:', err);
      alert('เกิดข้อผิดพลาดในการวิเคราะห์: ' + (err.message || err));
    } finally {
      setAiLoading(prev => ({ ...prev, [log.id]: false }));
    }
  };

  const handleMacroChange = (log: any, field: 'protein' | 'carbs' | 'fat', value: number) => {
    const currentNutrition = aiNutritionData[log.id] || parseNutrition(log);
    if (!currentNutrition) return;

    setAiNutritionData(prev => {
      const nextNutrition = {
        ...currentNutrition,
        ...(prev[log.id] || {}),
        [field]: value
      };
      const protein = Number(nextNutrition.protein) || 0;
      const carbs = Number(nextNutrition.carbs) || 0;
      const fat = Number(nextNutrition.fat) || 0;

      return {
        ...prev,
        [log.id]: {
          ...nextNutrition,
          calories: Math.round((protein * 4) + (carbs * 4) + (fat * 9))
        }
      };
    });
  };

  // Group logs by trainee
  const unreviewedByTrainee: Record<string, any[]> = {};
  logs.forEach(log => {
    if (!unreviewedByTrainee[log.traineeId]) unreviewedByTrainee[log.traineeId] = [];
    unreviewedByTrainee[log.traineeId].push(log);
  });

  const traineeLogs = selectedTraineeId ? (unreviewedByTrainee[selectedTraineeId] || []) : [];

  // Detect if initialTraineeId doesn't belong to this trainer
  useEffect(() => {
    if (!initialTraineeId || loading || !traineeMapLoaded) return;
    if (!(initialTraineeId in traineeMap)) {
      setShowNotMyTraineePopup(true);
      const timer = setTimeout(() => {
        if (liff.isInClient()) {
          liff.closeWindow();
        } else {
          onClose();
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [initialTraineeId, loading, traineeMapLoaded, traineeMap]);

  useEffect(() => {
    if (selectedTraineeId !== lastTraineeId) {
      setLastTraineeId(selectedTraineeId);
      if (selectedTraineeId) {
        const currentTraineeLogs = unreviewedByTrainee[selectedTraineeId] || [];
        if (currentTraineeLogs.length === 1) {
          setSelectedLogId(currentTraineeLogs[0].id);
        } else {
          setSelectedLogId(null);
        }
      } else {
        setSelectedLogId(null);
      }
    } else {
      if (selectedTraineeId) {
        const currentTraineeLogs = unreviewedByTrainee[selectedTraineeId] || [];
        if (selectedLogId && !currentTraineeLogs.some(l => l.id === selectedLogId)) {
          setSelectedLogId(null);
        }
      }
    }
  }, [selectedTraineeId, logs, selectedLogId, lastTraineeId]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: initialTraineeId ? '#f8fafc' : 'rgba(0,0,0,0.6)',
      zIndex: initialTraineeId ? 1000 : 150000,
      display: 'flex',
      alignItems: initialTraineeId ? 'stretch' : 'flex-start',
      justifyContent: 'center',
      padding: initialTraineeId ? 0 : '20px',
      backdropFilter: initialTraineeId ? 'none' : 'blur(4px)',
      overscrollBehavior: 'contain'
    }}>

      {/* Not My Trainee Popup */}
      {showNotMyTraineePopup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '24px', padding: '32px 24px 0',
            width: '100%', maxWidth: '340px', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            animation: 'fadeInUp 0.3s ease', overflow: 'hidden'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🚫</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', color: '#1e293b', fontWeight: 700 }}>
              ไม่ใช่ลูกเทรนของคุณ
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 24px 0', lineHeight: 1.6 }}>
              รายการอาหารนี้ไม่ใช่ของลูกเทรนของคุณ<br />
              ระบบจะปิดหน้าต่างอัตโนมัติ...
            </p>
            {/* Auto-close progress bar */}
            <div style={{ height: '4px', background: '#f1f5f9', margin: '0 -24px' }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, #ef4444, #f97316)',
                animation: 'shrinkBar 2.5s linear forwards'
              }} />
            </div>
            <style>{`
              @keyframes shrinkBar {
                from { width: 100%; }
                to   { width: 0%; }
              }
            `}</style>
          </div>
        </div>
      )}
      <div style={{
        background: initialTraineeId ? '#f8fafc' : '#fff',
        padding: initialTraineeId ? '1.5rem' : '24px',
        borderRadius: initialTraineeId ? 0 : '24px',
        width: '100%',
        maxWidth: initialTraineeId ? '100vw' : '600px',
        height: initialTraineeId ? '100%' : 'auto',
        maxHeight: initialTraineeId ? '100vh' : 'calc(100vh - 40px)',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: initialTraineeId ? 'none' : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: 'none',
        overscrollBehavior: 'contain'
      }}>
        {!initialTraineeId && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '20px', right: '20px',
              background: '#fef2f2', border: 'none', width: '36px', height: '36px',
              borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#dc2626', fontSize: '1.2rem', fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        )}
        
        {selectedTraineeId ? (
          <>
            {!initialTraineeId && (
              <button 
                onClick={() => setSelectedTraineeId(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                &larr; กลับไปหน้ารวม
              </button>
            )}
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              อาหารของ 
              {traineeMap[selectedTraineeId]?.pictureUrl && (
                <img 
                  src={traineeMap[selectedTraineeId].pictureUrl} 
                  alt="Trainee" 
                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} 
                />
              )}
              {traineeMap[selectedTraineeId]?.name || 'ลูกเทรน'}
            </h3>
            
            {traineeLogs.length > 1 && !selectedLogId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  มีอาหารรอตรวจของลูกเทรนคนนี้ {traineeLogs.length} รายการ
                </p>
                {traineeLogs.map(log => (
                  <div 
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      background: '#fff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                      e.currentTarget.style.borderColor = '#d8b4fe';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                  >
                    <img 
                      src={log.imageUrl} 
                      alt="Food Thumbnail" 
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        objectFit: 'cover',
                        border: '1px solid #cbd5e1'
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                        📅 ส่งเมื่อ: {log.submittedAt?.toMillis ? new Date(log.submittedAt.toMillis()).toLocaleString('th-TH') : '-'}
                      </div>
                      {log.details ? (
                        <div style={{
                          fontSize: '0.9rem',
                          color: '#334155',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {log.details}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic' }}>
                          ไม่มีรายละเอียดเพิ่มเติม
                        </div>
                      )}
                    </div>
                    <div style={{
                      background: '#f3e8ff',
                      color: '#7c3aed',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      flexShrink: 0
                    }}>
                      &rsaquo;
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              (() => {
                const log = traineeLogs.find(l => l.id === selectedLogId) || traineeLogs[0];
                if (!log) return <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>ไม่มีรายการอาหารรอตรวจ</div>;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {traineeLogs.length > 1 && (
                      <button 
                        onClick={() => setSelectedLogId(null)} 
                        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem', padding: '4px 0' }}
                      >
                        &larr; กลับไปหน้ารายการอาหารรอตรวจ
                      </button>
                    )}
                    <div key={log.id} style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <div style={{ position: 'relative', width: '100%', height: '300px', background: '#e2e8f0' }}>
                        <img 
                          src={log.imageUrl} 
                          alt="Food" 
                          style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }} 
                          onClick={() => setFullscreenImage(log.imageUrl)}
                        />
                        {selectedTraineeGoal && (
                          <div style={{
                            position: 'absolute',
                            top: '12px',
                            left: '12px',
                            background: 'rgba(0, 0, 0, 0.6)',
                            backdropFilter: 'blur(4px)',
                            color: '#fff',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            pointerEvents: 'none',
                            zIndex: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            🎯 เป้าหมาย: {selectedTraineeGoal}
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                          ส่งเมื่อ: {log.submittedAt?.toMillis ? new Date(log.submittedAt.toMillis()).toLocaleString('th-TH') : '-'}
                        </div>
                        {log.details && (
                          <div style={{ 
                            background: '#f1f5f9', 
                            padding: '0.75rem 1rem', 
                            borderRadius: '8px', 
                            marginBottom: '1rem',
                            fontSize: '0.9rem',
                            color: '#334155',
                            borderLeft: '4px solid #94a3b8'
                          }}>
                            <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>📋 รายละเอียดอาหาร:</div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{log.details}</div>
                          </div>
                        )}
                        <style>{`
                          @keyframes spin {
                            to { transform: rotate(360deg); }
                          }
                        `}</style>
                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleAnalyzeFood(log)}
                            disabled={aiLoading[log.id] || submitting}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 14px',
                              borderRadius: '20px',
                              border: '1px solid #d8b4fe',
                              background: '#faf5ff',
                              color: '#7c3aed',
                              fontSize: '0.85rem',
                              fontWeight: 'bold',
                              cursor: (aiLoading[log.id] || submitting) ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: '0 2px 4px rgba(124, 58, 237, 0.05)',
                              opacity: submitting ? 0.6 : 1
                            }}
                            onMouseOver={(e) => {
                              if (!aiLoading[log.id] && !submitting) {
                                  e.currentTarget.style.background = '#f3e8ff';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (!aiLoading[log.id] && !submitting) {
                                  e.currentTarget.style.background = '#faf5ff';
                                  e.currentTarget.style.transform = 'none';
                              }
                            }}
                          >
                            {aiLoading[log.id] ? (
                              <>
                                <span className="spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                                กำลังคำนวณสารอาหาร...
                              </>
                            ) : (
                              <>🤖 ให้ AI ช่วยคำนวณสารอาหาร</>
                            )}
                          </button>
                        </div>
                        {(() => {
                          const nutrition = aiNutritionData[log.id] || parseNutrition(log);
                          return nutrition ? (
                            <FoodNutritionCard
                              nutrition={nutrition}
                              editable={Boolean(aiNutritionData[log.id])}
                              onMacroChange={(field, value) => handleMacroChange(log, field, value)}
                            />
                          ) : null;
                        })()}
                        <AutoResizeTextarea
                          value={commentTexts[log.id] || ''}
                          onChange={(e) => setCommentTexts(prev => ({ ...prev, [log.id]: e.target.value }))}
                          placeholder="พิมพ์คำแนะนำ/คอมเมนต์ที่นี่..."
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '180px', fontFamily: 'inherit', fontSize: '14px', marginBottom: '0.75rem' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            className="btn-primary"
                            style={{ 
                              background: '#22c55e', 
                              padding: '0.5rem 1.5rem', 
                              fontSize: '0.9rem', 
                              width: 'auto', 
                              borderRadius: '20px', 
                              boxShadow: (!(commentTexts[log.id] || '').trim() || submitting) ? 'none' : '0 4px 15px rgba(34, 197, 94, 0.4)',
                              opacity: (!(commentTexts[log.id] || '').trim() || submitting) ? 0.5 : 1,
                              cursor: (!(commentTexts[log.id] || '').trim() || submitting) ? 'not-allowed' : 'pointer'
                            }}
                            onClick={() => handleSaveComment(log.id)}
                            disabled={submitting || !(commentTexts[log.id] || '').trim()}
                          >
                            {submitting ? 'กำลังบันทึก...' : '💾 บันทึก'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </>
        ) : (
          <>
            <h3 style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--primary)' }}>รายการอาหารรอตรวจ</h3>
            
            <button
              type="button"
              onClick={handleRemindFood}
              disabled={reminding}
              style={{
                width: '100%',
                background: '#f59e0b',
                color: '#fff',
                border: 'none',
                padding: '0.8rem',
                borderRadius: '12px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                cursor: reminding ? 'not-allowed' : 'pointer',
                opacity: reminding ? 0.7 : 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.2)',
                marginBottom: '1.5rem'
              }}
            >
              {reminding ? 'กำลังส่งแจ้งเตือน...' : '🔔 แจ้งให้ลูกเทรนส่งอาหาร'}
            </button>
            
            {errorMsg ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>{errorMsg}</div>
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>กำลังโหลด...</div>
            ) : Object.keys(unreviewedByTrainee).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>ไม่มีรายการอาหารรอตรวจ 🎉</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.keys(unreviewedByTrainee).map(tId => (
                  <div 
                    key={tId} 
                    onClick={() => setSelectedTraineeId(tId)}
                    style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                  >
                    {traineeMap[tId]?.pictureUrl ? (
                      <img src={traineeMap[tId].pictureUrl} alt="Trainee" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#cbd5e1' }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1.1rem' }}>{traineeMap[tId]?.name || 'ลูกเทรน'}</div>
                      <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>รอตรวจ {unreviewedByTrainee[tId].length} รายการ</div>
                    </div>
                    <div style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>&rsaquo;</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {fullscreenImage && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 160000, display: 'flex', justifyContent: 'center', alignItems: 'center', touchAction: 'none' }}
        >
          <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#fff', fontSize: '2.5rem', cursor: 'pointer', zIndex: 160001 }} onClick={() => setFullscreenImage(null)}>&times;</button>
          <TransformWrapper
            initialScale={1}
            minScale={1}
            maxScale={5}
            centerOnInit={true}
            centerZoomedOut={true}
          >
            <TransformComponent 
              wrapperStyle={{ width: '100vw', height: '100vh' }}
              contentStyle={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              <img src={fullscreenImage} alt="Fullscreen Food" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </TransformComponent>
          </TransformWrapper>
        </div>
      )}

      {showRemindSuccess && <SuccessPopup show={showRemindSuccess} message="ส่งแจ้งเตือนสำเร็จ" />}
    </div>
  );
}

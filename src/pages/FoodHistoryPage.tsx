import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useLiff } from '../context/LiffContext';
import liff from '@line/liff';
import Navbar from '../components/Navbar';
import TrainerFoodReviewModal from '../components/TrainerFoodReviewModal';
import SuccessPopup from '../components/SuccessPopup';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import FoodNutritionCard, { parseNutrition } from '../components/FoodNutritionCard';

interface FoodLog {
  id: string;
  imageUrl: string;
  submittedAt: any;
  reviewed: boolean;
  comment?: string;
  reviewerName?: string;
  reviewerImage?: string;
  traineeId: string;
  nutrition?: any;
  trainerIds?: string[];
  details?: string;
  isTrainerUpload?: boolean;
}

export default function FoodHistoryPage() {
  const { targetId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useLiff();
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysBack, setDaysBack] = useState<number>(7);
  const [traineeName, setTraineeName] = useState<string>('');
  const [traineeImage, setTraineeImage] = useState<string>('');
  
  const [isTrainer, setIsTrainer] = useState(false);
  const [pendingFoodCount, setPendingFoodCount] = useState(0);
  const [showFoodReviewModal, setShowFoodReviewModal] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('ส่งแจ้งเตือนสำเร็จ');
  const [traineeGoal, setTraineeGoal] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    const fetchGoal = async () => {
      try {
        const q = query(
          collection(db, 'recommendation'),
          where('targetId', '==', targetId)
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
          setTraineeGoal(goalText);
        }
      } catch (err) {
        console.error("Error fetching trainee goal:", err);
      }
    };
    fetchGoal();
  }, [targetId]);



  useEffect(() => {
    const checkRole = async () => {
      if (!profile) return;
      try {
        const adminQ = query(collection(db, 'trainers'), where('trainerId', '==', profile.userId));
        const adminSnap = await getDocs(adminQ);
        if (!adminSnap.empty) {
          const status = adminSnap.docs[0].data().status;
          if (status === 'อนุมัติ' || status === 'superadmin') {
            setIsTrainer(true);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkRole();
  }, [profile]);

  useEffect(() => {
    if (isTrainer && profile) {
      const q = query(
        collection(db, 'foodLogs'),
        where('trainerIds', 'array-contains', profile.userId),
        where('reviewed', '==', false)
      );
      const unsubscribe = onSnapshot(q, (snap) => {
        const now = Date.now();
        const validDocs = snap.docs.filter(doc => {
          const data = doc.data();
          if (data.submittedAt === undefined) return false;
          if (data.submittedAt === null) return true;
          const t = data.submittedAt.toMillis ? data.submittedAt.toMillis() : 0;
          return (now - t) <= 24 * 60 * 60 * 1000;
        });
        setPendingFoodCount(validDocs.length);
      });
      return () => unsubscribe();
    }
  }, [isTrainer, profile]);

  useEffect(() => {
    const fetchTraineeData = async () => {
      if (!targetId) return;
      try {
        const traineeDoc = await getDoc(doc(db, 'trainees', targetId));
        if (traineeDoc.exists()) {
          const data = traineeDoc.data();
          setTraineeName(data.nickname || data.displayName || data.name || 'ลูกเทรน');
          setTraineeImage(data.pictureUrl || '');
        } else {
          // Attempt to find by userId if targetId is the line userId
          const q = query(collection(db, 'trainees'), where('userId', '==', targetId));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            setTraineeName(data.nickname || data.displayName || data.name || 'ลูกเทรน');
            setTraineeImage(data.pictureUrl || '');
          }
        }
      } catch (err) {
        console.error("Error fetching trainee:", err);
      }
    };
    fetchTraineeData();
  }, [targetId]);

  const [allLogs, setAllLogs] = useState<FoodLog[]>([]);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  useEffect(() => {
    const fetchLogs = async () => {
      if (!targetId) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'foodLogs'),
          where('traineeId', '==', targetId)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodLog));
        setAllLogs(data);
      } catch (err) {
        console.error("Error fetching food history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [targetId]);

  useEffect(() => {
    let data: FoodLog[];

    if (dateFrom || dateTo) {
      // Date range filter mode
      const fromMs = dateFrom ? new Date(dateFrom).setHours(0, 0, 0, 0) : 0;
      const toMs = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Infinity;
      data = allLogs.filter(doc => {
        if (!doc.submittedAt) return false;
        const t = doc.submittedAt.toMillis ? doc.submittedAt.toMillis() : 0;
        return t >= fromMs && t <= toMs;
      });
    } else {
      // Day-count filter mode
      const now = Date.now();
      const maxTimeDiff = daysBack * 24 * 60 * 60 * 1000;
      data = allLogs.filter(doc => {
        if (!doc.submittedAt) return false;
        const t = doc.submittedAt.toMillis ? doc.submittedAt.toMillis() : 0;
        return (now - t) <= maxTimeDiff;
      });
    }

    data.sort((a, b) => {
      const tA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
      const tB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
      return tB - tA;
    });

    setLogs(data);
  }, [allLogs, daysBack, dateFrom, dateTo]);

  // Group by date string (e.g. "7 มิ.ย. 2026")
  const groupedLogs = logs.reduce((acc, log) => {
    const t = log.submittedAt?.toMillis ? log.submittedAt.toMillis() : 0;
    if (t === 0) return acc;
    const dateStr = new Date(t).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(log);
    return acc;
  }, {} as Record<string, FoodLog[]>);

  const dateKeys = Object.keys(groupedLogs).sort((a, b) => {
    const timeA = groupedLogs[a][0]?.submittedAt?.toMillis ? groupedLogs[a][0].submittedAt.toMillis() : 0;
    const timeB = groupedLogs[b][0]?.submittedAt?.toMillis ? groupedLogs[b][0].submittedAt.toMillis() : 0;
    return timeB - timeA;
  });

  const handleShareLogToLine = async (log: FoodLog) => {
    try {
      if (!liff.isApiAvailable('shareTargetPicker')) {
        alert('อุปกรณ์นี้ไม่รองรับการแชร์ข้อความผ่าน LINE (shareTargetPicker)');
        return;
      }

      const nutrition = log.nutrition || parseNutrition(log);
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

      const textMessage = log.comment ? log.comment : "เทรนเนอร์ได้ตรวจอาหารของคุณแล้ว";

      const flexMessage = {
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
                text: `ของ ${traineeName || 'ลูกเทรน'}`,
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
                        url: log.reviewerImage || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png",
                        flex: 0,
                        size: "40px",
                        aspectRatio: "1:1",
                        aspectMode: "cover"
                      },
                      {
                        type: "text",
                        text: log.reviewerName || "เทรนเนอร์ของคุณ",
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

      const res = await liff.shareTargetPicker([flexMessage as any]);
      if (res) {
        setSuccessMessage('แชร์ผลตรวจเรียบร้อยแล้ว');
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 2000);
      }
    } catch (err) {
      console.error("Error sharing food log:", err);
      alert("เกิดข้อผิดพลาดในการแชร์");
    }
  };

  return (
    <>
      <Navbar 
        showProfile={isTrainer} 
        notificationCount={pendingFoodCount}
        onProfileClick={isTrainer ? () => setShowFoodReviewModal(true) : undefined}
      />
      
      <div className="animate-fade-in-up" style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '100px 20px 40px 20px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button 
            className="btn-secondary" 
            onClick={() => {
              if (location.state?.returnToDashboard) {
                navigate('/', { state: { viewMode: 'dashboard', viewingTraineeId: targetId } });
              } else {
                navigate('/');
              }
            }} 
            style={{ padding: '0.4rem 0.8rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', background: '#fff' }}
          >
            ← กลับ
          </button>
          <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)' }}>ประวัติอาหารทั้งหมด</h2>
        </div>

        {traineeName && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem', padding: '1.2rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {traineeImage ? (
                <img src={traineeImage} alt={traineeName} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
              ) : (
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.5rem' }}>👤</div>
              )}
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ของลูกเทรน</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>{traineeName}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          {/* Day-count filter */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <div style={{ background: '#fff', padding: '0.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem' }}>
              {[3, 7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => { setDaysBack(d); setDateFrom(''); setDateTo(''); }}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: daysBack === d && !dateFrom && !dateTo ? 'var(--primary)' : 'transparent',
                    color: daysBack === d && !dateFrom && !dateTo ? '#fff' : '#64748b',
                    fontWeight: daysBack === d && !dateFrom && !dateTo ? 'bold' : 'normal',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {d} วัน
                </button>
              ))}
            </div>
          </div>

          {/* Date range filter */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '0.5rem' }}>หรือเลือกช่วงวันที่:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', width: '30px', flexShrink: 0 }}>จาก</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    color: '#1e293b',
                    background: '#fff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', width: '30px', flexShrink: 0 }}>ถึง</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    color: '#1e293b',
                    background: '#fff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  style={{
                    alignSelf: 'flex-end',
                    background: '#fef2f2',
                    border: '1px solid #fee2e2',
                    borderRadius: '10px',
                    padding: '6px 14px',
                    color: '#dc2626',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ล้างช่วงวันที่
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>กำลังโหลดข้อมูล...</div>
        ) : dateKeys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
            <h3 style={{ color: '#64748b' }}>
            {dateFrom || dateTo
              ? `ไม่พบประวัติอาหารในช่วงวันที่ที่เลือก`
              : `ไม่พบประวัติอาหารในช่วง ${daysBack} วันที่ผ่านมา`}
          </h3>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {dateKeys.map(date => (
              <div key={date}>
                <h3 style={{ fontSize: '1.2rem', color: '#334155', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📅 {date}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {groupedLogs[date].map(log => (
                    <div key={log.id} style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                      <div style={{ position: 'relative', width: '100%', height: '220px' }}>
                        <img 
                          src={log.imageUrl} 
                          alt="Food" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                          onClick={() => setFullscreenImage(log.imageUrl)}
                        />
                        {traineeGoal && (
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
                            🎯 เป้าหมาย: {traineeGoal}
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '1.25rem' }}>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span>เวลาส่ง:</span>
                          <span>{log.submittedAt?.toMillis ? new Date(log.submittedAt.toMillis()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
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
                        {log.reviewed ? (
                          <div style={{ background: '#f0fdf4', borderLeft: '4px solid #22c55e', padding: '1rem', borderRadius: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                              {log.reviewerImage ? (
                                <img src={log.reviewerImage} alt="Trainer" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534', fontSize: '10px' }}>👨‍🏫</div>
                              )}
                              <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 'bold' }}>{log.reviewerName || 'เทรนเนอร์'}</span>
                            </div>
                            {(() => {
                              const nutrition = parseNutrition(log);
                              return nutrition ? <FoodNutritionCard nutrition={nutrition} /> : null;
                            })()}
                            <div style={{ color: '#15803d', whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{log.comment || '-'}</div>
                            {isTrainer && (
                              <button
                                onClick={() => handleShareLogToLine(log)}
                                style={{
                                  marginTop: '10px',
                                  width: '100%',
                                  padding: '8px',
                                  background: '#06C755',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontWeight: 'bold',
                                  fontSize: '0.85rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  boxShadow: '0 2px 4px rgba(6, 199, 85, 0.2)'
                                }}
                              >
                                💬 แชร์ผลตรวจไปยัง LINE
                              </button>
                            )}
                          </div>
                        ) : (
                          (log.isTrainerUpload && (!log.trainerIds || log.trainerIds.length === 0)) ? null : (
                            <div style={{ background: '#fffbeb', color: '#b45309', padding: '0.75rem', borderRadius: '8px', fontSize: '0.95rem', textAlign: 'center', fontWeight: '500' }}>
                              ⏳ รอเทรนเนอร์ตรวจ
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showFoodReviewModal && profile?.userId && (
        <TrainerFoodReviewModal 
          trainerId={profile.userId} 
          onClose={() => setShowFoodReviewModal(false)} 
        />
      )}

      {fullscreenImage && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', touchAction: 'none' }}
        >
          <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#fff', fontSize: '2.5rem', cursor: 'pointer', zIndex: 10000 }} onClick={() => setFullscreenImage(null)}>&times;</button>
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

      <SuccessPopup show={showSuccessPopup} message={successMessage} />
    </>
  );
}

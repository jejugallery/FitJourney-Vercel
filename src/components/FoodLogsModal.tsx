import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import FoodNutritionCard, { parseNutrition } from './FoodNutritionCard';
import { useLiff } from '../context/LiffContext';
import { AutoResizeTextarea } from './AutoResizeTextarea';

export default function FoodLogsModal({ traineeId, onClose }: { traineeId: string, onClose: () => void }) {
  const { profile } = useLiff();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const [activeEditLogId, setActiveEditLogId] = useState<string | null>(null);
  const [tempComment, setTempComment] = useState<string>('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [traineeGoal, setTraineeGoal] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoal = async () => {
      try {
        const q = query(
          collection(db, 'recommendation'),
          where('targetId', '==', traineeId)
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
  }, [traineeId]);

  const handleSaveComment = async (log: any) => {
    if (!profile) return;
    setSubmittingId(log.id);
    try {
      let commenterName = profile.displayName || 'ผู้ใช้';
      let commenterImage = profile.pictureUrl || '';
      
      const trainerSnap = await getDocs(query(collection(db, 'trainers'), where('trainerId', '==', profile.userId)));
      if (!trainerSnap.empty) {
        const data = trainerSnap.docs[0].data();
        commenterName = data.nickname || data.displayName || commenterName;
        commenterImage = data.pictureUrl || commenterImage;
      } else {
        const traineeSnap = await getDocs(query(collection(db, 'trainees'), where('userId', '==', profile.userId)));
        if (!traineeSnap.empty) {
          const data = traineeSnap.docs[0].data();
          commenterName = data.nickname || commenterName;
          commenterImage = data.pictureUrl || commenterImage;
        }
      }

      const isSelfComment = profile.userId === log.traineeId;

      await updateDoc(doc(db, 'foodLogs', log.id), {
        comment: tempComment,
        reviewed: true,
        reviewedAt: new Date(),
        reviewerName: commenterName,
        reviewerImage: commenterImage,
        traineeSeen: isSelfComment
      });

      if (isSelfComment) {
        // No-op or keep empty to match structure, or just clean it up. We can just delete the whole notification block.
      }

      setActiveEditLogId(null);
      setTempComment('');
    } catch (err) {
      console.error("Error saving comment:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกคอมเมนต์");
    } finally {
      setSubmittingId(null);
    }
  };

  useEffect(() => {
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
    const q = query(
      collection(db, 'foodLogs'), 
      where('traineeId', '==', traineeId)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const now = Date.now();
      const data = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((doc: any) => {
          if (doc.submittedAt === undefined) return false; // Ignore old test data missing timestamps
          if (doc.submittedAt === null) return true; // Optimistic local writes
          const t = doc.submittedAt.toMillis ? doc.submittedAt.toMillis() : 0;
          return (now - t) <= 24 * 60 * 60 * 1000;
        });
        
      // sort in JS since we might need a composite index for orderBy('submittedAt', 'desc')
      data.sort((a: any, b: any) => {
        const tA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
        const tB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
        return tB - tA;
      });
      setLogs(data);
      setLoading(false);

      // Mark unread logs as seen
      const unseenLogs = data.filter((d: any) => d.reviewed && !d.traineeSeen);
      unseenLogs.forEach(async (log: any) => {
        try {
          await updateDoc(doc(db, 'foodLogs', log.id), { traineeSeen: true });
        } catch (e) {
          console.error("Error marking log as seen:", e);
        }
      });
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [traineeId]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 150000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(4px)',
        overscrollBehavior: 'contain'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#f8fafc',
          padding: '24px',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '600px',
          height: 'auto',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          position: 'relative',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: 'none',
          overscrollBehavior: 'contain'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#fef2f2',
            border: 'none',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            zIndex: 10
          }}
        >
          ✕
        </button>
        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--primary)' }}>ประวัติและคอมเมนต์อาหาร</h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>กำลังโหลด...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>ยังไม่มีประวัติส่งภาพอาหาร</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {logs.map(log => (
              <div key={log.id} style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <div style={{ position: 'relative', width: '100%', height: '200px' }}>
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
                <div style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
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
                  {log.reviewed ? (
                    <div style={{ background: '#f0fdf4', borderLeft: '4px solid #22c55e', padding: '0.75rem', borderRadius: '4px' }}>
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
                      <div style={{ color: '#15803d', whiteSpace: 'pre-wrap' }}>{log.comment || '-'}</div>
                    </div>
                  ) : (
                    (log.isTrainerUpload && (!log.trainerIds || log.trainerIds.length === 0)) ? null : (
                      <div style={{ background: '#fffbeb', color: '#b45309', padding: '0.5rem', borderRadius: '4px', fontSize: '0.9rem', textAlign: 'center' }}>
                        ⏳ รอเทรนเนอร์ตรวจ...
                      </div>
                    )
                  )}

                  {(() => {
                    const isAllowedToComment = profile?.userId && (log.trainerIds || []).includes(profile.userId);
                    if (!isAllowedToComment) return null;
                    return (
                      <div style={{ marginTop: '0.75rem' }}>
                        {activeEditLogId === log.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <AutoResizeTextarea
                              value={tempComment}
                              onChange={(e) => setTempComment(e.target.value)}
                              placeholder="พิมพ์คอมเมนต์ของคุณที่นี่..."
                              style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '80px', fontFamily: 'inherit', fontSize: '14px', boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              <button 
                                onClick={() => handleSaveComment(log)}
                                disabled={submittingId === log.id}
                                style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                              >
                                {submittingId === log.id ? 'กำลังบันทึก...' : 'บันทึก'}
                              </button>
                              <button 
                                onClick={() => {
                                  setActiveEditLogId(null);
                                  setTempComment('');
                                }}
                                disabled={submittingId === log.id}
                                style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveEditLogId(log.id);
                              setTempComment(log.comment || '');
                            }}
                            style={{ background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: '20px', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                          >
                            💬 {log.comment ? 'แก้ไขคอมเมนต์' : 'เขียนคอมเมนต์'}
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {fullscreenImage && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 160000, display: 'flex', justifyContent: 'center', alignItems: 'center', touchAction: 'none' }}
        >
          <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#fff', fontSize: '2.5rem', cursor: 'pointer', zIndex: 160001 }} onClick={() => setFullscreenImage(null)}>&times;</button>
          
          <button 
            style={{ 
              position: 'absolute', 
              bottom: '40px', 
              left: '50%', 
              transform: 'translateX(-50%)',
              background: '#3b82f6', 
              border: 'none', 
              color: '#fff', 
              padding: '12px 24px',
              borderRadius: '30px',
              fontSize: '1rem', 
              fontWeight: 'bold',
              cursor: 'pointer', 
              zIndex: 160001,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
            }} 
            onClick={async () => {
              if (!fullscreenImage) return;
              try {
                const response = await fetch(fullscreenImage);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `food-image-${Date.now()}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              } catch (err) {
                console.error('Download failed:', err);
                // Fallback for direct link
                window.open(fullscreenImage, '_blank');
              }
            }}
          >
            📥 ดาวน์โหลดรูปภาพ
          </button>

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
    </div>
  );
}

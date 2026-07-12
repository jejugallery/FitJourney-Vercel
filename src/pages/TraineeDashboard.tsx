import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLiff } from '../context/LiffContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Navbar from '../components/Navbar';
import NutritionResultCard from '../components/NutritionResultCard';
import PastMetricsModal from '../components/PastMetricsModal';
import FoodUploadModal from '../components/FoodUploadModal';
import FoodLogsModal from '../components/FoodLogsModal';
import AddTrainerModal from '../components/AddTrainerModal';
import TraineeEventsSlider from '../components/TraineeEventsSlider';
import TraineeAppointmentsSlider from '../components/TraineeAppointmentsSlider';
import FoodHistoryModal from '../components/FoodHistoryModal';

interface TraineeDashboardProps { 
  onAppointmentsClick?: () => void;
  appointmentNotificationCount?: number;
  isTrainerSelf?: boolean;
  targetTraineeId?: string;
  onBackClick?: () => void;
  showProfile?: boolean;
  onProfileClick?: () => void;
  notificationCount?: number;
  onEventsClick?: () => void;
  onBillingClick?: () => void;
  eventNotificationCount?: number;
  onKnowledgeClick?: () => void;
}

export default function TraineeDashboard({ 
  isTrainerSelf = false,
  targetTraineeId,
  onBackClick,
  showProfile = false,
  onProfileClick,
  notificationCount = 0,
  onEventsClick,
  onBillingClick,
  eventNotificationCount = 0,
  onAppointmentsClick,
  appointmentNotificationCount = 0,
  onKnowledgeClick
}: TraineeDashboardProps) {
  const { profile } = useLiff();
  const [loading, setLoading] = useState(true);
  const [traineeName, setTraineeName] = useState('');
  const navigate = useNavigate();
  const clickCountRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [traineeData, setTraineeData] = useState<any>(null);
  const [metricsData, setMetricsData] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<any | null>(null);
  const [showPastMetricsModal, setShowPastMetricsModal] = useState(false);
  
  const [trainerName, setTrainerName] = useState('');
  const [trainersList, setTrainersList] = useState<any[]>([]);
  const [showAddTrainerModal, setShowAddTrainerModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [newCommentsCount, setNewCommentsCount] = useState(0);
  
  const [traineeDocId, setTraineeDocId] = useState<string | null>(null);
  const [selfTrainerDocId, setSelfTrainerDocId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [isPendingTrainer, setIsPendingTrainer] = useState(false);
  const [isGraduated, setIsGraduated] = useState(false);
  const [showFoodHistoryModal, setShowFoodHistoryModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      
      const queryId = targetTraineeId || profile.userId;

      try {
        // Check if user is a pending trainer
        if (queryId === profile.userId) {
          try {
            const trainerCheckQ = query(collection(db, 'trainers'), where('trainerId', '==', profile.userId));
            const trainerCheckSnap = await getDocs(trainerCheckQ);
            if (!trainerCheckSnap.empty) {
              const trainerCheckData = trainerCheckSnap.docs[0].data();
              if (trainerCheckData.status === 'รออนุมัติ') {
                setIsPendingTrainer(true);
              }
            }
          } catch (errCheck) {
            console.error('Error checking pending trainer status:', errCheck);
          }
        }

        // 1. Get Trainee info
        const tQuery = query(collection(db, 'trainees'), where('userId', '==', queryId));
        const tSnap = await getDocs(tQuery);
        
        let nickname = queryId === profile.userId ? profile.displayName : 'ลูกเทรน';
        let tIds: string[] = [];
        if (!tSnap.empty) {
          const docSnap = tSnap.docs[0];
          const tData = docSnap.data();
          setTraineeDocId(docSnap.id);
          setTraineeData(tData);
          nickname = (queryId === profile.userId && isTrainerSelf) ? profile.displayName : tData.nickname;
          tIds = tData.trainerIds || [];
          setTraineeName(nickname);
        } else if (queryId === profile.userId && isTrainerSelf) {
          // If viewing self stats but no trainee record, default name to profile displayName
          setTraineeName(profile.displayName);
        }

        // Always check if current user is a trainer to allow editing trainer name
        if (queryId === profile.userId && isTrainerSelf) {
          const sQuery = query(collection(db, 'trainers'), where('trainerId', '==', queryId));
          const sSnap = await getDocs(sQuery);
          if (!sSnap.empty) {
            setSelfTrainerDocId(sSnap.docs[0].id);
            const trainerData = sSnap.docs[0].data();
            if (trainerData.nickname) {
              setTraineeName(trainerData.nickname);
            } else if (trainerData.displayName) {
              setTraineeName(trainerData.displayName);
            }
          }
        }

        if (tIds.length > 0) {
          try {
            const aQuery = query(collection(db, 'trainers'), where('trainerId', 'in', tIds.slice(0, 10)));
            const aSnap = await getDocs(aQuery);
            const trainersData = aSnap.docs.map(d => d.data());
            trainersData.sort((a, b) => tIds.indexOf(a.trainerId) - tIds.indexOf(b.trainerId));
            setTrainersList(trainersData);
            if (trainersData.length > 0) {
              setTrainerName(trainersData[0].nickname || trainersData[0].displayName || 'Unknown');
            }
          } catch (err) {
            console.error('Error fetching trainers data:', err);
          }
        }



        // 2. Get Nutrition Recommendation
        const rQuery = query(collection(db, 'recommendation'), where('targetId', '==', queryId));
        const rSnap = await getDocs(rQuery);
        if (!rSnap.empty) {
          const docs = rSnap.docs.map(d => d.data());
          docs.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
          });
          setRecommendation(docs[0]);
        }

        // 3. Get Metrics using ONLY traineeId
        const mQueryId = query(collection(db, 'bodyMetrics'), where('traineeId', '==', queryId));
        
        const mSnapId = await getDocs(mQueryId);
        
        const docsMap = new Map();
        mSnapId.forEach(doc => docsMap.set(doc.id, doc.data()));
        
        const data: any[] = [];
        docsMap.forEach((d, id) => {
          data.push({
            id: id,
            date: d.createdAt ? new Date(d.createdAt.toMillis()).toLocaleDateString('th-TH') : '',
            timestamp: d.createdAt ? d.createdAt.toMillis() : 0,
            weight: d.weight,
            bodyFat: d.bodyFat,
            muscleMass: d.muscleMass,
            metabolicRate: d.metabolicRate,
            bodyWater: d.bodyWater,
            boneMass: d.boneMass,
            bodyAge: d.bodyAge,
            visceralFat: d.visceralFat,
            age: d.age,
            height: d.height
          });
        });

        // Sort by date ascending
        data.sort((a, b) => a.timestamp - b.timestamp);
        setMetricsData(data);

        // Check if trainee has graduated (upgraded to trainer)
        try {
          const checkTrainerQ = query(collection(db, 'trainers'), where('trainerId', '==', queryId));
          const checkTrainerSnap = await getDocs(checkTrainerQ);
          if (!checkTrainerSnap.empty) {
            const status = checkTrainerSnap.docs[0].data().status;
            if (status !== 'ไม่อนุมัติ') {
              setIsGraduated(true);
            } else {
              setIsGraduated(false);
            }
          } else {
            setIsGraduated(false);
          }
        } catch (errGrad) {
          console.error("Error checking trainee graduation in TraineeDashboard:", errGrad);
          setIsGraduated(false);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile, targetTraineeId]);

  const handleViewCommentsClick = async () => {
    if (!profile) return;
    const qId = targetTraineeId || profile.userId;
    try {
      const q = query(
        collection(db, 'foodLogs'),
        where('traineeId', '==', qId),
        where('reviewed', '==', true)
      );
      const snap = await getDocs(q);
      const now = Date.now();
      const hasRecentCommented = snap.docs.some(doc => {
        const data = doc.data();
        if (!data.submittedAt) return false;
        const t = data.submittedAt.toMillis ? data.submittedAt.toMillis() : 0;
        return (now - t) <= 24 * 60 * 60 * 1000;
      });
      if (hasRecentCommented) {
        setShowLogsModal(true);
      }
    } catch (err) {
      console.error("Error checking commented logs:", err);
    }
  };

  const handleSaveName = async () => {
    if (!editNameInput.trim()) return;
    if (!traineeDocId && !selfTrainerDocId) return;

    setSavingName(true);
    try {
      if (traineeDocId) {
        await updateDoc(doc(db, 'trainees', traineeDocId), {
          nickname: editNameInput.trim()
        });
      }

      if (selfTrainerDocId) {
        await updateDoc(doc(db, 'trainers', selfTrainerDocId), {
          nickname: editNameInput.trim()
        });
      }

      setTraineeName(editNameInput.trim());
      setIsEditingName(false);
    } catch (err) {
      console.error('Error updating name:', err);
      alert('ไม่สามารถบันทึกชื่อได้ กรุณาลองใหม่');
    } finally {
      setSavingName(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    const qId = targetTraineeId || profile.userId;
    const q = query(
      collection(db, 'foodLogs'),
      where('traineeId', '==', qId),
      where('reviewed', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const now = Date.now();
      let count = 0;
      snap.forEach(doc => {
        const data = doc.data();
        if (data.submittedAt) {
          const t = data.submittedAt.toMillis ? data.submittedAt.toMillis() : 0;
          if ((now - t) <= 24 * 60 * 60 * 1000 && !data.traineeSeen) {
            count++;
          }
        }
      });
      setNewCommentsCount(count);
    });
    return () => unsubscribe();
  }, [profile, targetTraineeId]);



  const handleLogoClick = () => {
    clickCountRef.current += 1;
    if (clickCountRef.current >= 5) {
      navigate('/register-admin', { state: { prefill: traineeData } });
      clickCountRef.current = 0;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1500);
  };

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <h2>กำลังโหลด...</h2>
      </div>
    );
  }

  const queryId = targetTraineeId || profile?.userId || '';
  const isMyStats = queryId === profile?.userId;
  const isManual = queryId.startsWith('manual_');
  const isTraineeSelf = !targetTraineeId && !isTrainerSelf;

  return (
    <>
      <Navbar 
        onLogoClick={handleLogoClick} 
        showProfile={showProfile}
        onProfileClick={onProfileClick}
        onEventsClick={onEventsClick}
        onAppointmentsClick={onAppointmentsClick}
        onBillingClick={onBillingClick}
        onKnowledgeClick={onKnowledgeClick}
        notificationCount={notificationCount}
        eventNotificationCount={eventNotificationCount}
        appointmentNotificationCount={appointmentNotificationCount}
      />

      <div className="animate-fade-in-up" style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '100px 20px 0 20px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: isTraineeSelf ? 'center' : 'flex-start' }}>
          {onBackClick && (
            <button 
              className="btn-secondary" 
              onClick={onBackClick} 
              style={{ padding: '0.4rem 0.8rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', background: '#fff' }}
            >
              ← กลับ
            </button>
          )}
          <h2 style={{ margin: 0, fontSize: '1.3rem', textAlign: isTraineeSelf ? 'center' : 'left' }}>
            {isTraineeSelf ? 'บันทึกสถิติร่างกาย' : (isMyStats ? 'สถิติตัวเอง' : 'สถิติลูกเทรน')}
          </h2>
        </div>
      </div>

      <div className="form-container animate-fade-in-up delay-1" style={{ marginTop: '1rem', maxWidth: '800px' }}>
        
        {/* Profile Card Header */}
        {/* Profile Card (Combined name, province, location, phone, and action button) */}
        <div style={{ 
          background: '#fff', 
          padding: '1.5rem', 
          borderRadius: '16px', 
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
        }}>
          {/* Top row: Profile picture and Nickname next to it */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            {(isMyStats ? (profile?.pictureUrl || traineeData?.pictureUrl) : traineeData?.pictureUrl) ? (
              <img src={isMyStats ? (profile?.pictureUrl || traineeData?.pictureUrl) : traineeData?.pictureUrl} alt="Profile" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {isEditingName ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    value={editNameInput} 
                    onChange={(e) => setEditNameInput(e.target.value)} 
                    style={{ padding: '0.3rem 0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', flex: '1', minWidth: '120px', maxWidth: '200px' }}
                    disabled={savingName}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={handleSaveName} 
                      disabled={savingName}
                      style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                    >
                      บันทึก
                    </button>
                    <button 
                      onClick={() => setIsEditingName(false)} 
                      disabled={savingName}
                      style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-main)' }}>{traineeName || profile?.displayName}</span>
                    {isPendingTrainer && (
                      <span style={{ 
                        background: '#fef9c3', 
                        color: '#854d0e', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold', 
                        padding: '2px 8px', 
                        borderRadius: '12px',
                        border: '1px solid #facc15'
                      }}>
                        ⏳ รออนุมัติ
                      </span>
                    )}
                  </div>
                  
                  {/* Edit & Delete buttons below the nickname */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {(isTrainerSelf || (targetTraineeId && !isGraduated)) && (traineeDocId || selfTrainerDocId) && (
                      <button 
                        onClick={() => {
                          setEditNameInput(traineeName || profile?.displayName || '');
                          setIsEditingName(true);
                        }}
                        style={{ 
                          background: '#f8fafc', 
                          border: '1px solid #cbd5e1', 
                          borderRadius: '8px', 
                          padding: '0.2rem 0.6rem', 
                          cursor: 'pointer', 
                          fontSize: '0.75rem', 
                          color: '#475569', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          fontWeight: 600
                        }}
                        title="แก้ไขชื่อ"
                      >
                        ✏️ แก้ไขชื่อ
                      </button>
                    )}
                    {isManual && (
                      <button 
                        onClick={async () => {
                          if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบลูกเทรนรายนี้?")) return;
                          if (traineeDocId) {
                            try {
                              await deleteDoc(doc(db, 'trainees', traineeDocId));
                              if (onBackClick) onBackClick();
                              else window.location.href = '/';
                            } catch (err) {
                              console.error("Error deleting trainee:", err);
                              alert("เกิดข้อผิดพลาดในการลบลูกเทรน");
                            }
                          }
                        }}
                        style={{ 
                          background: '#fee2e2', 
                          color: '#b91c1c', 
                          border: '1px solid #fca5a5', 
                          borderRadius: '8px', 
                          padding: '0.2rem 0.6rem', 
                          cursor: 'pointer', 
                          fontSize: '0.75rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          fontWeight: 600
                        }}
                      >
                        🗑️ ลบ
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Middle row: Province & Location details */}
          {(traineeData?.province || traineeData?.zone) && (
            <div style={{ 
              fontSize: '0.9rem', 
              color: '#475569', 
              background: '#f8fafc',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column', 
              gap: '4px',
              marginBottom: '1rem'
            }}>
              {traineeData.province && <div>📍 <strong>จังหวัด:</strong> {traineeData.province}</div>}
              {traineeData.zone && <div>🏠 <strong>โลเคชั่น:</strong> {traineeData.zone}</div>}
            </div>
          )}

          {isTraineeSelf && (
            <button
              type="button"
              onClick={() => navigate(`/body-analysis/${queryId}`)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff',
                padding: '0.75rem', borderRadius: '12px', border: '1px solid #3b82f6',
                color: '#2563eb', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', width: '100%',
                marginBottom: '1rem'
              }}
            >
              📸 อ่านค่าร่างกาย
            </button>
          )}

          {/* Combined Call button */}
          {!isMyStats && traineeData?.phone && (
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem', flexWrap: 'wrap' }}>
              <a 
                href={`tel:${traineeData.phone}`}
                style={{ 
                  flex: 1,
                  minWidth: '140px',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '0.5rem', 
                  background: '#22c55e', 
                  color: 'white', 
                  padding: '0.6rem 1rem', 
                  borderRadius: '12px', 
                  textDecoration: 'none', 
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  boxShadow: '0 2px 4px rgba(34,197,94,0.3)',
                  textAlign: 'center'
                }}
              >
                📞 โทรหาลูกเทรน
              </a>
            </div>
          )}

          {!isTraineeSelf && (
            <button 
              type="button"
              onClick={() => setShowFoodHistoryModal(true)}
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', 
                padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0',
                color: '#475569', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', width: '100%',
                marginTop: '0.75rem'
              }}
            >
              🍽️ ดูประวัติอาหารทั้งหมด
            </button>
          )}
        </div>

        {/* กลุ่มการดูแลเรื่องอาหาร (เทรนเนอร์ & ปุ่ม) - แสดงเฉพาะฝั่งลูกเทรนดูสถิติตัวเอง */}
        {isTraineeSelf && (
          <div style={{ background: '#fff', padding: '1.2rem', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '0.95rem' }}>
              การดูแลเรื่องอาหาร
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {trainersList.length > 0 ? trainersList.map((trainer, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    background: '#f8fafc', 
                    padding: '0.5rem 0.75rem', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0',
                    gap: '0.5rem',
                    flex: '1 1 calc(50% - 0.75rem)',
                    minWidth: '140px'
                  }}>
                    {trainer.pictureUrl ? (
                      <img src={trainer.pictureUrl} alt="Trainer" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #f59e0b', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1rem' }}>👨‍🏫</div>
                    )}
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>เทรนเนอร์</div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.2, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {trainer.nickname || trainer.displayName || '-'}
                      </div>
                    </div>
                  </div>
                )) : (
                  trainerName ? (
                    <div style={{ 
                      display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', gap: '0.5rem', flex: 1
                    }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1rem' }}>👨‍🏫</div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>เทรนเนอร์</div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.2 }}>{trainerName || '-'}</div>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                type="button"
                onClick={() => setShowAddTrainerModal(true)}
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', 
                  padding: '0.75rem', borderRadius: '12px', border: '1px dashed #3b82f6',
                  color: '#3b82f6', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', width: '100%',
                  marginBottom: '0.5rem'
                }}
              >
                + เพิ่มเทรนเนอร์
              </button>

              <div style={{ display: 'flex', gap: '0.5rem', width: '100%', alignItems: 'stretch' }}>
                <button 
                  type="button"
                  className="btn-primary" 
                  style={{ flex: 1, width: '50%', margin: 0, padding: '0.75rem 0.25rem', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', backgroundColor: '#3b82f6', borderRadius: '12px', textAlign: 'center', border: '1px solid transparent', whiteSpace: 'nowrap', boxShadow: 'none' }}
                  onClick={() => setShowUploadModal(true)}
                >
                  <span style={{ fontSize: '1.1rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>📸</span> ส่งภาพอาหาร
                </button>
                <button 
                  type="button"
                  style={{ position: 'relative', flex: 1, width: '50%', margin: 0, padding: '0.75rem 0.25rem', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', borderRadius: '12px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', textAlign: 'center', cursor: 'pointer', transition: 'background-color 0.2s', whiteSpace: 'nowrap' }}
                  onClick={handleViewCommentsClick}
                >
                  {newCommentsCount > 0 && (
                    <div className="animate-shake" style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: '#ef4444',
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 5px rgba(239,68,68,0.5)',
                      zIndex: 10
                    }}>
                      {newCommentsCount > 9 ? '9+' : newCommentsCount}
                    </div>
                  )}
                  <span style={{ fontSize: '1.1rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>💬</span> ดูคอมเมนต์
                </button>
              </div>
              
              <button 
                type="button"
                onClick={() => navigate(`/food-history/${queryId}`, { state: { returnToDashboard: true, fromPath: window.location.pathname } })}
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', 
                  padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0',
                  color: '#475569', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', width: '100%'
                }}
              >
                🍽️ ดูประวัติอาหารทั้งหมด
              </button>
            </div>
          </div>
        )}



        {/* Events Slider for Trainee */}
        {isTraineeSelf && profile?.userId && (
          <TraineeEventsSlider userId={profile.userId} />
        )}

        {/* Appointments Slider for Trainee */}
        {isTraineeSelf && profile?.userId && (
          <TraineeAppointmentsSlider userId={profile.userId} />
        )}

        {recommendation && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', textAlign: 'center' }}>คำแนะนำสารอาหารล่าสุด</h3>
            <NutritionResultCard
              bmr={recommendation.bmr}
              goal={recommendation.goal}
              activityLevel={recommendation.activityLevel}
              adjustment={recommendation.adjustment}
              tdee={recommendation.tdee}
              targetCalories={recommendation.targetCalories}
              macros={recommendation.macros}
              latestMetrics={metricsData.length > 0 ? metricsData[metricsData.length - 1] : { 
                weight: traineeData?.weight || recommendation?.weight, 
                height: traineeData?.height || recommendation?.height 
              }}
              hideShareButton={!targetTraineeId}
            />
          </div>
        )}

          <>
            <p className="subtitle" style={{ marginBottom: '2rem' }}>กราฟสถิติการเปลี่ยนแปลงของร่างกาย</p>

            {metricsData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(0,0,0,0.02)', borderRadius: '16px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                <h3>ยังไม่มีข้อมูลการบันทึก</h3>
                <p style={{ color: 'var(--text-muted)' }}>
                  {isMyStats ? 'รอให้เทรนเนอร์บันทึกค่าร่างกายของคุณเพื่อดูกราฟสถิติที่นี่' : 'บันทึกค่าร่างกายของลูกเทรนเพื่อดูกราฟสถิติที่นี่'}
                </p>
              </div>
            ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* กราฟน้ำหนัก */}
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginBottom: '1rem', color: '#334155' }}>น้ำหนัก (กก.)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 12}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="weight" name="น้ำหนัก" stroke="#FF416C" strokeWidth={3} dot={{r: 5}} activeDot={{r: 8}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* กราฟเปอร์เซ็นต์ไขมัน */}
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginBottom: '1rem', color: '#334155' }}>เปอร์เซ็นต์ไขมัน (%)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 12}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="bodyFat" name="ไขมัน (%)" stroke="#f59e0b" strokeWidth={3} dot={{r: 5}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* กราฟมวลกระดูก */}
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginBottom: '1rem', color: '#334155' }}>มวลกระดูก (กก.)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 12}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="boneMass" name="มวลกระดูก" stroke="#8b5cf6" strokeWidth={3} dot={{r: 5}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* กราฟน้ำในร่างกาย */}
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginBottom: '1rem', color: '#334155' }}>น้ำในร่างกาย (%)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 12}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="bodyWater" name="น้ำในร่างกาย" stroke="#3b82f6" strokeWidth={3} dot={{r: 5}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* กราฟมวลกล้ามเนื้อ */}
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginBottom: '1rem', color: '#334155' }}>มวลกล้ามเนื้อ (กก.)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 12}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="muscleMass" name="มวลกล้ามเนื้อ" stroke="#0ea5e9" strokeWidth={3} dot={{r: 5}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* กราฟอัตราการเผาผลาญ */}
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginBottom: '1rem', color: '#334155' }}>อัตราการเผาผลาญ (kcal)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 12}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="metabolicRate" name="เผาผลาญ" stroke="#ef4444" strokeWidth={3} dot={{r: 5}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* กราฟอายุเซลล์ (Body Age) */}
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginBottom: '1rem', color: '#334155' }}>อายุเซลล์ (Body Age)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 12}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="bodyAge" name="อายุเซลล์" stroke="#10b981" strokeWidth={3} dot={{r: 5}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* กราฟระดับไขมันช่องท้อง */}
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginBottom: '1rem', color: '#334155' }}>ระดับไขมันช่องท้อง</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 12}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="visceralFat" name="ไขมันช่องท้อง" stroke="#f97316" strokeWidth={3} dot={{r: 5}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {(targetTraineeId || isTrainerSelf) && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <button 
              type="button"
              className="btn-secondary" 
              style={{ padding: '0.8rem 2rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setShowPastMetricsModal(true)}
            >
              🕒 บันทึกค่าร่างกายย้อนหลัง
            </button>
          </div>
        )}
          </>
      </div>



      {showUploadModal && queryId && (
        <FoodUploadModal traineeId={queryId} trainerIds={traineeData?.trainerIds || []} onClose={() => setShowUploadModal(false)} />
      )}
      
      {showLogsModal && queryId && (
        <FoodLogsModal traineeId={queryId} onClose={() => setShowLogsModal(false)} />
      )}

      {showFoodHistoryModal && (
        <FoodHistoryModal targetId={queryId} onClose={() => setShowFoodHistoryModal(false)} />
      )}

      {showAddTrainerModal && queryId && (
        <AddTrainerModal 
          traineeId={queryId} 
          currentTrainerIds={traineeData?.trainerIds || []}
          onClose={() => setShowAddTrainerModal(false)} 
          onSuccess={() => {
            setShowAddTrainerModal(false);
            window.location.reload();
          }} 
        />
      )}

      {showPastMetricsModal && queryId && (
        <PastMetricsModal 
          traineeData={traineeData}
          traineeId={queryId}
          traineeName={traineeName}
          onClose={() => setShowPastMetricsModal(false)}
          onSuccess={() => {
            setShowPastMetricsModal(false);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}

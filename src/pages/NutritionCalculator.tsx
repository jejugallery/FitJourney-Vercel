import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import NutritionResultCard from '../components/NutritionResultCard';
import TrainerFoodReviewModal from '../components/TrainerFoodReviewModal';
import SuccessPopup from '../components/SuccessPopup';
import { useLiff } from '../context/LiffContext';

type Goal = 'maintain' | 'lose' | 'build';

export default function NutritionCalculator() {
  const { targetId } = useParams();
  const navigate = useNavigate();
  const { profile } = useLiff();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [targetName, setTargetName] = useState<string>('');
  
  const [pendingFoodCount, setPendingFoodCount] = useState(0);
  const [showFoodReviewModal, setShowFoodReviewModal] = useState(false);
  
  const [bmr, setBmr] = useState<number | ''>('');
  const [goal, setGoal] = useState<Goal>('maintain');
  const [activityLevel, setActivityLevel] = useState<number>(1.2);
  const [adjustment, setAdjustment] = useState<number | ''>(300);
  const [latestMetrics, setLatestMetrics] = useState<any>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  useEffect(() => {
    if (!profile?.userId) return;
    
    const foodLogsQuery = query(
      collection(db, 'bodyMetrics'),
      where('trainerId', '==', profile.userId),
      where('hasFoodLogs', '==', true)
    );

    const unsubscribe = onSnapshot(foodLogsQuery, (snapshot) => {
      let validDocs: any[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.foodLogs && data.foodLogs.length > 0) {
          const hasUnread = data.foodLogs.some((log: any) => !log.trainerComment);
          if (hasUnread) {
            validDocs.push(data);
          }
        }
      });
      setPendingFoodCount(validDocs.length);
    });

    return () => unsubscribe();
  }, [profile?.userId]);

  // BMR Modal State
  const [showBmrModal, setShowBmrModal] = useState(false);
  const [calcGender, setCalcGender] = useState<'male'|'female'>('female');
  const [calcAge, setCalcAge] = useState<string>('');
  const [calcHeight, setCalcHeight] = useState<string>('');
  const [calcWeight, setCalcWeight] = useState<string>('');
  const [calculatedBmrValue, setCalculatedBmrValue] = useState<number | null>(null);

  useEffect(() => {
    if (showBmrModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showBmrModal]);

  useEffect(() => {
    const fetchLatestMetrics = async () => {
      if (!targetId) return;
      try {
        let userProfileData = null;
        
        // 1. Try to fetch from trainees
        const qTrainee = query(collection(db, 'trainees'), where('userId', '==', targetId));
        const snapTrainee = await getDocs(qTrainee);
        if (!snapTrainee.empty) {
          userProfileData = snapTrainee.docs[0].data();
        } else {
          // 2. Try to fetch from trainers
          const qTrainer = query(collection(db, 'trainers'), where('trainerId', '==', targetId));
          const snapTrainer = await getDocs(qTrainer);
          if (!snapTrainer.empty) {
            userProfileData = snapTrainer.docs[0].data();
          }
        }

        if (userProfileData) {
          if (userProfileData.gender) setCalcGender(userProfileData.gender);
          if (userProfileData.height) setCalcHeight(userProfileData.height.toString());
          
          if (userProfileData.dob) {
            // Calculate age
            const birthDate = new Date(userProfileData.dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
            if (age > 0) setCalcAge(age.toString());
          } else if (userProfileData.age) {
            // Fallback for old users
            setCalcAge(userProfileData.age.toString());
          }
          if (userProfileData.weight) {
            setCalcWeight(userProfileData.weight.toString());
          }
        }

        const q = query(
          collection(db, 'bodyMetrics'),
          where('traineeId', '==', targetId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          // Sort in memory to avoid needing a Firestore composite index
          const docs = snap.docs.map(doc => doc.data());
          docs.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA; // descending
          });
          
          const latestData = docs[0];
          setLatestMetrics(latestData);
          if (latestData.metabolicRate) {
            setBmr(Number(latestData.metabolicRate));
          }
          if (latestData.name) {
            setTargetName(latestData.name);
          }
          // Only fallback if not already set from profile
          if (!userProfileData?.dob && !userProfileData?.age && latestData.age) setCalcAge(latestData.age.toString());
          if (!userProfileData?.height && latestData.height) setCalcHeight(latestData.height.toString());
          if (latestData.weight) setCalcWeight(latestData.weight.toString());
        } else {
          if (userProfileData) {
             setTargetName(userProfileData.nickname || 'ข้อมูลผู้ใช้');
          } else {
             setTargetName('ไม่พบข้อมูลผู้ใช้');
          }
        }
      } catch (err) {
        console.error("Error fetching latest metrics:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLatestMetrics();
  }, [targetId]);

  const { tdee, targetCalories, macros } = useMemo(() => {
    const numericBmr = Number(bmr) || 0;
    const currentTdee = Math.round(numericBmr * activityLevel);
    
    let cal = currentTdee;
    if (goal === 'lose') cal -= (Number(adjustment) || 0);
    if (goal === 'build') cal += (Number(adjustment) || 0);
    
    // Safety check, minimum calories
    if (cal < 1000 && numericBmr > 0) cal = 1000;

    let pPercent = 30;
    let cPercent = 40;
    let fPercent = 30;

    if (goal === 'lose') {
      pPercent = 40;
      cPercent = 30;
      fPercent = 30;
    } else if (goal === 'build') {
      pPercent = 30;
      cPercent = 50;
      fPercent = 20;
    }

    const pGrams = Math.round((cal * (pPercent / 100)) / 4);
    const cGrams = Math.round((cal * (cPercent / 100)) / 4);
    const fGrams = Math.round((cal * (fPercent / 100)) / 9);

    // Summary mappings
    const goalText = goal === 'maintain' ? 'รักษามวลกล้ามเนื้อ' : goal === 'lose' ? 'ลดน้ำหนัก' : 'เพิ่มกล้ามเนื้อ';
    let activityText = 'ไม่ออกกำลังกายเลย';
    if (activityLevel === 1.375) activityText = 'ออกกำลังกาย 1-3 วัน/สัปดาห์';
    if (activityLevel === 1.55) activityText = 'ออกกำลังกาย 3-5 วัน/สัปดาห์';
    if (activityLevel === 1.725) activityText = 'ออกกำลังกาย 6-7 วัน/สัปดาห์';
    if (activityLevel === 1.9) activityText = 'ออกกำลังกายหนักมาก/นักกีฬา';

    return {
      tdee: currentTdee,
      targetCalories: cal,
      macros: { pPercent, cPercent, fPercent, pGrams, cGrams, fGrams },
      summaryStrings: { goalText, activityText }
    };
  }, [bmr, goal, activityLevel, adjustment]);

  const handleCalculateBmr = () => {
    const w = Number(calcWeight);
    const h = Number(calcHeight);
    const a = Number(calcAge);
    
    if (w > 0 && h > 0 && a > 0) {
      // Mifflin-St Jeor Equation
      let result = (10 * w) + (6.25 * h) - (5 * a);
      if (calcGender === 'male') {
        result += 5;
      } else {
        result -= 161;
      }
      result = Math.round(result);
      
      setCalculatedBmrValue(result);
      
      setTimeout(() => {
        setBmr(result);
        setShowBmrModal(false);
        setCalculatedBmrValue(null);
      }, 1500);
    } else {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    }
  };

  const handleSaveRecommendation = async (isShare = false) => {
    if (!targetId || !bmr) {
      alert('กรุณาระบุเป้าหมายและค่า BMR ก่อนบันทึก');
      return;
    }
    
    setSaving(true);
    try {
      await addDoc(collection(db, 'recommendation'), {
        targetId: targetId,
        bmr: Number(bmr),
        goal: goal,
        activityLevel: activityLevel,
        adjustment: Number(adjustment) || 0,
        tdee: tdee,
        targetCalories: targetCalories,
        macros: macros,
        weight: calcWeight ? Number(calcWeight) : null,
        height: calcHeight ? Number(calcHeight) : null,
        createdAt: serverTimestamp()
      });
      if (!isShare) {
        setShowSuccessPopup(true);
        setTimeout(() => {
          setShowSuccessPopup(false);
          navigate(-1);
        }, 2000);
      }
    } catch (error) {
      console.error('Error saving recommendation:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกคำแนะนำ');
    } finally {
      setSaving(false);
    }
  };

  const mergedMetrics = useMemo(() => {
    if (latestMetrics) {
      return {
        ...latestMetrics,
        weight: latestMetrics.weight || (calcWeight ? Number(calcWeight) : undefined),
        height: latestMetrics.height || (calcHeight ? Number(calcHeight) : undefined)
      };
    }
    if (calcWeight || calcHeight) {
      return {
        weight: calcWeight ? Number(calcWeight) : undefined,
        height: calcHeight ? Number(calcHeight) : undefined
      };
    }
    return null;
  }, [latestMetrics, calcWeight, calcHeight]);

  return (
    <>
      <Navbar 
        showProfile={true} 
        onProfileClick={() => setShowFoodReviewModal(true)}
        notificationCount={pendingFoodCount}
      />
      
      <div className="animate-fade-in-up" style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '100px 20px 0' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button 
            className="btn-secondary" 
            onClick={() => navigate(-1)} 
            style={{ padding: '0.4rem 0.8rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', background: '#fff' }}
          >
            ← กลับ
          </button>
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>คำนวณพลังงานและสารอาหาร</h2>
        </div>
      </div>
      
      <div className="dashboard-container animate-fade-in-up" style={{ padding: '1rem', maxWidth: '800px', margin: '1rem auto', paddingBottom: '3rem' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            
            {/* ฟอร์มการคำนวณ */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '1.2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)', fontSize: '1.1rem' }}>ข้อมูลสำหรับคำนวณ</h3>
              {targetName && <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>สำหรับ: <strong>{targetName}</strong></p>}
              
              <div className="metrics-form">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>ค่า BMR (อัตราการเผาผลาญพื้นฐาน)</span>
                    <button 
                      type="button" 
                      onClick={() => setShowBmrModal(true)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      คำนวณ BMR
                    </button>
                  </label>
                  <input 
                    type="number" 
                    value={bmr} 
                    onChange={(e) => setBmr(e.target.value === '' ? '' : Number(e.target.value))} 
                    placeholder="กรอกค่า BMR" 
                    style={{ padding: '0.6rem' }}
                  />
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem', fontSize: '0.75rem' }}>
                    *ดึงค่าล่าสุดจากฐานข้อมูล สามารถแก้ไขได้
                  </small>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.9rem' }}>เป้าหมาย (Goal)</label>
                  <select 
                    value={goal} 
                    onChange={(e) => setGoal(e.target.value as Goal)}
                    style={{ padding: '0.6rem' }}
                  >
                    <option value="maintain">รักษามวลกล้ามเนื้อ</option>
                    <option value="lose">ลดน้ำหนัก</option>
                    <option value="build">เพิ่มกล้ามเนื้อ</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.9rem' }}>ความเข้มข้นในการออกกำลังกาย</label>
                  <select 
                    value={activityLevel} 
                    onChange={(e) => setActivityLevel(Number(e.target.value))}
                    style={{ padding: '0.6rem' }}
                  >
                    <option value={1.2}>ไม่ออกกำลังกายเลย (Sedentary)</option>
                    <option value={1.375}>ออกกำลังกาย 1-3 วัน/สัปดาห์ (Light)</option>
                    <option value={1.55}>ออกกำลังกาย 3-5 วัน/สัปดาห์ (Moderate)</option>
                    <option value={1.725}>ออกกำลังกาย 6-7 วัน/สัปดาห์ (Active)</option>
                    <option value={1.9}>ออกกำลังกายหนักมาก/นักกีฬา (Very Active)</option>
                  </select>
                </div>

                {goal !== 'maintain' && (
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.9rem' }}>ปรับแต่งแคลอรี่ (สำหรับลด/เพิ่ม)</label>
                    <input 
                      type="number" 
                      value={adjustment} 
                      onChange={(e) => setAdjustment(e.target.value === '' ? '' : Number(e.target.value))} 
                      placeholder="เช่น 300" 
                      style={{ padding: '0.6rem' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ผลลัพธ์การคำนวณ */}
            {bmr ? (
              <NutritionResultCard
                bmr={bmr}
                goal={goal}
                activityLevel={activityLevel}
                adjustment={Number(adjustment) || 0}
                tdee={tdee}
                targetCalories={targetCalories}
                macros={macros}
                latestMetrics={mergedMetrics}
                onShare={() => handleSaveRecommendation(true)}
              />
            ) : (
              <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '2rem', textAlign: 'center', border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🧮</div>
                <h3 style={{ color: 'var(--text-muted)' }}>กรุณาระบุค่า BMR</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>เพื่อคำนวณและแสดงผลลัพธ์สารอาหาร</p>
              </div>
            )}
          </div>
        )}
        
        {!loading && (
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <button 
              className="btn-primary" 
              onClick={() => handleSaveRecommendation(false)}
              disabled={saving || !bmr}
              style={{ padding: '1rem 3rem', fontSize: '1.1rem', borderRadius: '50px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)' }}
            >
              {saving ? 'กำลังบันทึก...' : '💾 บันทึกคำแนะนำ'}
            </button>
          </div>
        )}
      </div>

      {/* BMR Calculator Modal */}
      {showBmrModal && (
        <div 
          onClick={() => setShowBmrModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
            opacity: showBmrModal ? 1 : 0, transition: 'opacity 0.3s'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '16px', padding: '1.5rem',
              width: '100%', maxWidth: '350px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              transform: showBmrModal ? 'translateY(0)' : 'translateY(20px)',
              transition: 'transform 0.3s',
              maxHeight: '90vh', overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '0.2rem', color: 'var(--primary)' }}>คำนวณค่า BMR</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>*คำนวณคร่าว ๆ จากรูปร่างของร่างกาย</div>
              </div>
              <button 
                onClick={() => setShowBmrModal(false)} 
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>
            
            {calculatedBmrValue === null ? (
              <div className="metrics-form">
                
                {/* แถว 1: น้ำหนัก (ใหญ่พิเศษ) */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>น้ำหนักตัว (กก.)</label>
                  <input 
                    type="number" 
                    value={calcWeight} 
                    onChange={(e) => setCalcWeight(e.target.value)} 
                    placeholder="เช่น 65.5" 
                    style={{ padding: '0.8rem', fontSize: '1.5rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--primary)' }}
                    autoFocus
                  />
                </div>

                {/* แถว 2: ส่วนสูง */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.9rem' }}>ส่วนสูง (ซม.)</label>
                  <input 
                    type="number" 
                    value={calcHeight} 
                    onChange={(e) => setCalcHeight(e.target.value)} 
                    placeholder="เช่น 170" 
                    style={{ padding: '0.6rem' }}
                  />
                </div>

                {/* แถว 3: เพศ */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.9rem' }}>เพศ</label>
                  <select 
                    value={calcGender} 
                    onChange={(e) => setCalcGender(e.target.value as 'male'|'female')}
                    style={{ padding: '0.6rem' }}
                  >
                    <option value="male">ชาย</option>
                    <option value="female">หญิง</option>
                  </select>
                </div>

                {/* แถว 4: อายุ */}
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.9rem' }}>อายุ (ปี)</label>
                  <input 
                    type="number" 
                    value={calcAge} 
                    onChange={(e) => setCalcAge(e.target.value)} 
                    placeholder="เช่น 25" 
                    style={{ padding: '0.6rem' }}
                  />
                </div>
                
                <div style={{ display: 'flex' }}>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handleCalculateBmr}
                    style={{ flex: 1, padding: '0.8rem', fontSize: '1.1rem' }}
                    disabled={!calcWeight || !calcHeight || !calcAge}
                  >
                    คำนวณ
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0' }} className="animate-fade-in-up">
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✨</div>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ค่า BMR ของคุณคือ</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '1rem' }}>
                  {calculatedBmrValue}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>กำลังนำไปใช้คำนวณ...</div>
              </div>
            )}
          </div>
        </div>
      )}

      {showFoodReviewModal && profile?.userId && (
        <TrainerFoodReviewModal 
          trainerId={profile.userId} 
          onClose={() => setShowFoodReviewModal(false)} 
        />
      )}

      <SuccessPopup show={showSuccessPopup} message="บันทึกคำแนะนำเรียบร้อยแล้ว" />
    </>
  );
}

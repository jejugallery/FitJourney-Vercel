import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface TraineeProfile {
  userId: string;
  nickname: string;
  lineName?: string;
  pictureUrl?: string;
  gender?: 'male' | 'female';
  age?: number;
  height?: number;
  province?: string;
  zone?: string;
}

interface BodyMetric {
  id: string;
  weight: number;
  bodyFat: number;
  muscleMass: number;
  metabolicRate: number;
  boneMass: number;
  bodyWater: number;
  visceralFat: number;
  bodyAge: number;
  physiqueRating?: number;
  age: number;
  height: number;
  createdAt: any;
}

export default function BodyMetricsAnalysisPage() {
  const { traineeId } = useParams<{ traineeId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trainee, setTrainee] = useState<TraineeProfile | null>(null);
  const [latestMetric, setLatestMetric] = useState<BodyMetric | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!traineeId) return;
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch Trainee Profile
        let traineeData: TraineeProfile | null = null;
        
        // Check if traineeId corresponds to current trainer/admin (isSelf)
        const trainerRef = doc(db, 'trainers', traineeId);
        const trainerSnap = await getDoc(trainerRef);
        
        if (trainerSnap.exists()) {
          const tData = trainerSnap.data();
          traineeData = {
            userId: traineeId,
            nickname: tData.nickname || tData.displayName || 'เทรนเนอร์',
            pictureUrl: tData.pictureUrl || '',
            gender: tData.gender || 'male',
            age: Number(tData.age) || 30,
            height: Number(tData.height) || 170
          };
        } else {
          // Check trainers collection by trainerId field
          const trainerQuery = query(collection(db, 'trainers'), where('trainerId', '==', traineeId));
          const trainerQuerySnap = await getDocs(trainerQuery);
          if (!trainerQuerySnap.empty) {
            const tData = trainerQuerySnap.docs[0].data();
            traineeData = {
              userId: traineeId,
              nickname: tData.nickname || tData.displayName || 'เทรนเนอร์',
              pictureUrl: tData.pictureUrl || '',
              gender: tData.gender || 'male',
              age: Number(tData.age) || 30,
              height: Number(tData.height) || 170
            };
          } else {
            // Find in trainees collection
            const traineeQuery = query(collection(db, 'trainees'), where('userId', '==', traineeId));
            const traineeSnap = await getDocs(traineeQuery);
            if (!traineeSnap.empty) {
              const tData = traineeSnap.docs[0].data();
              traineeData = {
                userId: tData.userId,
                nickname: tData.nickname || tData.lineName || 'ลูกเทรน',
                lineName: tData.lineName,
                pictureUrl: tData.pictureUrl || '',
                gender: tData.gender || 'male',
                age: Number(tData.age),
                height: Number(tData.height),
                province: tData.province,
                zone: tData.zone
              };
            }
          }
        }

        setTrainee(traineeData);

        // 2. Fetch Latest Metric
        const mQuery = query(collection(db, 'bodyMetrics'), where('traineeId', '==', traineeId));
        const mSnap = await getDocs(mQuery);
        
        if (!mSnap.empty) {
          const metrics: BodyMetric[] = [];
          mSnap.forEach(d => {
            const data = d.data();
             metrics.push({
              id: d.id,
              weight: Number(data.weight),
              bodyFat: Number(data.bodyFat),
              muscleMass: Number(data.muscleMass),
              metabolicRate: Number(data.metabolicRate),
              boneMass: Number(data.boneMass),
              bodyWater: Number(data.bodyWater),
              visceralFat: Number(data.visceralFat),
              bodyAge: Number(data.bodyAge),
              physiqueRating: data.physiqueRating !== undefined && data.physiqueRating !== null && data.physiqueRating !== '' ? Number(data.physiqueRating) : undefined,
              age: Number(data.age || traineeData?.age),
              height: Number(data.height || traineeData?.height),
              createdAt: data.createdAt
            });
          });

          // Sort descending by timestamp/createdAt
          metrics.sort((a, b) => {
            const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tB - tA;
          });

          setLatestMetric(metrics[0]);
        } else {
          setError('ไม่พบข้อมูลบันทึกค่าร่างกายของลูกเทรนท่านนี้');
        }
      } catch (err) {
        console.error('Error fetching body metrics analysis:', err);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [traineeId]);

  // Helpers for Analysis
  const getBmiStatus = (bmi: number) => {
    if (bmi < 18.5) return { status: 'ผอม', color: '#3b82f6', text: 'น้ำหนักต่ำกว่าเกณฑ์ ควรเพิ่มสารอาหารและโปรตีน' };
    if (bmi <= 22.9) return { status: 'ปกติ', color: '#10b981', text: 'น้ำหนักปกติ สุขภาพดี รักษาระดับนี้ไว้' };
    if (bmi <= 24.9) return { status: 'น้ำหนักเกิน', color: '#f59e0b', text: 'น้ำหนักเกินเกณฑ์เล็กน้อย เริ่มมีไขมันสะสม' };
    if (bmi <= 29.9) return { status: 'โรคอ้วน', color: '#f97316', text: 'โรคอ้วนระดับ 1 ควรเริ่มคุมอาหารและออกกำลังกาย' };
    return { status: 'โรคอ้วนอันตราย', color: '#ef4444', text: 'โรคอ้วนอันตรายระดับ 2 เสี่ยงต่อภาวะแทรกซ้อน' };
  };

  const getBodyFatStatus = (fat: number, gender: 'male' | 'female') => {
    if (gender === 'male') {
      if (fat < 6) return { status: 'ไขมันต่ำมาก', color: '#3b82f6', text: 'ระดับไขมันต่ำมาก (เกณฑ์นักกีฬาประกวด)' };
      if (fat <= 13) return { status: 'นักกีฬา', color: '#10b981', text: 'ระดับนักกีฬา หุ่นลีนและมีนิยามกล้ามเนื้อชัดเจน' };
      if (fat <= 17) return { status: 'ฟิตเนส', color: '#10b981', text: 'ระดับฟิตเนส สุขภาพดี มีกล้ามเนื้อกระชับ' };
      if (fat <= 24) return { status: 'ทั่วไป', color: '#f59e0b', text: 'ระดับปกติทั่วไป แต่เริ่มมีไขมันสะสมตามร่างกาย' };
      return { status: 'อ้วน', color: '#ef4444', text: 'ไขมันสะสมสูงเกินเกณฑ์ เสี่ยงต่อสุขภาพ' };
    } else {
      if (fat < 14) return { status: 'ไขมันต่ำมาก', color: '#3b82f6', text: 'ระดับไขมันต่ำมาก (อาจมีผลต่อระดับฮอร์โมน)' };
      if (fat <= 20) return { status: 'นักกีฬา', color: '#10b981', text: 'ระดับนักกีฬา ร่างกายฟิต เฟิร์ม สมส่วน' };
      if (fat <= 24) return { status: 'ฟิตเนส', color: '#10b981', text: 'ระดับฟิตเนส หุ่นสมส่วน สุขภาพดี' };
      if (fat <= 31) return { status: 'ทั่วไป', color: '#f59e0b', text: 'ระดับปกติทั่วไป มีการสะสมของไขมันตามธรรมชาติ' };
      return { status: 'อ้วน', color: '#ef4444', text: 'ไขมันสะสมเกินมาตรฐาน ควรลดไขมันสะสมเพื่อสุขภาพ' };
    }
  };

  const getMuscleStatus = (muscleMass: number, weight: number, gender: 'male' | 'female') => {
    const musclePercent = (muscleMass / weight) * 100;
    if (gender === 'male') {
      if (musclePercent < 32.9) return { percent: musclePercent, status: 'ต่ำ', color: '#ef4444', text: 'มวลกล้ามเนื้อน้อย ควรเพิ่มการออกกำลังกายแบบแรงต้าน' };
      if (musclePercent <= 35.7) return { percent: musclePercent, status: 'ปกติ', color: '#10b981', text: 'มวลกล้ามเนื้ออยู่ในเกณฑ์ปกติและสมส่วน' };
      if (musclePercent <= 37.3) return { percent: musclePercent, status: 'สูง', color: '#10b981', text: 'มวลกล้ามเนื้อดี ร่างกายกระชับและเผาผลาญได้ดี' };
      return { percent: musclePercent, status: 'สูงมาก', color: '#8b5cf6', text: 'มวลกล้ามเนื้อเยอะมาก ร่างกายฟิตเฟิร์มสูงสุด' };
    } else {
      if (musclePercent < 25.9) return { percent: musclePercent, status: 'ต่ำ', color: '#ef4444', text: 'มวลกล้ามเนื้อน้อย เสี่ยงต่อการเผาผชาญลดลง' };
      if (musclePercent <= 27.9) return { percent: musclePercent, status: 'ปกติ', color: '#10b981', text: 'มวลกล้ามเนื้อปกติ รักษาระดับไว้เพื่อระบบเผาผลาญที่ดี' };
      if (musclePercent <= 29.0) return { percent: musclePercent, status: 'สูง', color: '#10b981', text: 'มวลกล้ามเนื้อดี สัดส่วนกระชับ เฟิร์ม' };
      return { percent: musclePercent, status: 'สูงมาก', color: '#8b5cf6', text: 'มวลกล้ามเนื้อระดับนักกีฬา ร่างกายมีสัดส่วนชัดเจน' };
    }
  };

  const getVisceralFatStatus = (vFat: number) => {
    if (vFat <= 2) return { status: 'สมบูรณ์สูงสุด', color: '#10b981', text: 'สุขภาพสมบูรณ์สูงสุด ไม่มีไขมันในช่องท้องที่เป็นอันตราย' };
    if (vFat <= 5) return { status: 'ปกติ', color: '#10b981', text: 'ระดับปกติ ไม่มีผลเสียหรือความเสี่ยงต่อสุขภาพ' };
    if (vFat <= 10) return { status: 'เสี่ยงเริ่มต้น', color: '#f59e0b', text: 'ไขมันสะสมในช่องท้องระดับเริ่มต้น ควรเริ่มปรับเปลี่ยนอาหาร' };
    if (vFat <= 15) return { status: 'อันตราย', color: '#f97316', text: 'ระดับอันตราย เสี่ยงต่อโรคหลอดเลือดหัวใจและเบาหวาน' };
    return { status: 'อันตรายมาก', color: '#ef4444', text: 'ระดับอันตรายสูงสุด รีบลดไขมันช่องท้องด่วนที่สุด' };
  };

  const getBodyWaterStatus = (water: number, gender: 'male' | 'female') => {
    if (gender === 'male') {
      if (water < 50) return { status: 'ต่ำกว่าเกณฑ์', color: '#f59e0b', text: 'ปริมาณน้ำในร่างกายน้อยกว่าเกณฑ์ ควรดื่มน้ำเพิ่มขึ้น' };
      if (water <= 65) return { status: 'ปกติ', color: '#10b981', text: 'ปริมาณน้ำในร่างกายอยู่ในระดับปกติ สุขภาพดี' };
      return { status: 'สูง', color: '#3b82f6', text: 'ปริมาณน้ำในร่างกายสูงหรือมีความชุ่มชื้นสูง' };
    } else {
      if (water < 45) return { status: 'ต่ำกว่าเกณฑ์', color: '#f59e0b', text: 'น้ำในร่างกายน้อย ร่างกายอาจเริ่มขาดน้ำ ดื่มน้ำให้เพียงพอ' };
      if (water <= 60) return { status: 'ปกติ', color: '#10b981', text: 'ระดับน้ำในร่างกายปกติ สมดุลดี' };
      return { status: 'สูง', color: '#3b82f6', text: 'ปริมาณน้ำในร่างกายสูง ชุ่มชื้นดีเยี่ยม' };
    }
  };

  const getBoneMassStatus = (bone: number, weight: number, gender: 'male' | 'female') => {
    let target = 0;
    if (gender === 'female') {
      if (weight < 50) target = 1.95;
      else if (weight <= 75) target = 2.4;
      else target = 2.95;
    } else {
      if (weight < 65) target = 2.66;
      else if (weight <= 75) target = 3.29;
      else target = 3.69;
    }

    if (bone < target - 0.1) {
      return { target, status: 'ต่ำกว่าเกณฑ์', color: '#f59e0b', text: `ต่ำกว่าเป้าหมาย (${target} กก.) ควรเสริมแคลเซียมและวิตามิน D` };
    }
    return { target, status: 'ปกติ', color: '#10b981', text: `ปกติ (ตรงตามเป้าหมายของช่วงน้ำหนักนี้: ${target} กก.)` };
  };

  const getBodyAgeStatus = (bodyAge: number, actualAge: number) => {
    const diff = bodyAge - actualAge;
    if (diff < 0) {
      return { status: 'ดีเยี่ยม', color: '#10b981', text: `อายุเซลล์อ่อนกว่าอายุจริงถึง ${Math.abs(diff)} ปี ยอดเยี่ยมมาก!` };
    }
    if (diff === 0) {
      return { status: 'ปกติ', color: '#10b981', text: 'อายุเซลล์ตรงกับอายุจริงตามเกณฑ์มาตรฐาน' };
    }
    return { status: 'ควรปรับปรุง', color: '#ef4444', text: `อายุเซลล์แก่กว่าอายุจริงอยู่ ${diff} ปี ควรฟื้นฟูระบบเผาผลาญ` };
  };



  const getBmiPercent = (bmi: number) => {
    if (bmi < 18.5) return Math.max(0, ((bmi - 15) / (18.5 - 15)) * 40);
    if (bmi < 23) return 40 + ((bmi - 18.5) / (23 - 18.5)) * 20;
    if (bmi < 25) return 60 + ((bmi - 23) / (25 - 23)) * 10;
    if (bmi < 30) return 70 + ((bmi - 25) / (30 - 25)) * 15;
    return Math.min(100, 85 + ((bmi - 30) / (35 - 30)) * 15);
  };

  const getFatPercent = (fat: number, gender: 'male' | 'female') => {
    if (gender === 'male') {
      if (fat < 6) return Math.max(0, ((fat - 2) / (6 - 2)) * 15);
      if (fat < 18) return 15 + ((fat - 6) / (18 - 6)) * 25;
      if (fat < 25) return 40 + ((fat - 18) / (25 - 18)) * 25;
      return Math.min(100, 65 + ((fat - 25) / (35 - 25)) * 35);
    } else {
      if (fat < 14) return Math.max(0, ((fat - 10) / (14 - 10)) * 20);
      if (fat < 25) return 20 + ((fat - 14) / (25 - 14)) * 20;
      if (fat < 32) return 40 + ((fat - 25) / (32 - 25)) * 25;
      return Math.min(100, 65 + ((fat - 32) / (45 - 32)) * 35);
    }
  };



  const getVisceralPercent = (vFat: number) => {
    if (vFat <= 5) return Math.max(0, (vFat / 5) * 30);
    if (vFat <= 10) return 30 + ((vFat - 5) / 5) * 30;
    if (vFat <= 15) return 60 + ((vFat - 10) / 5) * 25;
    return Math.min(100, 85 + ((vFat - 15) / 5) * 15);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', background: '#f8fafc' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: '#64748b' }}>กำลังโหลดผลวิเคราะห์ค่าร่างกาย...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !trainee || !latestMetric) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ maxWidth: '500px', margin: '4rem auto', background: '#fff', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚠️</div>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>ไม่พบข้อมูลหรือเกิดข้อผิดพลาด</h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{error || 'กรุณาลองใหม่อีกครั้ง'}</p>
          <button onClick={() => navigate(-1)} className="btn-primary" style={{ margin: 0, padding: '0.6rem 2rem', fontSize: '1rem' }}>ย้อนกลับ</button>
        </div>
      </div>
    );
  }

  // Calculate values
  const bmi = Number((latestMetric.weight / Math.pow(latestMetric.height / 100, 2)).toFixed(1));
  const gender = trainee.gender || 'male';
  const actualAge = latestMetric.age || trainee.age || 30;

  const bmiAnalysis = getBmiStatus(bmi);
  const fatAnalysis = getBodyFatStatus(latestMetric.bodyFat, gender);
  const muscleAnalysis = getMuscleStatus(latestMetric.muscleMass, latestMetric.weight, gender);
  const visceralAnalysis = getVisceralFatStatus(latestMetric.visceralFat);
  const waterAnalysis = getBodyWaterStatus(latestMetric.bodyWater, gender);
  const boneAnalysis = getBoneMassStatus(latestMetric.boneMass, latestMetric.weight, gender);
  const ageAnalysis = getBodyAgeStatus(latestMetric.bodyAge, actualAge);
  const getPhysiqueRatingInfo = (ratingNumber: number) => {
    let label = 'มาตรฐาน';
    let color = '#10b981';
    
    switch (ratingNumber) {
      case 1:
        label = 'อ้วนแบบซ่อนรูป';
        color = '#ef4444';
        break;
      case 2:
        label = 'อ้วน';
        color = '#ef4444';
        break;
      case 3:
        label = 'อ้วนร่างใหญ่';
        color = '#f97316';
        break;
      case 4:
        label = 'ออกกำลังกายน้อย';
        color = '#f59e0b';
        break;
      case 5:
        label = 'มาตรฐาน';
        color = '#10b981';
        break;
      case 6:
        label = 'มาตรฐานและมีกล้ามเนื้อ';
        color = '#10b981';
        break;
      case 7:
        label = 'ผอม';
        color = '#3b82f6';
        break;
      case 8:
        label = 'ผอมและมีกล้ามเนื้อ';
        color = '#10b981';
        break;
      case 9:
        label = 'มีกล้ามเนื้อมาก';
        color = '#8b5cf6';
        break;
    }
    return { rating: ratingNumber, label, color };
  };

  const physiqueRating = latestMetric.physiqueRating !== undefined && latestMetric.physiqueRating >= 1 && latestMetric.physiqueRating <= 9
    ? getPhysiqueRatingInfo(latestMetric.physiqueRating)
    : getPhysiqueRatingInfo(5);

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '0 1rem 3rem 1rem', fontFamily: "'Inter', 'Outfit', sans-serif" }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Sticky Header and Profile Card Container */}
        <div style={{ 
          position: 'sticky', 
          top: 0, 
          background: '#f1f5f9', 
          zIndex: 50, 
          paddingTop: '1rem', 
          paddingBottom: '1rem' 
        }}>
          {/* Navigation & Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <button 
              className="btn-secondary" 
              onClick={() => navigate(-1)}
              style={{ padding: '0.4rem 0.8rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', background: '#fff' }}
            >
              ← กลับ
            </button>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--dark)' }}>วิเคราะห์ค่าร่างกาย</h2>
          </div>

          {/* Profile Card */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', margin: 0, boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {trainee.pictureUrl ? (
              <img src={trainee.pictureUrl} alt={trainee.nickname} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: '#fff' }}>👤</div>
            )}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.25rem', color: 'var(--text-main)' }}>
                {trainee.nickname} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 'normal' }}>({actualAge} ปี)</span>
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(255, 65, 108, 0.1)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                  {gender === 'male' ? 'เพศชาย' : 'เพศหญิง'}
                </span>
                <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                  ส่วนสูง: {latestMetric.height} ซม.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* 1. Weight & BMI */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--dark)', lineHeight: '1.2' }}>
                ⚖️ ดัชนีมวลกาย
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal', marginTop: '0.2rem' }}>(BMI)</span>
              </h4>
              <span style={{ backgroundColor: bmiAnalysis.color, color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {bmiAnalysis.status}
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block' }}>น้ำหนักปัจจุบัน</span>
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{latestMetric.weight} <span style={{ fontSize: '1rem', fontWeight: 500 }}>กก.</span></span>
              </div>
              <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '2rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block' }}>ค่าดัชนีมวลกาย (BMI)</span>
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{bmi} <span style={{ fontSize: '1rem', fontWeight: 500 }}>kg/m²</span></span>
              </div>
            </div>

            {/* BMI Gauge bar */}
            <div style={{ position: 'relative', height: '10px', background: '#e2e8f0', borderRadius: '5px', marginBottom: '1.5rem', marginTop: '1.5rem', overflow: 'visible' }}>
              <div style={{ display: 'flex', width: '100%', height: '100%', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: '40%', background: '#3b82f6' }} title="ผอม (<18.5)"></div>
                <div style={{ width: '20%', background: '#10b981' }} title="ปกติ (18.5-22.9)"></div>
                <div style={{ width: '10%', background: '#f59e0b' }} title="น้ำหนักเกิน (23-24.9)"></div>
                <div style={{ width: '15%', background: '#f97316' }} title="อ้วน (25-29.9)"></div>
                <div style={{ width: '15%', background: '#ef4444' }} title="อ้วนอันตราย (30+)"></div>
              </div>
              
              {/* Current Value Marker Pin */}
              {(() => {
                const percent = getBmiPercent(bmi);
                return (
                  <div style={{ position: 'absolute', left: `${percent}%`, top: '-4px', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', border: `4px solid ${bmiAnalysis.color}`, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
                  </div>
                );
              })()}
            </div>

            {/* BMI Scale Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.8rem' }}>
              <span>🔵 &lt;18.5: ผอม</span>
              <span>🟢 18.5-22.9: ปกติ</span>
              <span>🟡 23-24.9: น้ำหนักเกิน</span>
              <span>🟠 25-29.9: โรคอ้วน</span>
              <span>🔴 30+: โรคอ้วนอันตราย</span>
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', background: '#f8fafc', padding: '0.8rem', borderRadius: '10px', borderLeft: `4px solid ${bmiAnalysis.color}` }}>
              {bmiAnalysis.text}
            </p>
          </div>

          {/* 2. Body Fat % */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--dark)', lineHeight: '1.2' }}>
                <img src="/fat-icon.png" alt="fat" style={{ width: '1.2em', height: '1.2em', objectFit: 'contain', verticalAlign: 'middle', marginRight: '0.3em' }} /> เปอร์เซ็นต์ไขมัน
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal', marginTop: '0.2rem' }}>(% Fat)</span>
              </h4>
              <span style={{ backgroundColor: fatAnalysis.color, color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {fatAnalysis.status}
              </span>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block' }}>เปอร์เซ็นต์ไขมัน</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{latestMetric.bodyFat} <span style={{ fontSize: '1rem', fontWeight: 500 }}>%</span></span>
            </div>

            {/* Body Fat Gauge */}
            <div style={{ position: 'relative', height: '10px', background: '#e2e8f0', borderRadius: '5px', marginBottom: '1.5rem', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', width: '100%', height: '100%', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: gender === 'male' ? '15%' : '20%', background: '#3b82f6' }} title="ไขมันต่ำ"></div>
                <div style={{ width: gender === 'male' ? '25%' : '20%', background: '#10b981' }} title="ฟิตเนส/นักกีฬา"></div>
                <div style={{ width: gender === 'male' ? '25%' : '25%', background: '#f59e0b' }} title="ทั่วไป"></div>
                <div style={{ width: gender === 'male' ? '35%' : '35%', background: '#ef4444' }} title="อ้วน"></div>
              </div>
              
              {/* Current Value Marker Pin */}
              {(() => {
                const percent = getFatPercent(latestMetric.bodyFat, gender);
                return (
                  <div style={{ position: 'absolute', left: `${percent}%`, top: '-4px', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', border: `4px solid ${fatAnalysis.color}`, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
                  </div>
                );
              })()}
            </div>

            {/* Body Fat Scale Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.8rem' }}>
              {gender === 'male' ? (
                <>
                  <span>🔵 2-5%: ต่ำมาก</span>
                  <span>🟢 6-13%: นักกีฬา</span>
                  <span>🟢 14-17%: ฟิตเนส</span>
                  <span>🟡 18-24%: ทั่วไป</span>
                  <span>🔴 25%+: อ้วน</span>
                </>
              ) : (
                <>
                  <span>🔵 10-13%: ต่ำมาก</span>
                  <span>🟢 14-20%: นักกีฬา</span>
                  <span>🟢 21-24%: ฟิตเนส</span>
                  <span>🟡 25-31%: ทั่วไป</span>
                  <span>🔴 32%+: อ้วน</span>
                </>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', background: '#f8fafc', padding: '0.8rem', borderRadius: '10px', borderLeft: `4px solid ${fatAnalysis.color}` }}>
              {fatAnalysis.text}
            </p>
          </div>

          {/* 3. Muscle Mass */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--dark)', lineHeight: '1.2' }}>
                💪 มวลกล้ามเนื้อ
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal', marginTop: '0.2rem' }}>(Muscle Mass)</span>
              </h4>
              <span style={{ backgroundColor: physiqueRating.color, color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                ระดับ {physiqueRating.rating}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block' }}>น้ำหนักกล้ามเนื้อ</span>
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{latestMetric.muscleMass} <span style={{ fontSize: '1rem', fontWeight: 500 }}>กก.</span></span>
              </div>
              <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '2rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block' }}>คิดเป็นเปอร์เซ็นต์มวลกล้ามเนื้อ</span>
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{muscleAnalysis.percent.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 500 }}>%</span></span>
              </div>
              <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '2rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block' }}>ระดับมวลกล้ามเนื้อ</span>
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{physiqueRating.rating} <span style={{ fontSize: '1rem', fontWeight: 600, color: physiqueRating.color }}>({physiqueRating.label})</span></span>
              </div>
            </div>

            {/* Physique Rating 1-9 Legend in two columns */}
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.8rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.6rem' }}>เกณฑ์ระดับมวลกล้ามเนื้อ (สัดส่วนของกล้ามเนื้อกับไขมัน):</div>
              <div style={{ display: 'flex', gap: '2rem' }}>
                {/* Column 1: 1-5 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <span style={{ fontWeight: physiqueRating.rating === 1 ? '700' : 'normal', color: physiqueRating.rating === 1 ? 'var(--primary)' : 'inherit' }}>1: อ้วนแบบซ่อนรูป</span>
                  <span style={{ fontWeight: physiqueRating.rating === 2 ? '700' : 'normal', color: physiqueRating.rating === 2 ? 'var(--primary)' : 'inherit' }}>2: อ้วน</span>
                  <span style={{ fontWeight: physiqueRating.rating === 3 ? '700' : 'normal', color: physiqueRating.rating === 3 ? 'var(--primary)' : 'inherit' }}>3: อ้วนร่างใหญ่</span>
                  <span style={{ fontWeight: physiqueRating.rating === 4 ? '700' : 'normal', color: physiqueRating.rating === 4 ? 'var(--primary)' : 'inherit' }}>4: ออกกำลังกายน้อย</span>
                  <span style={{ fontWeight: physiqueRating.rating === 5 ? '700' : 'normal', color: physiqueRating.rating === 5 ? 'var(--primary)' : 'inherit' }}>5: มาตรฐาน</span>
                </div>
                {/* Column 2: 6-9 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <span style={{ fontWeight: physiqueRating.rating === 6 ? '700' : 'normal', color: physiqueRating.rating === 6 ? 'var(--primary)' : 'inherit' }}>6: มาตรฐานและมีกล้ามเนื้อ</span>
                  <span style={{ fontWeight: physiqueRating.rating === 7 ? '700' : 'normal', color: physiqueRating.rating === 7 ? 'var(--primary)' : 'inherit' }}>7: ผอม</span>
                  <span style={{ fontWeight: physiqueRating.rating === 8 ? '700' : 'normal', color: physiqueRating.rating === 8 ? 'var(--primary)' : 'inherit' }}>8: ผอมและมีกล้ามเนื้อ</span>
                  <span style={{ fontWeight: physiqueRating.rating === 9 ? '700' : 'normal', color: physiqueRating.rating === 9 ? 'var(--primary)' : 'inherit' }}>9: มีกล้ามเนื้อมาก</span>
                </div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', background: '#f8fafc', padding: '0.8rem', borderRadius: '10px', borderLeft: `4px solid ${physiqueRating.color}` }}>
              สัดส่วนร่างกายปัจจุบันอยู่ในประเภท <strong>{physiqueRating.label} (ระดับ {physiqueRating.rating})</strong>: {
                physiqueRating.rating === 1 ? 'มีเปอร์เซ็นต์ไขมันสูงแต่มวลกล้ามเนื้อน้อย ควรเน้นเวทเทรนนิ่งเพื่อสร้างกล้ามเนื้อและลดไขมัน' :
                physiqueRating.rating === 2 ? 'มีไขมันสะสมสูงและกล้ามเนื้ออยู่ในระดับปานกลาง ควรออกกำลังกายแบบคาร์ดิโอควบคู่แรงต้าน' :
                physiqueRating.rating === 3 ? 'โครงสร้างใหญ่ มีกล้ามเนื้อเยอะแต่ก็มีไขมันสะสมสูงเช่นกัน ควรเน้นควบคุมอาหารเพื่อลดไขมัน' :
                physiqueRating.rating === 4 ? 'เปอร์เซ็นต์ไขมันปานกลางแต่มวลกล้ามเนื้อน้อยเนื่องจากขาดการออกกำลังกาย ควรเริ่มสร้างความแข็งแรง' :
                physiqueRating.rating === 5 ? 'สัดส่วนมาตรฐาน สมดุลระหว่างกล้ามเนื้อและไขมันดี รักษาวินัยการออกกำลังกายต่อไป' :
                physiqueRating.rating === 6 ? 'รูปร่างสมส่วนและมีกล้ามเนื้อเด่นชัด มีอัตราเผาผลาญดี สุขภาพร่างกายแข็งแรง' :
                physiqueRating.rating === 7 ? 'รูปร่างผอม บาง มีไขมันและมวลกล้ามเนื้อในระดับต่ำ ควรเพิ่มการรับประทานอาหารและฝึกแรงต้าน' :
                physiqueRating.rating === 8 ? 'รูปร่างผอมลีน ไขมันต่ำและมีมวลกล้ามเนื้อสมสัดส่วน เป็นหุ่นสุขภาพดีแบบลีน' :
                'มวลกล้ามเนื้อสูงมากและไขมันต่ำมาก ร่างกายฟิตสมส่วนระดับนักกีฬาหรือผู้ฝึกฝนอย่างหนัก'
              }
            </p>
          </div>

          {/* 4. Visceral Fat */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--dark)', lineHeight: '1.2' }}>
                🫀 ระดับไขมันในช่องท้อง
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal', marginTop: '0.2rem' }}>(Visceral Fat)</span>
              </h4>
              <span style={{ backgroundColor: visceralAnalysis.color, color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {visceralAnalysis.status}
              </span>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block' }}>ระดับไขมันสะสมในช่องท้อง</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{latestMetric.visceralFat}</span>
            </div>

            {/* Visceral Fat Bar */}
            <div style={{ position: 'relative', height: '10px', background: '#e2e8f0', borderRadius: '5px', marginBottom: '1.5rem', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', width: '100%', height: '100%', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: '30%', background: '#10b981' }} title="ปกติ (1-5)"></div>
                <div style={{ width: '30%', background: '#f59e0b' }} title="เสี่ยงเริ่มต้น (6-10)"></div>
                <div style={{ width: '25%', background: '#f97316' }} title="อันตราย (11-15)"></div>
                <div style={{ width: '15%', background: '#ef4444' }} title="อันตรายมาก (16+)"></div>
              </div>
              
              {/* Current Value Marker Pin */}
              {(() => {
                const percent = getVisceralPercent(latestMetric.visceralFat);
                return (
                  <div style={{ position: 'absolute', left: `${percent}%`, top: '-4px', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', border: `4px solid ${visceralAnalysis.color}`, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
                  </div>
                );
              })()}
            </div>

            {/* Visceral Fat Scale Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.8rem' }}>
              <span>🟢 1-2: สมบูรณ์สูงสุด</span>
              <span>🟢 3-5: ปกติ</span>
              <span>🟡 6-10: เสี่ยงเริ่มต้น</span>
              <span>🟠 11-15: อันตราย</span>
              <span>🔴 16+: อันตรายมาก</span>
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', background: '#f8fafc', padding: '0.8rem', borderRadius: '10px', borderLeft: `4px solid ${visceralAnalysis.color}` }}>
              {visceralAnalysis.text}
            </p>
          </div>

          {/* 5. Water & Bone Mass */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            
            {/* Water % */}
            <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--dark)', lineHeight: '1.2' }}>
                    💧 น้ำในร่างกาย
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal', marginTop: '0.2rem' }}>(Water %)</span>
                  </h4>
                  <span style={{ backgroundColor: waterAnalysis.color, color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {waterAnalysis.status}
                  </span>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)' }}>{latestMetric.bodyWater} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>%</span></span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
                    เกณฑ์ปกติของเพศ{gender === 'male' ? 'ชาย' : 'หญิง'}: {gender === 'male' ? '50-65%' : '45-60%'}
                  </span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
                {waterAnalysis.text}
              </p>
            </div>

            {/* Bone Mass */}
            <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--dark)', lineHeight: '1.2' }}>
                    🦴 มวลกระดูก
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal', marginTop: '0.2rem' }}>(Bone Mass)</span>
                  </h4>
                  <span style={{ backgroundColor: boneAnalysis.color, color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {boneAnalysis.status}
                  </span>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)' }}>{latestMetric.boneMass} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>กก.</span></span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
                    เป้าหมายตามเกณฑ์น้ำหนักนี้: {boneAnalysis.target} กก.
                  </span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
                {boneAnalysis.text}
              </p>
            </div>

          </div>

          {/* 6. BMR & Body Age */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            
            {/* BMR */}
            <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--dark)', lineHeight: '1.2' }}>
                  🔥 อัตราการเผาผลาญ
                  <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal', marginTop: '0.2rem' }}>(BMR)</span>
                </h4>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)' }}>{latestMetric.metabolicRate} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>kcal</span></span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
                    ปริมาณพลังงานขั้นต่ำที่ร่างกายต้องการในแต่ละวัน
                  </span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
                เป็นพลังงานพื้นฐานที่ต้องการเพื่อรักษาระบบการทำงานพื้นฐานของร่างกายขณะพักผ่อน
              </p>
            </div>

            {/* Body Age */}
            <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--dark)', lineHeight: '1.2' }}>
                    🕐 อายุร่างกาย
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal', marginTop: '0.2rem' }}>(Body Age)</span>
                  </h4>
                  <span style={{ backgroundColor: ageAnalysis.color, color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {ageAnalysis.status}
                  </span>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)' }}>{latestMetric.bodyAge} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>ปี</span></span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
                    อายุจริงของร่างกาย: {actualAge} ปี
                  </span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
                {ageAnalysis.text}
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

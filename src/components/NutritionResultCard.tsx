import liff from '@line/liff';
import { useState } from 'react';
import SuccessPopup from './SuccessPopup';

type Goal = 'maintain' | 'lose' | 'build';

interface NutritionResultCardProps {
  bmr: number | '';
  goal: Goal;
  activityLevel: number;
  adjustment: number;
  tdee: number;
  targetCalories: number;
  macros: {
    pPercent: number;
    cPercent: number;
    fPercent: number;
    pGrams: number;
    cGrams: number;
    fGrams: number;
  };
  latestMetrics?: any;
  hideShareButton?: boolean;
  onShare?: () => Promise<void> | void;
}

export default function NutritionResultCard({
  bmr,
  goal,
  activityLevel,
  adjustment,
  tdee,
  targetCalories,
  macros,
  latestMetrics,
  hideShareButton = false,
  onShare
}: NutritionResultCardProps) {
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const goalText = goal === 'maintain' ? 'รักษามวลกล้ามเนื้อ' : goal === 'lose' ? 'ลดน้ำหนัก' : 'เพิ่มกล้ามเนื้อ';
  let activityText = 'ไม่ออกกำลังกายเลย';
  if (activityLevel === 1.375) activityText = 'ออกกำลังกาย 1-3 วัน/สัปดาห์';
  if (activityLevel === 1.55) activityText = 'ออกกำลังกาย 3-5 วัน/สัปดาห์';
  if (activityLevel === 1.725) activityText = 'ออกกำลังกาย 6-7 วัน/สัปดาห์';
  if (activityLevel === 1.9) activityText = 'ออกกำลังกายหนักมาก/นักกีฬา';

  const getBmiData = (weight?: number, height?: number) => {
    if (!weight || !height) return { text: '-', color: '#3b82f6' };
    const bmi = weight / ((height / 100) * (height / 100));
    const bmiStr = bmi.toFixed(1);
    
    if (bmi < 18.5) return { text: `${bmiStr} - น้ำหนักน้อย (Underweight)`, color: '#0ea5e9' };
    if (bmi < 25) return { text: `${bmiStr} - ปกติ (Normal Weight)`, color: '#84cc16' };
    if (bmi < 30) return { text: `${bmiStr} - อ้วนระดับ 1 (Class I Obesity)`, color: '#eab308' };
    if (bmi < 40) return { text: `${bmiStr} - อ้วนระดับ 2 (Class II Obesity)`, color: '#f97316' };
    return { text: `${bmiStr} - อ้วนระดับ 3 (Class III Obesity)`, color: '#ef4444' };
  };

  const bmiData = latestMetrics ? getBmiData(latestMetrics.weight, latestMetrics.height) : { text: '-', color: '#3b82f6' };
  const weight = latestMetrics?.weight;
  const waterIntake = weight ? Math.round(weight * 33) : null;
  
  // Calculate maximum recommended weight for Asians (BMI limit 22.9)
  const maxWeightLimit = (latestMetrics?.height)
    ? (22.9 * ((latestMetrics.height / 100) * (latestMetrics.height / 100))).toFixed(1)
    : null;

  const handleShare = async () => {
    try {
      if (onShare) {
        await onShare();
      }

      if (!liff.isApiAvailable('shareTargetPicker')) {
        alert('อุปกรณ์นี้ไม่รองรับการแชร์ข้อความผ่าน LINE');
        return;
      }
      
      const bodyContents: any[] = [
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: 'BMI', color: '#64748b', size: 'sm' },
            { type: 'text', text: bmiData.text, align: 'end', weight: 'bold', size: 'sm', color: bmiData.color }
          ]
        }
      ];

      if (maxWeightLimit) {
        bodyContents.push({
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: 'น้ำหนักที่ไม่ควรเกิน', color: '#64748b', size: 'sm' },
            { type: 'text', text: `${maxWeightLimit} kg`, align: 'end', weight: 'bold', size: 'sm', color: '#ef4444' }
          ]
        });
      }

      bodyContents.push(
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: 'เป้าหมาย', color: '#64748b', size: 'sm' },
            { type: 'text', text: goalText, align: 'end', weight: 'bold', size: 'sm' }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: 'แคลอรีเป้าหมาย', color: '#64748b', size: 'md' },
            { type: 'text', text: `${targetCalories.toLocaleString()} kcal`, align: 'end', weight: 'bold', color: '#3b82f6', size: 'md' }
          ]
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'lg',
          contents: [
            { type: 'text', text: '🥩 โปรตีน', size: 'sm', color: '#64748b' },
            { type: 'text', text: `${macros.pGrams} กรัม`, align: 'end', size: 'sm', weight: 'bold', color: '#be123c' }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: '🍚 คาร์โบไฮเดรต', size: 'sm', color: '#64748b' },
            { type: 'text', text: `${macros.cGrams} กรัม`, align: 'end', size: 'sm', weight: 'bold', color: '#15803d' }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: '🥑 ไขมัน', size: 'sm', color: '#64748b' },
            { type: 'text', text: `${macros.fGrams} กรัม`, align: 'end', size: 'sm', weight: 'bold', color: '#b45309' }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: '💧 ควรดื่มน้ำวันละ', size: 'sm', color: '#64748b' },
            { type: 'text', text: waterIntake ? `${waterIntake.toLocaleString()} ml` : '- ml', align: 'end', size: 'sm', weight: 'bold', color: '#0284c7' }
          ]
        }
      );

      if (latestMetrics) {
        bodyContents.push(
          { type: 'separator', margin: 'lg' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'lg',
            contents: [
              { type: 'text', text: '📊 สถิติร่างกายล่าสุด', weight: 'bold', size: 'md', color: '#6366f1' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'น้ำหนัก', color: '#64748b', size: 'sm' },
              { type: 'text', text: `${latestMetrics.weight || '-'} กก.`, align: 'end', weight: 'bold', size: 'sm', color: '#1e293b' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'text', text: 'ไขมัน', color: '#64748b', size: 'sm' },
              { type: 'text', text: `${latestMetrics.bodyFat || '-'} %`, align: 'end', weight: 'bold', size: 'sm', color: '#1e293b' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'text', text: 'มวลกล้ามเนื้อ', color: '#64748b', size: 'sm' },
              { type: 'text', text: `${latestMetrics.muscleMass || '-'} กก.`, align: 'end', weight: 'bold', size: 'sm', color: '#1e293b' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            ...(latestMetrics.visceralFat >= 7 ? { backgroundColor: '#fee2e2' } : latestMetrics.visceralFat >= 5 ? { backgroundColor: '#fef08a' } : {}),
            contents: [
              { type: 'text', text: 'ไขมันช่องท้อง', color: '#64748b', size: 'sm' },
              { type: 'text', text: `${latestMetrics.visceralFat || '-'}`, align: 'end', weight: 'bold', size: 'sm', color: '#1e293b' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            ...(latestMetrics.bodyAge && latestMetrics.age && latestMetrics.bodyAge > latestMetrics.age ? { backgroundColor: '#fee2e2' } : {}),
            contents: [
              { type: 'text', text: 'อายุเซลล์', color: '#64748b', size: 'sm' },
              { type: 'text', text: `${latestMetrics.bodyAge || '-'} ปี`, align: 'end', weight: 'bold', size: 'sm', color: '#1e293b' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            ...(latestMetrics.boneMass && latestMetrics.boneMass < 2 ? { backgroundColor: '#fee2e2' } : {}),
            contents: [
              { type: 'text', text: 'มวลกระดูก', color: '#64748b', size: 'sm' },
              { type: 'text', text: `${latestMetrics.boneMass || '-'} กก.`, align: 'end', weight: 'bold', size: 'sm', color: '#1e293b' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            ...(latestMetrics.bodyWater && latestMetrics.bodyWater < 50 ? { backgroundColor: '#fee2e2' } : {}),
            contents: [
              { type: 'text', text: 'น้ำในร่างกาย', color: '#64748b', size: 'sm' },
              { type: 'text', text: `${latestMetrics.bodyWater || '-'} %`, align: 'end', weight: 'bold', size: 'sm', color: '#1e293b' }
            ]
          }
        );
      }

      const flexMsg = {
        type: 'flex',
        altText: 'คำแนะนำโภชนาการและสถิติร่างกายของคุณ',
        contents: {
          type: 'bubble',
          size: 'mega',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '🎯 คำแนะนำโภชนาการ', weight: 'bold', size: 'xl', color: '#10b981' },
              { type: 'text', text: 'สู้ๆ เพื่อเป้าหมายของคุณ! 💪', size: 'sm', color: '#94a3b8', margin: 'md' }
            ],
            backgroundColor: '#f8fafc'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: bodyContents
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                style: 'primary',
                color: '#FF416C',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: 'ดูรายละเอียด',
                  uri: 'https://liff.line.me/2010284484-HzKokXFF'
                }
              }
            ]
          }
        }
      };

      const res = await liff.shareTargetPicker([flexMsg as any]);
      if (res) {
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 2000);
      }
    } catch (error) {
      console.error('Error sharing:', error);
      alert('เกิดข้อผิดพลาดในการแชร์');
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '16px', padding: '1.2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
      {/* Summary Details */}
      <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>BMI:</span>
          <span style={{ fontWeight: 'bold', color: bmiData.color, textAlign: 'right' }}>{bmiData.text}</span>
        </div>
        {maxWeightLimit && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>น้ำหนักตัวที่ไม่ควรเกิน:</span>
            <span style={{ fontWeight: 'bold', color: '#ef4444', textAlign: 'right' }}>{maxWeightLimit} kg</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>BMR:</span>
          <span style={{ fontWeight: 'bold', color: '#10b981' }}>{bmr ? Number(bmr).toLocaleString() : '-'} kcal</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>เป้าหมาย:</span>
          <span style={{ fontWeight: '500' }}>{goalText}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>กิจกรรม:</span>
          <span style={{ fontWeight: '500' }}>{activityText}</span>
        </div>
        {(goal === 'lose' || goal === 'build') && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>พลังงานที่{goal === 'lose' ? 'ลด' : 'เพิ่ม'}:</span>
            <span style={{ fontWeight: '500', color: goal === 'lose' ? '#ef4444' : '#10b981' }}>{goal === 'lose' ? '-' : '+'}{adjustment} kcal</span>
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <div style={{ flex: 1, background: '#f8fafc', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>TDEE</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#475569' }}>{tdee.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>kcal</div>
        </div>
        
        <div style={{ flex: 1.2, background: 'var(--primary)', color: '#fff', padding: '1rem', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '0.3rem' }}>แคลอรีเป้าหมาย</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold' }}>{targetCalories.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>kcal/วัน</div>
        </div>
      </div>

      <h4 style={{ marginBottom: '0.8rem', color: 'var(--text-main)', fontSize: '0.95rem' }}>สัดส่วนสารอาหารหลัก</h4>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        {/* Protein */}
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '0.8rem 0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>🥩</div>
          <div style={{ fontWeight: 'bold', color: '#be123c', fontSize: '0.8rem' }}>โปรตีน {macros.pPercent}%</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0.3rem 0', color: '#9f1239' }}>{macros.pGrams}</div>
          <div style={{ fontSize: '0.7rem', color: '#e11d48' }}>กรัม</div>
        </div>

        {/* Carbs */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.8rem 0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>🍚</div>
          <div style={{ fontWeight: 'bold', color: '#15803d', fontSize: '0.8rem' }}>คาร์บ {macros.cPercent}%</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0.3rem 0', color: '#166534' }}>{macros.cGrams}</div>
          <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>กรัม</div>
        </div>

        {/* Fats */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '0.8rem 0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>🥑</div>
          <div style={{ fontWeight: 'bold', color: '#b45309', fontSize: '0.8rem' }}>ไขมัน {macros.fPercent}%</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0.3rem 0', color: '#92400e' }}>{macros.fGrams}</div>
          <div style={{ fontSize: '0.7rem', color: '#d97706' }}>กรัม</div>
        </div>
      </div>

      {/* Water Recommendation Card */}
      <div style={{ 
        marginTop: '1rem',
        background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)',
        border: '1px solid #bae6fd',
        borderRadius: '12px',
        padding: '0.8rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 4px rgba(2, 132, 199, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.6rem' }}>💧</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 'bold', color: '#0369a1', fontSize: '0.85rem' }}>ควรดื่มน้ำวันละ</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#0369a1' }}>
            {waterIntake ? waterIntake.toLocaleString() : '-'}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#0284c7', marginLeft: '4px', fontWeight: 'bold' }}>ml</span>
        </div>
      </div>

      {/* LINE Share Button */}
      {!hideShareButton && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button 
            onClick={handleShare}
            className="btn-primary animate-fade-in-up"
            style={{ 
              background: '#06C755', 
              border: 'none', 
              boxShadow: '0 4px 15px rgba(6, 199, 85, 0.4)',
              width: '100%',
              maxWidth: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              margin: '0 auto',
              fontWeight: 'bold',
              fontSize: '1rem',
              padding: '0.8rem',
              borderRadius: '12px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>💬</span>
            แชร์ผลลัพธ์ผ่าน LINE
          </button>
        </div>
      )}
      <SuccessPopup show={showSuccessPopup} message="แชร์ข้อความเรียบร้อยแล้ว" />
    </div>
  );
}

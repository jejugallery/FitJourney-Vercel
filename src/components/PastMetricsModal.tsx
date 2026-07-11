import React, { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useLiff } from '../context/LiffContext';

export default function PastMetricsModal({ 
  traineeData, 
  traineeId,
  traineeName,
  onClose,
  onSuccess
}: { 
  traineeData: any;
  traineeId: string;
  traineeName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { profile } = useLiff();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const [formData, setFormData] = useState({
    age: '',
    height: '',
    weight: '',
    bodyFat: '',
    muscleMass: '',
    metabolicRate: '',
    boneMass: '',
    bodyWater: '',
    visceralFat: '',
    bodyAge: '',
  });

  useEffect(() => {
    // Initial height from db
    if (traineeData?.height) {
      setFormData(prev => ({ ...prev, height: traineeData.height.toString() }));
    }
  }, [traineeData]);

  useEffect(() => {
    if (selectedDate) {
      // Calculate age based on selected date
      let newAge = '';
      if (traineeData?.dob) {
        const birthDate = new Date(traineeData.dob);
        const targetDate = new Date(selectedDate);
        let age = targetDate.getFullYear() - birthDate.getFullYear();
        const m = targetDate.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && targetDate.getDate() < birthDate.getDate())) {
          age--;
        }
        if (age > 0) newAge = age.toString();
      } else if (traineeData?.age) {
        newAge = traineeData.age.toString();
      }
      setFormData(prev => ({ ...prev, age: newAge }));
    }
  }, [selectedDate, traineeData]);

  // Handle body overflow for modal
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isFormValid = selectedDate && Object.values(formData).every(val => val.toString().trim() !== '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setLoading(true);

    try {
      // Create a date object with the selected date at noon to avoid timezone issues
      const dateParts = selectedDate.split('-');
      const targetDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]), 12, 0, 0);
      const selectedTimestamp = Timestamp.fromDate(targetDate);

      await addDoc(collection(db, 'bodyMetrics'), {
        ...formData,
        name: traineeName,
        advisor: profile?.displayName || 'Unknown',
        trainerId: profile?.userId || 'Unknown',
        traineeId: traineeId,
        province: traineeData?.province || '',
        address: traineeData?.zone || '',
        age: Number(formData.age),
        height: Number(formData.height),
        weight: Number(formData.weight),
        bodyFat: Number(formData.bodyFat),
        muscleMass: Number(formData.muscleMass),
        metabolicRate: Number(formData.metabolicRate),
        boneMass: Number(formData.boneMass),
        bodyWater: Number(formData.bodyWater),
        visceralFat: Number(formData.visceralFat),
        bodyAge: Number(formData.bodyAge),
        createdAt: selectedTimestamp,
      });
      onSuccess();
    } catch (error) {
      console.error('Error adding document: ', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem', paddingTop: '4rem', overflowY: 'auto' }}>
      <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '500px', position: 'relative', marginBottom: '2rem', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <button onClick={onClose} type="button" style={{ position: 'absolute', top: '15px', right: '15px', background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>&times;</button>
        
        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.4rem' }}>บันทึกค่าร่างกายย้อนหลัง</h3>

        {/* Profile Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          {traineeData?.pictureUrl || profile?.pictureUrl ? (
            <img src={traineeData?.pictureUrl || profile?.pictureUrl} alt="Profile" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
          ) : (
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.5rem' }}>👤</div>
          )}
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ลูกเทรน</div>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>{traineeName || profile?.displayName}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="metrics-form">
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 'bold', color: 'var(--primary)' }}>วันที่วัดค่า</label>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group"></div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>อายุ (ปี)</label>
              <input type="number" name="age" value={formData.age} onChange={handleChange} required min="1" max="120" placeholder="เช่น 25" />
            </div>
            <div className="form-group">
              <label>ส่วนสูง (ซม.)</label>
              <input type="number" name="height" value={formData.height} onChange={handleChange} required step="0.1" placeholder="เช่น 170" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>น้ำหนัก (กก.)</label>
              <input type="number" name="weight" value={formData.weight} onChange={handleChange} required step="0.1" placeholder="เช่น 65.5" />
            </div>
            <div className="form-group">
              <label>เปอร์เซ็นต์ไขมัน (%)</label>
              <input type="number" name="bodyFat" value={formData.bodyFat} onChange={handleChange} required step="0.1" placeholder="เช่น 20.5" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>มวลกระดูก (กก.)</label>
              <input type="number" name="boneMass" value={formData.boneMass} onChange={handleChange} required step="0.1" placeholder="เช่น 2.5" />
            </div>
            <div className="form-group">
              <label>น้ำในร่างกาย (%)</label>
              <input type="number" name="bodyWater" value={formData.bodyWater} onChange={handleChange} required step="0.1" placeholder="เช่น 55" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>มวลกล้ามเนื้อ (กก.)</label>
              <input type="number" name="muscleMass" value={formData.muscleMass} onChange={handleChange} required step="0.1" placeholder="เช่น 50" />
            </div>
            <div className="form-group">
              <label>อัตราการเผาผลาญ (kcal)</label>
              <input type="number" name="metabolicRate" value={formData.metabolicRate} onChange={handleChange} required placeholder="เช่น 1500" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>อายุเซลล์ (Body Age)</label>
              <input type="number" name="bodyAge" value={formData.bodyAge} onChange={handleChange} required placeholder="เช่น 25" />
            </div>
            <div className="form-group">
              <label>ระดับไขมันในช่องท้อง</label>
              <input type="number" name="visceralFat" value={formData.visceralFat} onChange={handleChange} required step="0.1" placeholder="เช่น 5" />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading || !isFormValid} style={{ marginTop: '1rem', width: '100%' }}>
            {loading ? 'กำลังบันทึกข้อมูล...' : 'บันทึกข้อมูลย้อนหลัง'}
          </button>
        </form>
      </div>
    </div>
  );
}

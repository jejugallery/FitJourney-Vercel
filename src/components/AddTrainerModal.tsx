import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, arrayUnion, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLiff } from '../context/LiffContext';

interface AddTrainerModalProps {
  traineeId: string;
  currentTrainerIds?: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddTrainerModal({ traineeId, currentTrainerIds = [], onClose, onSuccess }: AddTrainerModalProps) {
  const { profile } = useLiff();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  const [trainerCode, setTrainerCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [trainerInfo, setTrainerInfo] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (trainerCode.length !== 5) {
      setError('กรุณากรอกรหัสเทรนเนอร์ 5 หลัก');
      return;
    }
    setError('');
    setLoading(true);
    setTrainerInfo(null);

    try {
      const q = query(
        collection(db, 'trainers'), 
        where('trainerCode', '==', trainerCode),
        where('status', 'in', ['อนุมัติ', 'superadmin'])
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setError('ไม่พบเทรนเนอร์รหัสนี้ หรือยังไม่ได้รับการอนุมัติ');
      } else {
        const foundData = snap.docs[0].data();
        if (profile?.userId && foundData.trainerId === profile.userId) {
          setError('ไม่สามารถเพิ่มตัวเองเป็นเทรนเนอร์ได้');
        } else {
          setTrainerInfo(foundData);
        }
      }
    } catch (err) {
      console.error('Error searching trainer:', err);
      setError('เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTrainer = async () => {
    if (!trainerInfo || !trainerInfo.trainerId) return;
    
    setLoading(true);
    try {
      // Find trainee document
      const tQuery = query(collection(db, 'trainees'), where('userId', '==', traineeId));
      const tSnap = await getDocs(tQuery);
      
      if (!tSnap.empty) {
        const docRef = doc(db, 'trainees', tSnap.docs[0].id);
        await updateDoc(docRef, {
          trainerIds: arrayUnion(trainerInfo.trainerId)
        });
        
        // Also update existing bodyMetrics or foodLogs if necessary? 
        // Typically, we only update the trainee document. The queries should look at trainees collection or trainee's metrics.
        // Wait, bodyMetrics and foodLogs also store trainerId currently. 
        // We'll migrate those to use traineeId or trainerIds array.

        onSuccess();
      } else {
        setError('ไม่พบข้อมูลบัญชีลูกเทรนของคุณ');
      }
    } catch (err) {
      console.error('Error adding trainer:', err);
      setError('เกิดข้อผิดพลาดในการเพิ่มเทรนเนอร์');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '1.5rem',
        width: '100%', maxWidth: '400px', position: 'relative'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer',
            color: 'var(--text-muted)'
          }}
        >
          &times;
        </button>
        
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem', textAlign: 'center' }}>เลือกเทรนเนอร์</h3>

        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#64748b', marginBottom: '1.2rem', marginTop: 0 }}>
          กรุณากรอกรหัสเทรนเนอร์ 5 หลัก แล้วกดปุ่มค้นหา
        </p>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'none' }}>
            รหัสเทรนเนอร์ 5 หลัก
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              maxLength={5}
              value={trainerCode}
              onChange={(e) => setTrainerCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="กรอกเลข 5 หลัก"
              style={{
                width: '180px', flex: 'none', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                fontSize: '1rem', textAlign: 'center', letterSpacing: '1px'
              }}
            />
            <button 
              onClick={handleSearch}
              disabled={loading || trainerCode.length !== 5}
              className="btn-secondary"
              style={{ whiteSpace: 'nowrap', padding: '0 1.5rem', flex: 'none' }}
            >
              {loading ? 'ค้นหา...' : '🔍 ค้นหา'}
            </button>
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</p>}
        </div>

        {trainerInfo && (
          <div style={{ 
            marginTop: '1rem', padding: '1.2rem', border: '1px solid #e2e8f0', borderRadius: '16px', 
            display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ flexShrink: 0 }}>
              {trainerInfo.pictureUrl ? (
                <img 
                  src={trainerInfo.pictureUrl} 
                  alt="Trainer Profile" 
                  style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }}
                />
              ) : (
                <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#cbd5e1', border: '3px solid var(--primary)' }} />
              )}
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                {trainerInfo.nickname || trainerInfo.displayName}
              </div>
            
              {currentTrainerIds.includes(trainerInfo.trainerId) ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.5rem 0.75rem', borderRadius: '8px',
                  background: '#f0fdf4', border: '1px solid #86efac',
                  color: '#16a34a', fontSize: '0.82rem', fontWeight: '600'
                }}>
                  <span>✅</span>
                  <span>เทรนเนอร์ท่านนี้ดูแลท่านอยู่ในปัจจุบัน</span>
                </div>
              ) : (
                <button 
                  onClick={handleAddTrainer}
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', fontSize: '0.95rem' }}
                >
                  {loading ? 'กำลังเลือก...' : 'เลือก'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLiff } from '../context/LiffContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';

const THAI_PROVINCES = [
  "กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร",
  "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท",
  "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง",
  "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม",
  "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส",
  "น่าน", "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์",
  "ปราจีนบุรี", "ปัตตานี", "พระนครศรีอยุธยา", "พะเยา", "พังงา",
  "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์",
  "แพร่", "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน",
  "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง",
  "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน", "เลย",
  "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ",
  "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี",
  "สุโขทัย", "สุพรรณบุรี", "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย",
  "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์",
  "อุทัยธานี", "อุบลราชธานี"
];

export default function RegisterAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill;

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [existingDocId, setExistingDocId] = useState<string | null>(null);
  
  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'available' | 'duplicate' | 'invalid' | 'invalid_repeating'>('idle');

  const [formData, setFormData] = useState({
    trainerCode: '',
    gender: prefill?.gender || 'male',
    dob: prefill?.dob || '',
    height: prefill?.height ? prefill.height.toString() : '',
    province: prefill?.province || '',
    zone: prefill?.zone || '',
    phone: prefill?.phone || ''
  });

  const { profile, loading, error: liffError } = useLiff();



  const handleDeleteAndRegister = async () => {
    if (existingDocId) {
      try {
        await deleteDoc(doc(db, 'trainers', existingDocId));
      } catch (err) {
        console.error('Error deleting rejected trainer:', err);
      }
    }
    navigate('/register-trainee');
  };

  useEffect(() => {
    const checkCode = async () => {
      const code = formData.trainerCode;
      if (!code || code.length !== 5) {
        setCodeStatus(code ? 'invalid' : 'idle');
        return;
      }
      
      if (/^(\d)\1{4}$/.test(code)) {
        setCodeStatus('invalid_repeating');
        return;
      }
      
      setCodeStatus('checking');
      try {
        const q = query(collection(db, 'trainers'), where('trainerCode', '==', code));
        const snap = await getDocs(q);
        if (snap.empty) {
          setCodeStatus('available');
        } else {
          setCodeStatus('duplicate');
        }
      } catch (err) {
        console.error(err);
        setCodeStatus('idle');
      }
    };
    
    const timer = setTimeout(() => {
      checkCode();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [formData.trainerCode]);

  useEffect(() => {
    const checkExistingRegistration = async () => {
      if (!profile) return;
      
      try {
        const q = query(collection(db, 'trainers'), where('trainerId', '==', profile.userId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          const data = docSnap.data();
          setExistingStatus(data.status || 'รออนุมัติ');
          setExistingDocId(docSnap.id);
        }
      } catch (err) {
        console.error("Error checking existing registration:", err);
      } finally {
        setCheckingStatus(false);
      }
    };

    if (profile) {
      checkExistingRegistration();
    } else if (!loading) {
      setCheckingStatus(false);
    }
  }, [profile, loading]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isFormValid = formData.dob.trim() !== '' && 
                      formData.height.trim() !== '' && 
                      formData.province.trim() !== '' && 
                      formData.zone.trim() !== '' && 
                      formData.phone.trim() !== '' && 
                      codeStatus === 'available';

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile) return;
    
    setSubmitting(true);
    setError(null);

    try {
      await addDoc(collection(db, 'trainers'), {
        trainerId: profile.userId,
        nickname: profile.displayName,
        pictureUrl: profile.pictureUrl || '',
        status: "รออนุมัติ",
        trainerCode: formData.trainerCode,
        gender: formData.gender,
        dob: formData.dob,
        height: Number(formData.height),
        province: formData.province,
        zone: formData.zone,
        phone: formData.phone,
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
    } catch (err) {
      console.error("Register Error:", err);
      setError("เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || checkingStatus) {
    return (
      <div className="form-container" style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>กำลังโหลด...</h2>
        <p className="subtitle">กรุณารอสักครู่ ระบบกำลังตรวจสอบข้อมูล</p>
      </div>
    );
  }

  if (liffError) {
    return (
      <div className="form-container" style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>เกิดข้อผิดพลาด</h2>
        <p className="subtitle">{liffError}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>กลับหน้าหลัก</button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="form-container success-container animate-fade-in-up" style={{ marginTop: '100px' }}>
        <div className="success-icon">⏳</div>
        <h2>ลงทะเบียนสำเร็จ!</h2>
        <p>สถานะของคุณตอนนี้คือ: <strong>รออนุมัติ</strong></p>
        <p>กรุณารอการอนุมัติสิทธิ์การใช้งานของคุณ</p>
        <button className="btn-secondary mt-4" onClick={() => navigate('/')}>กลับหน้าหลัก</button>
      </div>
    );
  }

  return (
    <>
      <Navbar />

      <div className="form-container animate-fade-in-up" style={{ marginTop: '120px' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>ลงทะเบียนเทรนเนอร์</h2>
        
        {error ? (
          <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '12px', marginBottom: '1.5rem' }}>
            {error}
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>ข้อมูลจากบัญชี LINE ของคุณ:</p>
            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', minWidth: '250px' }}>
              {profile?.pictureUrl && (
                <img 
                  src={profile.pictureUrl} 
                  alt="Profile" 
                  style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '1rem', border: '3px solid var(--primary)' }}
                />
              )}
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{profile?.displayName}</h3>
            </div>
          </div>
        )}

        {existingStatus ? (
          <div style={{ 
            textAlign: 'center', 
            marginTop: '1rem', 
            padding: '1.5rem', 
            background: existingStatus === 'ไม่อนุมัติ' ? '#fee2e2' : (existingStatus === 'รออนุมัติ' ? '#fef9c3' : '#dcfce7'), 
            borderRadius: '12px',
            border: `2px solid ${existingStatus === 'ไม่อนุมัติ' ? '#ef4444' : (existingStatus === 'รออนุมัติ' ? '#facc15' : '#4ade80')}`
          }}>
            <h3 style={{ 
              color: existingStatus === 'ไม่อนุมัติ' ? '#b91c1c' : (existingStatus === 'รออนุมัติ' ? '#854d0e' : '#166534'), 
              marginBottom: '0.5rem' 
            }}>
              คุณได้ลงทะเบียนไปแล้ว
            </h3>
            <p style={{ 
              fontSize: '1.1rem', 
              color: existingStatus === 'ไม่อนุมัติ' ? '#b91c1c' : (existingStatus === 'รออนุมัติ' ? '#a16207' : '#15803d'),
              marginBottom: (existingStatus === 'ไม่อนุมัติ' || existingStatus === 'รออนุมัติ') ? '1.5rem' : '0'
            }}>
              สถานะปัจจุบัน: <strong>{existingStatus}</strong>
            </p>
            {(existingStatus === 'อนุมัติ' || existingStatus === 'รออนุมัติ') && (
              <button className="btn-secondary" onClick={() => navigate('/')} style={{ marginTop: '1.2rem' }}>
                กลับหน้าหลัก
              </button>
            )}
            {existingStatus === 'ไม่อนุมัติ' && (
              <button className="btn-primary" onClick={handleDeleteAndRegister}>
                ลงทะเบียนลูกเทรน
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleRegister} className="metrics-form">
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>เลขประจำตัวเทรนเนอร์ (5 หลัก)</label>
              <input 
                type="text" 
                name="trainerCode" 
                value={formData.trainerCode} 
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                  setFormData(prev => ({ ...prev, trainerCode: val }));
                }} 
                required 
                placeholder="เช่น 12345" 
                style={{ 
                  borderColor: codeStatus === 'duplicate' ? '#ef4444' : codeStatus === 'available' ? '#22c55e' : undefined 
                }}
              />
              {codeStatus === 'checking' && <small style={{ color: '#64748b', display: 'block', marginTop: '0.4rem' }}>กำลังตรวจสอบ...</small>}
              {codeStatus === 'duplicate' && <small style={{ color: '#ef4444', display: 'block', marginTop: '0.4rem' }}>เลขประจำตัวนี้ถูกใช้งานแล้ว</small>}
              {codeStatus === 'available' && <small style={{ color: '#22c55e', display: 'block', marginTop: '0.4rem' }}>✔️ ใช้งานได้</small>}
              {codeStatus === 'invalid' && formData.trainerCode.length > 0 && <small style={{ color: '#ef4444', display: 'block', marginTop: '0.4rem' }}>กรุณากรอกให้ครบ 5 หลัก</small>}
              {codeStatus === 'invalid_repeating' && <small style={{ color: '#ef4444', display: 'block', marginTop: '0.4rem' }}>ไม่อนุญาตให้ใช้เลขซ้ำกันทั้ง 5 หลัก</small>}
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: '1' }}>
                <label>เพศ</label>
                <select name="gender" value={formData.gender} onChange={(e: any) => handleChange(e)} required style={{ padding: '0.6rem' }}>
                  <option value="male">ชาย</option>
                  <option value="female">หญิง</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: '1' }}>
                <label>ส่วนสูง (ซม.)</label>
                <input type="number" name="height" value={formData.height} onChange={handleChange} required step="0.1" placeholder="เช่น 170" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: '1', marginBottom: '1.5rem' }}>
                <label>วันเกิด</label>
                <input type="date" name="dob" value={formData.dob} onChange={handleChange} required max={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="form-group" style={{ flex: '1', marginBottom: '1.5rem' }}>
                <label>เบอร์โทรศัพท์</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required placeholder="เช่น 0812345678" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: '1' }}>
                <label>จังหวัด</label>
                <input 
                  type="text" 
                  name="province" 
                  value={formData.province} 
                  onChange={handleChange} 
                  required 
                  placeholder="จังหวัดที่พักอาศัยในปัจจุบัน" 
                  list="province-list"
                  autoComplete="off"
                />
                <datalist id="province-list">
                  {THAI_PROVINCES.map(prov => (
                    <option key={prov} value={prov} />
                  ))}
                </datalist>
              </div>
              <div className="form-group" style={{ flex: '1' }}>
                <label>โลเคชั่นที่อยู่ปัจจุบัน</label>
                <input type="text" name="zone" value={formData.zone} onChange={handleChange} required placeholder="อำเภอ/เขต โลเคชั่นที่อยู่ปัจจุบัน" />
              </div>
            </div>

            <button 
              type="submit"
              className="btn-primary" 
              disabled={submitting || !profile || !isFormValid}
              style={{ width: '100%' }}
            >
              {submitting ? 'กำลังลงทะเบียน...' : 'ยืนยันลงทะเบียนเทรนเนอร์'}
            </button>
          </form>
        )}
      </div>
    </>
  );
}

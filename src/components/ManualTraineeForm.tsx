import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

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

interface ManualTraineeFormProps {
  trainerId: string;

  onSuccess: (traineeNickname: string, weight: string, height: string, age: string) => void;
  onCancel: () => void;
}

export default function ManualTraineeForm({ trainerId, onSuccess, onCancel }: ManualTraineeFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nickname: '',
    gender: 'male',
    age: '',
    weight: '',
    height: '',
    province: '',
    zone: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isFormValid = formData.nickname.trim() !== '' &&
                      formData.age.trim() !== '' && 
                      formData.weight.trim() !== '' && 
                      formData.height.trim() !== '' && 
                      formData.province.trim() !== '' && 
                      formData.zone.trim() !== '';

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const generatedUserId = `manual_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    try {
      await addDoc(collection(db, 'trainees'), {
        userId: generatedUserId,
        lineName: formData.nickname,
        nickname: formData.nickname,
        pictureUrl: '', // Default avatar will be used
        gender: formData.gender,
        age: Number(formData.age),
        weight: Number(formData.weight),
        height: Number(formData.height),
        province: formData.province,
        zone: formData.zone,
        trainerIds: [trainerId],
        createdAt: serverTimestamp(),
      });

      onSuccess(formData.nickname, formData.weight, formData.height, formData.age);
    } catch (err) {
      console.error("Register Error:", err);
      setError("เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '1rem',
      overflowY: 'auto'
    }}>
      <div className="form-container animate-fade-in-up" style={{ width: '100%', maxWidth: '600px', margin: 'auto', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>ลูกเทรนแบบกำหนดเอง</h2>
          <button 
            type="button" 
            onClick={onCancel}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>
        
        {error && (
          <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '12px', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="metrics-form">
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label>ชื่อลูกเทรน</label>
            <input type="text" name="nickname" value={formData.nickname} onChange={handleChange} required placeholder="กรอกชื่อลูกเทรน" />
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: '1' }}>
              <label>เพศ</label>
              <select name="gender" value={formData.gender} onChange={handleChange} required style={{ padding: '0.6rem' }}>
                <option value="male">ชาย</option>
                <option value="female">หญิง</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: '1' }}>
              <label>อายุ (ปี)</label>
              <input type="number" name="age" value={formData.age} onChange={handleChange} required placeholder="เช่น 25" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: '1' }}>
              <label>น้ำหนัก (กก.)</label>
              <input type="number" name="weight" value={formData.weight} onChange={handleChange} required step="0.1" placeholder="เช่น 60" />
            </div>
            <div className="form-group" style={{ flex: '1' }}>
              <label>ส่วนสูง (ซม.)</label>
              <input type="number" name="height" value={formData.height} onChange={handleChange} required step="0.1" placeholder="เช่น 170" />
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
                list="manual-province-list"
                autoComplete="off"
              />
              <datalist id="manual-province-list">
                {THAI_PROVINCES.map(prov => (
                  <option key={prov} value={prov} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label>โลเคชั่นที่อยู่ปัจจุบัน</label>
              <input type="text" name="zone" value={formData.zone} onChange={handleChange} required placeholder="อำเภอ/เขต โลเคชั่นที่อยู่ปัจจุบัน" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button 
              type="button"
              className="btn-secondary" 
              onClick={onCancel}
              style={{ padding: '0.5rem 1.2rem', fontSize: '0.9rem', borderRadius: '50px', width: '140px', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ยกเลิก
            </button>
            <button 
              type="submit"
              className="btn-primary" 
              disabled={submitting || !isFormValid}
              style={{ padding: '0.5rem 1.2rem', fontSize: '0.9rem', borderRadius: '50px', width: '140px', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {submitting ? 'กำลังสร้าง...' : 'สร้างลูกเทรน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

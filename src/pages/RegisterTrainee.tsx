import { useEffect, useState } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useLiff } from '../context/LiffContext';
import Navbar from '../components/Navbar';
import liff from '@line/liff';
import { useNavigate } from 'react-router-dom';

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

export default function RegisterTrainee() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingExistingUser, setCheckingExistingUser] = useState(true);
  
  const [searchCode, setSearchCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundTrainer, setFoundTrainer] = useState<any | null>(null);
  const [searchError, setSearchError] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState<any | null>(null);

  const { profile } = useLiff();

  useEffect(() => {
    if (!profile) return;

    let cancelled = false;

    const redirectIfAlreadyRegistered = async () => {
      setCheckingExistingUser(true);

      try {
        const traineeQ = query(collection(db, 'trainees'), where('userId', '==', profile.userId));
        const trainerQ = query(collection(db, 'trainers'), where('trainerId', '==', profile.userId));
        const [traineeSnap, trainerSnap] = await Promise.all([getDocs(traineeQ), getDocs(trainerQ)]);

        if (cancelled) return;

        if (!traineeSnap.empty || !trainerSnap.empty) {
          navigate('/', { replace: true });
          return;
        }
      } catch (err) {
        console.error('Error checking existing registration:', err);
      } finally {
        if (!cancelled) {
          setCheckingExistingUser(false);
        }
      }
    };

    redirectIfAlreadyRegistered();

    return () => {
      cancelled = true;
    };
  }, [profile, navigate]);

  const findTrainerByCode = async (code: string) => {
    const q = query(collection(db, 'trainers'), where('trainerCode', '==', code), where('status', 'in', ['อนุมัติ', 'superadmin']));
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const data = snap.docs[0].data();
    return {
      id: snap.docs[0].id,
      trainerId: data.trainerId || snap.docs[0].id,
      displayName: data.nickname || data.displayName || 'Unknown',
      pictureUrl: data.pictureUrl,
      trainerCode: data.trainerCode
    };
  };

  const getInviteTrainerCode = () => {
    const params = new URLSearchParams(window.location.search);
    const directCode = params.get('trainerCode');
    if (directCode) return directCode.replace(/\D/g, '').slice(0, 5);

    const liffState = params.get('liff.state');
    if (!liffState) return '';

    try {
      const decodedState = decodeURIComponent(liffState);
      const stateParams = new URLSearchParams(decodedState.startsWith('?') ? decodedState : `?${decodedState.split('?')[1] || decodedState}`);
      return (stateParams.get('trainerCode') || '').replace(/\D/g, '').slice(0, 5);
    } catch {
      return '';
    }
  };

  useEffect(() => {
    const inviteTrainerCode = getInviteTrainerCode();
    if (inviteTrainerCode.length !== 5) return;

    let cancelled = false;

    const selectInvitedTrainer = async () => {
      setSearchCode(inviteTrainerCode);
      setSearching(true);
      setSearchError('');
      setFoundTrainer(null);

      try {
        const trainer = await findTrainerByCode(inviteTrainerCode);
        if (cancelled) return;

        if (trainer) {
          setSelectedTrainer(trainer);
        } else {
          setSearchError('ไม่พบเทรนเนอร์จากรหัสในคำเชิญ หรือยังไม่ได้รับการอนุมัติ');
        }
      } catch (err) {
        if (!cancelled) {
          setSearchError('เกิดข้อผิดพลาดในการค้นหาเทรนเนอร์จากคำเชิญ');
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    };

    selectInvitedTrainer();

    return () => {
      cancelled = true;
    };
  }, []);

  const [formData, setFormData] = useState({
    gender: 'male',
    dob: '',
    height: '',
    province: '',
    zone: '',
    phone: ''
  });

  const handleSearch = async () => {
    if (searchCode.length !== 5) {
      setSearchError('กรุณากรอกเลข 5 หลัก');
      return;
    }
    setSearching(true);
    setSearchError('');
    setFoundTrainer(null);
    try {
      const trainer = await findTrainerByCode(searchCode);
      if (trainer) {
        setFoundTrainer(trainer);
      } else {
        setSearchError('ไม่พบเทรนเนอร์รหัสนี้ หรือยังไม่ได้รับการอนุมัติ');
      }
    } catch (err) {
      setSearchError('เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      setSearching(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isFormValid = formData.dob.trim() !== '' && 
                      formData.height.trim() !== '' && 
                      formData.province.trim() !== '' && 
                      formData.zone.trim() !== '' && 
                      formData.phone.trim() !== '' && 
                      selectedTrainer !== null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setSubmitting(true);
    setError(null);

    if (!selectedTrainer) {
      setError("กรุณาค้นหาและเลือกเทรนเนอร์ด้วยเลขประจำตัวเทรนเนอร์");
      setSubmitting(false);
      return;
    }

    try {
      const traineeQ = query(collection(db, 'trainees'), where('userId', '==', profile.userId));
      const trainerQ = query(collection(db, 'trainers'), where('trainerId', '==', profile.userId));
      const [traineeSnap, trainerSnap] = await Promise.all([getDocs(traineeQ), getDocs(trainerQ)]);

      if (!traineeSnap.empty || !trainerSnap.empty) {
        navigate('/', { replace: true });
        return;
      }

      await addDoc(collection(db, 'trainees'), {
        userId: profile.userId,
        nickname: profile.displayName,
        pictureUrl: profile.pictureUrl || '',
        gender: formData.gender,
        dob: formData.dob,
        height: Number(formData.height),
        province: formData.province,
        zone: formData.zone,
        phone: formData.phone,
        trainerIds: [selectedTrainer.trainerId],
        createdAt: serverTimestamp(),
      });

      // Send Flex Message
      if (liff.isInClient()) {
        try {
          await liff.sendMessages([
            {
              type: "flex",
              altText: "ลงทะเบียนสำเร็จ!",
              contents: {
                type: "bubble",
                body: {
                  type: "box",
                  layout: "vertical",
                  contents: [
                    {
                      type: "text",
                      text: "🎉 ลงทะเบียนสำเร็จ!",
                      weight: "bold",
                      color: "#1DB446",
                      size: "xl"
                    },
                    {
                      type: "text",
                      text: "ยินดีต้อนรับสู่ FitJourney.th",
                      size: "sm",
                      color: "#999999",
                      margin: "sm"
                    },
                    {
                      type: "box",
                      layout: "vertical",
                      margin: "lg",
                      spacing: "sm",
                      contents: [
                        {
                          type: "text",
                          text: "เทรนเนอร์ของคุณคือ:",
                          size: "sm",
                          color: "#555555"
                        },
                        {
                          type: "box",
                          layout: "horizontal",
                          margin: "md",
                          spacing: "md",
                          alignItems: "center",
                          contents: [
                            {
                              type: "image",
                              url: selectedTrainer.pictureUrl || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png",
                              flex: 0,
                              size: "40px",
                              aspectRatio: "1:1",
                              aspectMode: "cover"
                            },
                            {
                              type: "text",
                              text: selectedTrainer.displayName,
                              weight: "bold",
                              size: "md",
                              color: "#333333"
                            }
                          ]
                        }
                      ]
                    },
                    {
                      type: "button",
                      style: "primary",
                      color: "#FF416C",
                      margin: "lg",
                      action: {
                        type: "uri",
                        label: "ดูรายละเอียด",
                        uri: "https://liff.line.me/2010284484-jvUDlx0u"
                      }
                    }
                  ]
                }
              }
            }
          ]);
        } catch (msgErr) {
          console.error("Error sending Flex message:", msgErr);
        }
      }

      // After registration, redirect to root which will now resolve to TraineeDashboard
      window.location.href = '/';
    } catch (err) {
      console.error("Register Error:", err);
      setError("เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  };

  if (checkingExistingUser) {
    return (
      <>
        <Navbar />
        <div className="loading-container">
          <div className="spinner"></div>
          <p>กำลังตรวจสอบข้อมูล...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="form-container animate-fade-in-up" style={{ marginTop: '120px' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>ลงทะเบียนลูกเทรน</h2>
        
        {error && (
          <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '12px', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

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

        <form onSubmit={handleRegister} className="metrics-form">
          <div className="form-row">
            <div className="form-group" style={{ flex: '1' }}>
              <label>เลือกเทรนเนอร์</label>
              {!selectedTrainer ? (
                <>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between' }}>
                    <input 
                      type="text" 
                      value={searchCode} 
                      onChange={(e) => setSearchCode(e.target.value.replace(/\D/g, '').slice(0, 5))} 
                      placeholder="กรอกเลข 5 หลัก" 
                      style={{ width: '180px', flex: 'none', textAlign: 'center', letterSpacing: '1px' }}
                    />
                    <button 
                      type="button" 
                      onClick={handleSearch} 
                      disabled={searching || searchCode.length !== 5} 
                      className="btn-secondary" 
                      style={{ whiteSpace: 'nowrap', padding: '0 1.5rem', flex: 'none' }}
                    >
                      {searching ? 'ค้นหา...' : '🔍 ค้นหา'}
                    </button>
                  </div>
                  {searchError && <small style={{ color: '#ef4444', display: 'block', marginTop: '0.5rem' }}>{searchError}</small>}
                  
                  {foundTrainer && (
                    <div style={{ marginTop: '1rem', padding: '1.2rem', border: '1px solid #e2e8f0', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                      <div style={{ flexShrink: 0 }}>
                        {foundTrainer.pictureUrl ? (
                          <img src={foundTrainer.pictureUrl} alt="Trainer" style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }} />
                        ) : (
                          <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#cbd5e1', border: '3px solid var(--primary)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>{foundTrainer.displayName}</div>
                        <button 
                          type="button" 
                          className="btn-primary" 
                          style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem', width: 'fit-content', borderRadius: '8px' }} 
                          onClick={() => {
                            setSelectedTrainer(foundTrainer);
                            setFoundTrainer(null);
                            setSearchCode('');
                          }}
                        >
                          เลือก
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: '1.2rem', border: '2px solid var(--primary)', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#eff6ff' }}>
                  <div style={{ flexShrink: 0 }}>
                    {selectedTrainer.pictureUrl ? (
                      <img src={selectedTrainer.pictureUrl} alt="Trainer" style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }} />
                    ) : (
                      <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#cbd5e1', border: '3px solid var(--primary)' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary)' }}>{selectedTrainer.displayName}</div>
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', color: '#ef4444', borderColor: '#ef4444', width: 'fit-content', borderRadius: '8px' }} 
                      onClick={() => setSelectedTrainer(null)}
                    >
                      เปลี่ยน
                    </button>
                  </div>
                </div>
              )}
            </div>
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
            <div className="form-group">
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
            {submitting ? 'กำลังลงทะเบียน...' : 'ยืนยันลงทะเบียนลูกเทรน'}
          </button>
        </form>
      </div>
    </>
  );
}

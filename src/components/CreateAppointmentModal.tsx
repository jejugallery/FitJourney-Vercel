import React, { useState, useEffect } from 'react';
import { appointmentsApi, appointmentInvitationsApi } from '../utils/api';
import { isVideoUrl, uploadToCloudinary } from '../utils/mediaHelper';
import { AutoResizeTextarea } from './AutoResizeTextarea';

interface CreateAppointmentModalProps {
  onClose: () => void;
  userId: string;
}

export default function CreateAppointmentModal({ onClose, userId }: CreateAppointmentModalProps) {
  const [name, setName] = useState('วัดค่าร่างกาย');
  const [isCustomName, setIsCustomName] = useState(false);
  const [customName, setCustomName] = useState('');
  const [datetime, setDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('https://i.ibb.co/qLSQHttF/media-1781330039992.png');
  const [linkType, setLinkType] = useState('none'); // 'none' | 'google_map' | 'zoom'
  const [linkUrl, setLinkUrl] = useState('');
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('video/')) {
        const videoPreviewUrl = URL.createObjectURL(file);
        setImagePreview(videoPreviewUrl);
        setImageFile(file);
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const MAX_SIZE = 960;
          let width = img.width;
          let height = img.height;

          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            } else {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setImagePreview(dataUrl);
            
            canvas.toBlob((blob) => {
              if (blob) {
                const resizedFile = new File([blob], file.name, { type: 'image/jpeg' });
                setImageFile(resizedFile);
              }
            }, 'image/jpeg', 0.85);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = isCustomName ? customName : name;
    if (!finalName.trim() || !datetime || !location.trim()) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (linkType !== 'none') {
      const trimmedUrl = linkUrl.trim();
      if (!trimmedUrl) {
        alert('กรุณากรอกลิงก์ URL');
        return;
      }
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        alert('กรุณากรอกลิงก์ URL ที่ถูกต้อง (ต้องเริ่มต้นด้วย http:// หรือ https://)');
        return;
      }
    }

    setSaving(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        imageUrl = await uploadToCloudinary(imageFile);
      } else if (imagePreview) {
        imageUrl = imagePreview;
      }

      // Format datetime to Thai format before saving
      const d = new Date(datetime);
      const formattedDatetime = `${d.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;

      let formattedEndDatetime = '';
      if (endDatetime) {
        const ed = new Date(endDatetime);
        formattedEndDatetime = `${ed.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${ed.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
      }

      const newAppointment = await appointmentsApi.create({
        name: finalName.trim(),
        imageUrl,
        datetime: formattedDatetime,
        startDatetimeIso: datetime,
        endDatetimeDisplay: formattedEndDatetime,
        endDatetimeIso: endDatetime,
        location: location.trim(),
        description: description.trim(),
        linkType,
        linkUrl: linkType === 'none' ? '' : linkUrl.trim(),
        createdBy: userId,
      });

      await appointmentInvitationsApi.create({
        appointmentId: newAppointment.id,
        inviterId: userId,
        inviteeId: userId,
        role: 'trainer',
        status: 'accepted',
        viewed: true
      });

      onClose();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการสร้างการนัดหมาย');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 20000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '500px',
        padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto'
      }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '15px', right: '15px', background: '#fef2f2', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: '1.4rem', fontWeight: 'bold' }}
        >
          ✕
        </button>

        <h2 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '1.5rem' }}>
          สร้างนัดหมายใหม่
        </h2>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>ชื่อการนัดหมาย *</label>
            <select
              value={isCustomName ? '__CUSTOM__' : name}
              onChange={e => {
                const val = e.target.value;
                if (val === '__CUSTOM__') {
                  setIsCustomName(true);
                  setName('');
                  if (!imageFile) {
                    setImagePreview('');
                  }
                } else {
                  setIsCustomName(false);
                  setName(val);
                  if (!imageFile) {
                    if (val === 'วัดค่าร่างกาย') {
                      setImagePreview('https://i.ibb.co/qLSQHttF/media-1781330039992.png');
                    } else if (val === 'PREMIUM FACIAL SPA') {
                      setImagePreview('https://i.ibb.co/DfqHhYQG/media-1781330736210.png');
                    } else {
                      setImagePreview('');
                    }
                  }
                }
              }}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box', background: '#fff', outline: 'none' }}
              required
            >
              <option value="วัดค่าร่างกาย">วัดค่าร่างกาย</option>
              <option value="PREMIUM FACIAL SPA">PREMIUM FACIAL SPA</option>
              <option value="__CUSTOM__">กำหนดเอง</option>
            </select>
          </div>

          {isCustomName && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>ระบุชื่อการนัดหมาย *</label>
              <input 
                type="text" 
                value={customName} 
                onChange={e => setCustomName(e.target.value)} 
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }}
                placeholder="กรอกชื่อการนัดหมาย"
                required
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>รูปภาพหรือวิดีโอโปรโมท</label>
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
              {imagePreview ? (
                ((imageFile && imageFile.type.startsWith('video/')) || isVideoUrl(imagePreview)) ? (
                  <video src={imagePreview} muted loop playsInline autoPlay style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                ) : (
                  <img src={imagePreview} alt="preview" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                )
              ) : (
                <div style={{ color: '#94a3b8' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🎥</div>
                  คลิกเพื่ออัปโหลดรูปภาพหรือวิดีโอ
                </div>
              )}
              <input type="file" accept="image/*,video/*" onChange={handleImageChange} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>เวลาเริ่ม *</label>
            <div style={{ width: '100%', overflow: 'hidden', borderRadius: '10px' }}>
              <input 
                type="datetime-local" 
                value={datetime} 
                onChange={e => setDatetime(e.target.value)} 
                style={{ width: '100%', minWidth: '0', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box', display: 'block' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>เวลาสิ้นสุด (ไม่บังคับ)</label>
            <div style={{ width: '100%', overflow: 'hidden', borderRadius: '10px' }}>
              <input 
                type="datetime-local" 
                value={endDatetime} 
                onChange={e => setEndDatetime(e.target.value)} 
                min={datetime}
                style={{ width: '100%', minWidth: '0', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box', display: 'block' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>สถานที่ *</label>
            <input 
              type="text" 
              value={location} 
              onChange={e => setLocation(e.target.value)} 
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }}
              placeholder="เช่น สวนลุมพินี หรือ ลิงก์ Zoom"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>ประเภทลิงก์ (ไม่บังคับ)</label>
            <select
              value={linkType}
              onChange={e => {
                setLinkType(e.target.value);
                if (e.target.value === 'none') {
                  setLinkUrl('');
                }
              }}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box', background: '#fff', outline: 'none' }}
            >
              <option value="none">ไม่มี</option>
              <option value="google_map">Google Map</option>
              <option value="zoom">เข้าผ่าน Zoom</option>
            </select>
          </div>

          {linkType !== 'none' && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>
                {linkType === 'zoom' ? 'ลิงก์ Zoom *' : 'ลิงก์ Google Map *'}
              </label>
              <input 
                type="text" 
                value={linkUrl} 
                onChange={e => setLinkUrl(e.target.value)} 
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }}
                placeholder="https://..."
                required
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>รายละเอียด</label>
            <AutoResizeTextarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              onFocus={() => {
                document.body.style.overflow = 'hidden';
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
              }}
              onBlur={() => {
                document.body.style.overflow = 'hidden';
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
              }}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', minHeight: '100px', boxSizing: 'border-box' }}
              placeholder="รายละเอียดนัดหมายเพิ่มเติม..."
            />
          </div>

          <button 
            type="submit" 
            disabled={saving}
            style={{ width: '100%', padding: '14px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: saving ? 'not-allowed' : 'pointer', marginTop: '10px', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'กำลังสร้าง...' : 'สร้างการนัดหมาย'}
          </button>
        </form>
      </div>
    </div>
  );
}

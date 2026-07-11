import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isVideoUrl, uploadToCloudinary } from '../utils/mediaHelper';
import { AutoResizeTextarea } from './AutoResizeTextarea';

const INVITATION_COLORS = [
  { name: 'purple', value: '#6d28d9', label: 'ม่วง' },
  { name: 'red', value: '#ef4444', label: 'แดง' },
  { name: 'blue', value: '#2563eb', label: 'น้ำเงิน' },
  { name: 'green', value: '#16a34a', label: 'เขียว' },
  { name: 'orange', value: '#ea580c', label: 'ส้ม' },
  { name: 'yellow', value: '#FFE600', label: 'เหลือง' },
  { name: 'pink', value: '#FF416C', label: 'ชมพู' },
];

const BUTTON_COLORS = [
  { name: 'red', value: '#ef4444', label: 'แดง' },
  { name: 'blue', value: '#2563eb', label: 'น้ำเงิน' },
  { name: 'green', value: '#16a34a', label: 'เขียว' },
  { name: 'orange', value: '#ea580c', label: 'ส้ม' },
  { name: 'purple', value: '#6d28d9', label: 'ม่วง' },
  { name: 'yellow', value: '#FFE600', label: 'เหลือง' },
  { name: 'pink', value: '#FF416C', label: 'ชมพู' },
];

interface EditEventModalProps {
  onClose: () => void;
  onSuccess: () => void;
  event: any;
}

export default function EditEventModal({ onClose, onSuccess, event }: EditEventModalProps) {
  const [name, setName] = useState(event.name || '');
  const [datetime, setDatetime] = useState(event.startDatetimeIso || '');
  const [endDatetime, setEndDatetime] = useState(event.endDatetimeIso || '');
  const [location, setLocation] = useState(event.location || '');
  const [description, setDescription] = useState(event.description || '');
  const [invitationText, setInvitationText] = useState(event.invitationText || '');
  const [invitationColor, setInvitationColor] = useState(event.invitationColor || '#6d28d9');
  const [linkType, setLinkType] = useState(event.linkType || 'none'); // 'none' | 'zoom' | 'register' | 'details' | 'custom'
  const [linkLabel, setLinkLabel] = useState(event.linkLabel || '');
  const [linkUrl, setLinkUrl] = useState(event.linkUrl || '');
  const [buttonColor, setButtonColor] = useState(event.buttonColor || '#ef4444');
  const [mediaType, setMediaType] = useState<'image' | 'video'>(
    isVideoUrl(event.imageUrl) ? 'video' : 'image'
  );
  const [videoUrl, setVideoUrl] = useState(
    event.videoUrl || (isVideoUrl(event.imageUrl) ? (event.imageUrl || '') : '')
  );
  const [imagePreview, setImagePreview] = useState<string>(
    isVideoUrl(event.imageUrl) ? (event.videoThumbnailUrl || '') : (event.imageUrl || '')
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !datetime || !location.trim()) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }


    if (linkType !== 'none' && linkType !== 'rsvp' && linkType !== 'calendar') {
      const trimmedUrl = linkUrl.trim();
      if (!trimmedUrl) {
        alert('กรุณากรอกลิงก์ URL สำหรับปุ่มแชร์');
        return;
      }
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        alert('กรุณากรอกลิงก์ URL ที่ถูกต้อง (ต้องเริ่มต้นด้วย http:// หรือ https://)');
        return;
      }
      if (linkType === 'custom' && !linkLabel.trim()) {
        alert('กรุณากรอกข้อความบนปุ่มสำหรับปุ่มแชร์');
        return;
      }
    }

    setSaving(true);
    try {
      let imageUrl = '';
      let videoThumbnailUrl = '';

      if (mediaType === 'image') {
        if (imageFile) {
          imageUrl = await uploadToCloudinary(imageFile);
        } else {
          imageUrl = isVideoUrl(event.imageUrl) ? (event.videoThumbnailUrl || '') : (event.imageUrl || '');
        }
      } else {
        imageUrl = videoUrl.trim();
        if (imageFile) {
          videoThumbnailUrl = await uploadToCloudinary(imageFile);
        } else {
          videoThumbnailUrl = isVideoUrl(event.imageUrl) ? (event.videoThumbnailUrl || '') : (event.imageUrl || '');
        }
      }

      // Format datetime to Thai format before saving
      const d = new Date(datetime);
      const formattedDatetime = `${d.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;

      let formattedEndDatetime = '';
      if (endDatetime) {
        const ed = new Date(endDatetime);
        formattedEndDatetime = `${ed.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${ed.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
      }

      await updateDoc(doc(db, 'events', event.id), {
        name: name.trim(),
        imageUrl,
        videoThumbnailUrl,
        videoUrl: videoUrl.trim(),
        datetime: formattedDatetime,
        startDatetimeIso: datetime,
        endDatetimeDisplay: formattedEndDatetime,
        endDatetimeIso: endDatetime,
        location: location.trim(),
        description: description.trim(),
        detailUrl: (linkType !== 'none' && linkType !== 'rsvp' && linkType !== 'calendar') ? linkUrl.trim() : '',
        invitationText: invitationText.trim(),
        invitationColor,
        linkType,
        linkLabel: linkType === 'custom' ? linkLabel.trim() : '',
        linkUrl: (linkType !== 'none' && linkType !== 'rsvp' && linkType !== 'calendar') ? linkUrl.trim() : '',
        buttonColor
      });

      onSuccess();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกกิจกรรม');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 21000,
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
          แก้ไขกิจกรรม
        </h2>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>ประเภทสื่อโปรโมท</label>
            <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setMediaType('image');
                }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                  backgroundColor: mediaType === 'image' ? '#fff' : 'transparent',
                  color: mediaType === 'image' ? '#1e293b' : '#64748b',
                  boxShadow: mediaType === 'image' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                🖼️ รูปภาพ
              </button>
              <button
                type="button"
                onClick={() => {
                  setMediaType('video');
                }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                  backgroundColor: mediaType === 'video' ? '#fff' : 'transparent',
                  color: mediaType === 'video' ? '#1e293b' : '#64748b',
                  boxShadow: mediaType === 'video' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                🎥 วิดีโอ
              </button>
            </div>
          </div>

          {mediaType === 'image' ? (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>รูปภาพโปรโมท (แนะนำขนาด 16:9)</label>
              <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                ) : (
                  <div style={{ color: '#94a3b8' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🖼️</div>
                    คลิกเพื่ออัปโหลดรูปภาพ
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>ลิงก์วิดีโอ (URL)</label>
                <input 
                  type="text" 
                  value={videoUrl} 
                  onChange={e => setVideoUrl(e.target.value)} 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }}
                  placeholder="https://example.com/video.mp4"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    if ((window as any).liff && (window as any).liff.openWindow) {
                      (window as any).liff.openWindow({ url: 'https://www.image2url.com/hosting/video-hosting', external: true });
                    } else {
                      window.open('https://www.image2url.com/hosting/video-hosting', '_blank');
                    }
                  }}
                  style={{
                    marginTop: '8px', width: '100%', padding: '10px', borderRadius: '10px',
                    border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#475569',
                    fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem'
                  }}
                >
                  🌐 อัปโหลดวิดีโอเพื่อรับลิงก์ (ขนาดไม่เกิน 100MB)
                </button>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>รูปภาพหน้าปกวิดีโอ (แนะนำขนาด 16:9)</label>
                <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="preview" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ color: '#94a3b8' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🖼️</div>
                      คลิกเพื่ออัปโหลดรูปภาพหน้าปก
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} />
                </div>
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>ชื่อกิจกรรม *</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }}
              placeholder="เช่น เวิร์คช็อปออกกำลังกายประจำปี"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>เวลาเริ่ม *</label>
            <input 
              type="datetime-local" 
              value={datetime} 
              onChange={e => setDatetime(e.target.value)} 
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>เวลาสิ้นสุด (ไม่บังคับ)</label>
            <input 
              type="datetime-local" 
              value={endDatetime} 
              onChange={e => setEndDatetime(e.target.value)} 
              min={datetime}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>สถานที่ *</label>
            <input 
              type="text" 
              value={location} 
              onChange={e => setLocation(e.target.value)} 
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }}
              placeholder="เช่น สวนลุมพินี"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>รายละเอียด</label>
            <AutoResizeTextarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', minHeight: '100px', boxSizing: 'border-box' }}
              placeholder="รายละเอียดกิจกรรมเพิ่มเติม..."
            />
          </div>

          <div style={{
            background: '#f8fafc',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #cbd5e1',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              💬 ปรับแต่ง Flex Message
            </h3>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.85rem' }}>คำเชิญชวน (ไม่บังคับ)</label>
              <input 
                type="text" 
                value={invitationText} 
                onChange={e => setInvitationText(e.target.value)} 
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box' }}
                placeholder="เช่น เชิญเข้าร่วมกิจกรรม"
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', alignItems: 'center' }}>
                {INVITATION_COLORS.map(color => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setInvitationColor(color.value)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: color.value,
                      border: invitationColor === color.value ? '2px solid #0f172a' : '2px solid transparent',
                      boxShadow: invitationColor === color.value ? '0 0 0 2px #fff, 0 0 0 4px #0f172a' : '0 1px 3px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                      transform: invitationColor === color.value ? 'scale(1.1)' : 'none',
                      padding: 0,
                    }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>



            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.85rem' }}>
                🔗 รูปแบบปุ่มลิงก์ท้าย Flex Message:
              </label>
              <select
                value={linkType}
                onChange={e => {
                  const newType = e.target.value;
                  setLinkType(newType);
                  if (newType === 'none') {
                    setLinkUrl('');
                  }
                }}
                style={{
                  width: '100%', padding: '10px', borderRadius: '8px',
                  border: '1px solid #cbd5e1', fontSize: '0.95rem',
                  boxSizing: 'border-box', background: '#fff', outline: 'none'
                }}
              >
                <option value="none">ไม่แนบลิงค์</option>
                <option value="rsvp">ลงชื่อ</option>
                <option value="calendar">เพิ่มลงปฏิทิน</option>
                <option value="zoom">เข้าผ่าน zoom</option>
                <option value="register">ลงทะเบียน</option>
                <option value="details">ดูรายละเอียด</option>
                <option value="custom">กำหนดเอง</option>
              </select>
            </div>

            {linkType === 'custom' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>
                  ข้อความบนปุ่ม:
                </label>
                <input
                  type="text"
                  placeholder="เช่น เข้าร่วมกิจกรรม"
                  value={linkLabel}
                  onChange={e => setLinkLabel(e.target.value)}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', fontSize: '0.95rem',
                    boxSizing: 'border-box', outline: 'none'
                  }}
                />
              </div>
            )}

            {linkType !== 'none' && linkType !== 'rsvp' && linkType !== 'calendar' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>
                  กรอกลิงก์ URL:
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', fontSize: '0.95rem',
                    boxSizing: 'border-box', outline: 'none'
                  }}
                />
              </div>
            )}

            {linkType !== 'none' && linkType !== 'rsvp' && (
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.85rem' }}>
                  สีปุ่มลิงก์:
                </label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px', alignItems: 'center' }}>
                  {BUTTON_COLORS.map(color => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => setButtonColor(color.value)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: color.value,
                        border: buttonColor === color.value ? '2px solid #0f172a' : '2px solid transparent',
                        boxShadow: buttonColor === color.value ? '0 0 0 2px #fff, 0 0 0 4px #0f172a' : '0 1px 3px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease',
                        transform: buttonColor === color.value ? 'scale(1.1)' : 'none',
                        padding: 0,
                      }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={saving}
            style={{ width: '100%', padding: '14px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: saving ? 'not-allowed' : 'pointer', marginTop: '10px', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
          </button>
        </form>
      </div>
    </div>
  );
}

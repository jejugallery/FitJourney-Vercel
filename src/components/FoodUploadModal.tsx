import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import imageCompression from 'browser-image-compression';
import { useLiff } from '../context/LiffContext';
import SuccessPopup from './SuccessPopup';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import liff from '@line/liff';

export default function FoodUploadModal({ traineeId, trainerIds, onClose }: { traineeId: string, trainerIds: string[], onClose: () => void }) {
  const { profile } = useLiff();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [trainersList, setTrainersList] = useState<any[]>([]);
  const [details, setDetails] = useState('');
  const [isTrainer, setIsTrainer] = useState(false);
  const [selectedTrainerIds, setSelectedTrainerIds] = useState<string[]>([]);
  const [trainersLoading, setTrainersLoading] = useState(true);

  useEffect(() => {
    const checkTrainerAndFetch = async () => {
      setTrainersLoading(true);
      if (!profile?.userId) {
        setTrainersLoading(false);
        return;
      }
      
      let isUserTrainer = false;
      try {
        const q = query(collection(db, 'trainers'), where('trainerId', '==', profile.userId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          if (data.status === 'อนุมัติ' || data.status === 'superadmin') {
            isUserTrainer = true;
            setIsTrainer(true);
          }
        }
      } catch (err) {
        console.error("Error checking trainer status:", err);
      }

      try {
        if (!trainerIds || trainerIds.length === 0) {
          setTrainersList([]);
          setSelectedTrainerIds([]);
          return;
        }

        const q = query(collection(db, 'trainers'), where('trainerId', 'in', trainerIds.slice(0, 10)));
        const snap = await getDocs(q);
        let trainersData = snap.docs.map(d => d.data());

        // Sort to match trainerIds order
        trainersData.sort((a, b) => {
          const indexA = trainerIds.indexOf(a.trainerId);
          const indexB = trainerIds.indexOf(b.trainerId);
          return indexA - indexB;
        });

        // Filter out self if the user is a trainer
        if (isUserTrainer) {
          trainersData = trainersData.filter(t => t.trainerId !== profile.userId);
        }

        setTrainersList(trainersData);
        setSelectedTrainerIds(isUserTrainer ? trainersData.map(t => t.trainerId).filter(Boolean) : []);
      } catch (err) {
        console.error("Error fetching trainers in FoodUploadModal:", err);
      } finally {
        setTrainersLoading(false);
      }
    };

    checkTrainerAndFetch();
  }, [profile, trainerIds]);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('กรุณาเลือกรูปภาพก่อนอัพโหลด');
      return;
    }
    setUploading(true);
    setError(null);

    try {
      // Compress image (longest side ≤ 1080 px)
      const options = {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 1080,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);

      // Upload to ImgBB
      const formData = new FormData();
      formData.append('key', '42148f6b7b12bd47c5e7909be404d11d');
      formData.append('image', compressedFile);

      const imgBBResponse = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
      });
      
      const imgBBData = await imgBBResponse.json();
      
      if (!imgBBData.success) {
        throw new Error(imgBBData.error?.message || 'Failed to upload to ImgBB');
      }

      const downloadURL = imgBBData.data.url;
      const deleteUrl = imgBBData.data.delete_url || null;

      // Save to Firestore
      const targetTrainerIds = isTrainer ? selectedTrainerIds : (trainerIds || []);
      await addDoc(collection(db, 'foodLogs'), {
        traineeId,
        trainerIds: targetTrainerIds,
        imageUrl: downloadURL,
        deleteUrl: deleteUrl,
        submittedAt: serverTimestamp(),
        reviewed: false,
        details: details.trim() || null,
        isTrainerUpload: isTrainer
      });


      // Send Flex Message into the current chat room via LIFF (Free, no Push quota used)
      // Do not send if they are a trainer (isTrainer) but did not select any trainer (selectedTrainerIds.length === 0)
      if (!isTrainer || selectedTrainerIds.length > 0) {
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const traineeDoc = await getDoc(doc(db, 'trainees', traineeId));
          let tName = profile?.displayName || 'ลูกเทรน';
          let tImageUrl = profile?.pictureUrl || 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';

          if (traineeDoc.exists()) {
            const data = traineeDoc.data();
            if (data.nickname) tName = data.nickname;
            if (data.pictureUrl) tImageUrl = data.pictureUrl;
          }

          const foodFlexMessage = {
            type: "flex",
            altText: "มีรายการอาหารรอตรวจ",
            contents: {
              type: "bubble",
              body: {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: "มีอาหารรอตรวจ",
                    weight: "bold",
                    size: "xl",
                    color: "#ff9800"
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "lg",
                    spacing: "sm",
                    contents: [
                      {
                        type: "text",
                        text: "จาก:",
                        color: "#aaaaaa",
                        size: "sm"
                      },
                      {
                        type: "box",
                        layout: "horizontal",
                        spacing: "md",
                        margin: "md",
                        alignItems: "center",
                        contents: [
                          {
                            type: "image",
                            url: tImageUrl,
                            flex: 0,
                            size: "40px",
                            aspectRatio: "1:1",
                            aspectMode: "cover"
                          },
                          {
                            type: "text",
                            text: tName || "ลูกเทรนของคุณ",
                            weight: "bold",
                            size: "md",
                            color: "#333333"
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#ef4444",
                    cornerRadius: "8px",
                    paddingAll: "10px",
                    action: {
                      type: "uri",
                      label: "ตรวจเลย",
                      uri: `https://liff.line.me/2010284484-HzKokXFF/review-food/${traineeId}`
                    },
                    contents: [
                      {
                        type: "text",
                        text: "ตรวจเลย",
                        color: "#ffffff",
                        weight: "bold",
                        size: "sm",
                        align: "center"
                      }
                    ]
                  }
                ],
                flex: 0
              }
            }
          };

          if (liff.isInClient()) {
            await liff.sendMessages([foodFlexMessage as any]);
          }
        } catch (liffSendErr) {
          console.error("Failed to send food Flex Message via liff.sendMessages:", liffSendErr);
        }
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1500);
      
    } catch (err) {
      console.error(err);
      setError('เกิดข้อผิดพลาดในการอัพโหลด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 150000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(4px)',
        overscrollBehavior: 'contain'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '24px',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '450px',
          position: 'relative',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: 'none',
          overscrollBehavior: 'contain'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#fef2f2',
            border: 'none',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            zIndex: 10
          }}
        >
          ✕
        </button>
        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          {isTrainer ? 'ส่งภาพอาหาร' : 'ส่งภาพอาหารให้เทรนเนอร์'}
        </h3>

        {/* Trainers List & Add Trainer button */}
        <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>
              {isTrainer ? 'ให้เทรนเนอร์ช่วยตรวจอาหาร:' : 'ส่งให้เทรนเนอร์:'}
            </span>
          </div>
          {trainersLoading ? (
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>
              กำลังโหลดรายชื่อเทรนเนอร์...
            </div>
          ) : trainersList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {trainersList.map((trainer, idx) => {
                const isChecked = isTrainer && selectedTrainerIds.includes(trainer.trainerId);
                const content = (
                  <>
                    {isTrainer && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTrainerIds(prev => [...prev, trainer.trainerId]);
                          } else {
                            setSelectedTrainerIds(prev => prev.filter(id => id !== trainer.trainerId));
                          }
                        }}
                        style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                    )}
                    {trainer.pictureUrl ? (
                      <img src={trainer.pictureUrl} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1rem' }}>👨‍🏫</span>
                    )}
                    <span style={{ fontWeight: '500', fontSize: '0.9rem', color: 'var(--text-main)', flex: 1 }}>
                      {trainer.nickname || trainer.displayName || 'เทรนเนอร์'}
                    </span>
                  </>
                );

                const style = {
                  display: 'flex', 
                  alignItems: 'center', 
                  background: '#fff', 
                  padding: '0.6rem 0.8rem', 
                  borderRadius: '12px', 
                  border: isChecked ? '1px solid var(--primary)' : '1px solid #e2e8f0',
                  gap: '0.6rem',
                  cursor: isTrainer ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  boxShadow: isChecked ? '0 2px 4px rgba(255, 65, 108, 0.05)' : 'none'
                };

                return isTrainer ? (
                  <label key={idx} style={style}>{content}</label>
                ) : (
                  <div key={idx} style={style}>{content}</div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: isTrainer ? '#64748b' : '#ef4444', fontWeight: '500' }}>
              {isTrainer ? 'ไม่มีเทรนเนอร์ท่านอื่นที่ผูกไว้' : '⚠️ ยังไม่มีเทรนเนอร์ผู้ดูแล (ภาพจะไม่ส่งแจ้งเตือน)'}
            </div>
          )}
        </div>

        {error && <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

        <div 
          onClick={() => fileInputRef.current?.click()}
          style={{ 
            border: '2px dashed #cbd5e1', 
            borderRadius: '12px', 
            height: '200px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            cursor: 'pointer',
            marginBottom: '1.5rem',
            overflow: 'hidden',
            background: '#f8fafc'
          }}
        >
          {preview ? (
            <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <div style={{ color: '#64748b', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📸</div>
              แตะเพื่อเลือกรูปภาพ
            </div>
          )}
        </div>
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange}
        />

        {/* Food Details Textarea */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '0.5rem' }}>
            รายละเอียดอาหาร (ไม่บังคับกรอก)
          </label>
          <AutoResizeTextarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="เช่น ข้าวกล้องอกไก่ 1 จาน, ไข่ต้ม 2 ฟอง..."
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              minHeight: '80px',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button 
          className="btn-primary" 
          style={{ width: '100%' }} 
          onClick={handleUpload}
          disabled={uploading || !file || showSuccess}
        >
          {uploading ? 'กำลังอัพโหลด...' : 'ยืนยันส่งภาพอาหาร'}
        </button>
      </div>
      
      <SuccessPopup show={showSuccess} message="ส่งภาพอาหารสำเร็จ!" />
    </div>
  );
}

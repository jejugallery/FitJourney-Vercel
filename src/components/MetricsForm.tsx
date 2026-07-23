import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useLiff } from '../context/LiffContext';
import ManualTraineeForm from './ManualTraineeForm';
import SuccessPopup from './SuccessPopup';
import { fetchGeminiWithFallback } from '../utils/geminiHelper';
import FoodUploadModal from './FoodUploadModal';
import FoodLogsModal from './FoodLogsModal';
import AddTrainerModal from './AddTrainerModal';
import FoodHistoryModal from './FoodHistoryModal';
import SupplementCourseModal from './SupplementCourseModal';


interface MetricsFormProps {
  initialTraineeName?: string;
  adminData?: any;
  onViewStats?: (id?: string, nickname?: string) => void;
  isRecordOnly?: boolean;
}

export default function MetricsForm({ initialTraineeName = '', adminData, onViewStats, isRecordOnly = false }: MetricsFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  
  const { profile } = useLiff();
  const [showImageOcrModal, setShowImageOcrModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncSearchQuery, setSyncSearchQuery] = useState('');
  const [syncingTraineeId, setSyncingTraineeId] = useState<string | null>(null);
  const [pendingSyncTarget, setPendingSyncTarget] = useState<any | null>(null);
  const [showSuccessSync, setShowSuccessSync] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [processingOcr, setProcessingOcr] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showSuccessOcr, setShowSuccessOcr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
      
      const urls = filesArray.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...urls]);
      setOcrError(null);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const resizeImage = (file: File, maxDimension: number): Promise<{ base64: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const parts = dataUrl.split(',');
        const base64 = parts[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.onerror = (err) => {
        reject(err);
      };
    });
  };

  const handleProcessOcr = async () => {
    if (selectedFiles.length === 0) return;
    setProcessingOcr(true);
    setOcrError(null);

    try {
      const resizedImages = await Promise.all(
        selectedFiles.map(file => resizeImage(file, 720))
      );

      const prompt = `คุณเป็น AI ผู้เชี่ยวชาญด้านการวิเคราะห์ภาพถ่ายสลิปหรือหน้าจอของเครื่องวัดองค์ประกอบร่างกาย (เช่น เครื่อง Tanita หรือเครื่องชั่งน้ำหนักอัจฉริยะอื่นๆ)
กรุณาตรวจจับตัวเลขและประมวลผลข้อมูลในภาพทั้งหมดที่ส่งมา (ซึ่งอาจมีรูปภาพมากกว่า 1 รูปที่ถ่ายจากสลิปหรือหน้าจอต่างมุมกัน) เพื่อสกัดข้อมูลค่าร่างกายต่อไปนี้:
- age (อายุ - ปี)
- height (ส่วนสูง - ซม.)
- weight (น้ำหนัก - กก.)
- bodyFat (เปอร์เซ็นต์ไขมัน - %)
- muscleMass (มวลกล้ามเนื้อ - กก.)
- metabolicRate (อัตราการเผาผลาญ หรือ BMR - kcal)
- boneMass (มวลกระดูก - กก.)
- bodyWater (น้ำในร่างกาย - %)
- visceralFat (ระดับไขมันในช่องท้อง - เป็นตัวเลขระดับ เช่น 5 หรือ 5.5)
- bodyAge (อายุเซล หรือ Metabolic Age - ปี)
- physiqueRating (ระดับมวลกล้ามเนื้อ หรือ Physique Rating - เป็นตัวเลขระดับ 1-9)

ข้อกำหนดและกฎเกณฑ์สำคัญในการจำแนกตัวเลข (โดยเฉพาะหน้าจอเครื่อง Tanita):
1. น้ำหนัก (weight - กก.): จะแสดงเป็นตัวเลขทศนิยม 1 ตำแหน่งที่บรรทัดบนสุด มีหน่วย 'kg' และมีไอคอนรูปตุ้มน้ำหนัก/ตาชั่งอยู่ข้างๆ โดยหน้าจอนี้ตัวเลขบรรทัดล่างสุดจะมีหน่วยเป็น '%' เสมอ (ซึ่งคือ เปอร์เซ็นต์ไขมัน หรือ bodyFat)
2. เปอร์เซ็นต์ไขมัน (bodyFat - %): จะแสดงเป็นตัวเลขทศนิยม 1 ตำแหน่งที่บรรทัดล่าง มีสัญลักษณ์ '%' และมีรูปไอคอนตัวคนอยู่ข้างขวาของตัวเลข % (คู่กับน้ำหนักที่บรรทัดบน)
3. มวลกระดูก (boneMass - กก.): จะแสดงเป็นตัวเลขทศนิยม 1 ตำแหน่งที่บรรทัดบนของค่าน้ำในร่างกาย มีหน่วย 'kg' และมีไอคอนรูปกระดูก/รูปคนอยู่ข้างขวา
4. น้ำในร่างกาย (bodyWater - %): จะแสดงเป็นตัวเลขทศนิยม 1 ตำแหน่งที่บรรทัดล่าง มีสัญลักษณ์ '%' และมีรูปไอคอนหยดน้ำอยู่ข้างขวา
5. มวลกล้ามเนื้อ (muscleMass - กก.): จะแสดงเป็นตัวเลขทศนิยม 1 ตำแหน่งที่บรรทัดบน มีหน่วย 'kg' และมีสัญลักษณ์รูปแขนเบ่งกล้าม หรือสัญลักษณ์คนยกดัมเบล อยู่มุมบนขวา โดยหน้าจอนี้ตัวเลขบรรทัดล่างสุดจะไม่มีหน่วยใดๆ และแสดงเป็นตัวเลขตัวเดียวเดี่ยวๆ เสมอ (เช่น 5)
6. ระดับไขมันในช่องท้อง (visceralFat): จะแสดงเป็นตัวเลขบรรทัดเดียวอยู่ข้างล่างเส้นขีด (ไม่คู่กับตัวเลขบรรทัดอื่น) เป็นตัวเลขหลักหน่วยหรือหลักสิบ โดยตัวเลขสุดท้ายอยู่หลังจุดทศนิยม (เช่น 9.0, 10.0, 12.5) มีรูปไอคอนตัวคนที่มีวงกลมที่หน้าท้องอยู่ข้างขวาของตัวเลข
7. อัตราการเผาผลาญ (metabolicRate - kcal): 
   - หากเห็นตัวเลขบรรทัดบนคู่กับหน่วย 'kJ' (เช่น 6538 kJ) นั่นคือหน่วยกิโลจูล ห้ามเอามาตอบโดยตรง
   - หากเห็นตัวเลขบรรทัดบนคู่กับหน่วย 'kcal' (เช่น 1563 kcal) นั่นคือหน่วยกิโลแคลอรี ให้เลือกนำตัวเลขนี้มาเป็นค่า metabolicRate
8. อายุเซลล์/อายุร่างกาย (bodyAge - ปี): จะแสดงที่บรรทัดล่างสุด มีสัญลักษณ์หรือตัวอักษรระบุว่า 'Age' หรือ 'body Age' อยู่ถัดจากตัวเลข (เช่น 36)
9. ระดับมวลกล้ามเนื้อ (physiqueRating - 1-9): จะแสดงค่าระดับประเภทหุ่น/กล้ามเนื้อเป็นตัวเลขเดี่ยว ๆ ระหว่าง 1-9 (Physique Rating) ซึ่งจะอยู่บรรทัดล่างของค่ามวลกล้ามเนื้อ (muscleMass - กก.)
10. หากไม่พบค่าใดค่าหนึ่งในภาพ ให้ตอบค่านั้นเป็น null
11. ตอบเป็นรูปแบบ JSON เท่านั้น ห้ามมีข้อความเกริ่นนำหรือคำอธิบายใดๆ นอกเหนือจาก JSON:
{
  "age": null,
  "height": null,
  "weight": null,
  "bodyFat": null,
  "muscleMass": null,
  "metabolicRate": null,
  "boneMass": null,
  "bodyWater": null,
  "visceralFat": null,
  "bodyAge": null,
  "physiqueRating": null
}`;

      const res = await fetchGeminiWithFallback(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemma-4-26b-a4b-it'], [
        {
          parts: [
            { text: prompt },
            ...resizedImages.map(img => ({
              inlineData: {
                mimeType: img.mimeType,
                data: img.base64
              }
            }))
          ]
        }
      ]);
      const rawText = res.rawText;
      console.log('Gemini body metrics raw response:', rawText);

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const aiData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      
      if (aiData) {
        setFormData(prev => {
          const updated = { ...prev };
          if (aiData.age !== null && aiData.age !== undefined) updated.age = aiData.age.toString();
          if (aiData.height !== null && aiData.height !== undefined) updated.height = aiData.height.toString();
          if (aiData.weight !== null && aiData.weight !== undefined) updated.weight = aiData.weight.toString();
          if (aiData.bodyFat !== null && aiData.bodyFat !== undefined) updated.bodyFat = aiData.bodyFat.toString();
          if (aiData.muscleMass !== null && aiData.muscleMass !== undefined) updated.muscleMass = aiData.muscleMass.toString();
          if (aiData.metabolicRate !== null && aiData.metabolicRate !== undefined) updated.metabolicRate = aiData.metabolicRate.toString();
          if (aiData.boneMass !== null && aiData.boneMass !== undefined) updated.boneMass = aiData.boneMass.toString();
          if (aiData.bodyWater !== null && aiData.bodyWater !== undefined) updated.bodyWater = aiData.bodyWater.toString();
          if (aiData.visceralFat !== null && aiData.visceralFat !== undefined) updated.visceralFat = aiData.visceralFat.toString();
          if (aiData.bodyAge !== null && aiData.bodyAge !== undefined) updated.bodyAge = aiData.bodyAge.toString();
          if (aiData.physiqueRating !== null && aiData.physiqueRating !== undefined) updated.physiqueRating = aiData.physiqueRating.toString();
          return updated;
        });

        previews.forEach(url => URL.revokeObjectURL(url));
        setSelectedFiles([]);
        setPreviews([]);
        setShowSuccessOcr(true);
        setTimeout(() => {
          setShowSuccessOcr(false);
          setShowImageOcrModal(false);
        }, 1500);
      } else {
        setOcrError('AI ไม่สามารถวิเคราะห์ภาพที่ส่งมาได้ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err: any) {
      console.error('OCR processing error:', err);
      setOcrError(err.message || 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
    } finally {
      setProcessingOcr(false);
    }
  };

  useEffect(() => {
    if (showImageOcrModal || showSyncModal || pendingSyncTarget || showSuccessSync) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [showImageOcrModal, showSyncModal, pendingSyncTarget, showSuccessSync]);
  const [trainees, setTrainees] = useState<any[]>([]);

  const [isEditingTrainerName, setIsEditingTrainerName] = useState(false);
  const [editTrainerNameInput, setEditTrainerNameInput] = useState('');
  const [showManualRegister, setShowManualRegister] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingTrainerName, setSavingTrainerName] = useState(false);
  const [reactiveAdminData, setReactiveAdminData] = useState(adminData);
  const [trainerDisplayName, setTrainerDisplayName] = useState(adminData?.nickname || adminData?.displayName || profile?.displayName || 'กำลังโหลด...');

  const [trainersList, setTrainersList] = useState<any[]>([]);
  const [trainerName, setTrainerName] = useState('');
  const [newCommentsCount, setNewCommentsCount] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showAddTrainerModal, setShowAddTrainerModal] = useState(false);
  const [showFoodHistoryModal, setShowFoodHistoryModal] = useState(false);
  const [showSupplementCourseModal, setShowSupplementCourseModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'uploadFood' || params.get('action') === 'upload-food') {
      setShowUploadModal(true);
    }
  }, []);




  useEffect(() => {
    if (!adminData?.docId) {
      setTrainerDisplayName(adminData?.nickname || adminData?.displayName || profile?.displayName || 'กำลังโหลด...');
      setReactiveAdminData(adminData);
      return;
    }
    const unsub = onSnapshot(doc(db, 'trainers', adminData.docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setReactiveAdminData({ ...data, docId: docSnap.id } as any);
        setTrainerDisplayName(data.nickname || data.displayName || profile?.displayName || 'กำลังโหลด...');
      }
    });
    return () => unsub();
  }, [adminData?.docId, adminData, profile]);

  const handleSaveTrainerName = async () => {
    if (!reactiveAdminData?.docId || !editTrainerNameInput.trim()) return;
    setSavingTrainerName(true);
    try {
      await updateDoc(doc(db, 'trainers', reactiveAdminData.docId), {
        nickname: editTrainerNameInput.trim()
      });
      setTrainerDisplayName(editTrainerNameInput.trim());
      setIsEditingTrainerName(false);
    } catch (err) {
      console.error('Error updating name:', err);
      alert('ไม่สามารถบันทึกชื่อได้ กรุณาลองใหม่');
    } finally {
      setSavingTrainerName(false);
    }
  };
  const handleViewCommentsClick = async () => {
    const activeSelectedTrainee = trainees.find(t => t.nickname === formData.name);
    const activeQueryId = (!formData.name || formData.name === '' || formData.name === '__SELF__') ? profile?.userId : (activeSelectedTrainee?.userId || '');
    if (!activeQueryId) return;
    try {
      const q = query(
        collection(db, 'foodLogs'),
        where('traineeId', '==', activeQueryId),
        where('reviewed', '==', true)
      );
      const snap = await getDocs(q);
      const now = Date.now();
      const hasRecentCommented = snap.docs.some(doc => {
        const data = doc.data();
        if (!data.submittedAt) return false;
        const t = data.submittedAt.toMillis ? data.submittedAt.toMillis() : 0;
        return (now - t) <= 24 * 60 * 60 * 1000;
      });
      if (hasRecentCommented) {
        setShowLogsModal(true);
      }
    } catch (err) {
      console.error("Error checking commented logs:", err);
    }
  };

  const [formData, setFormData] = useState({
    name: initialTraineeName,
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
    physiqueRating: '',
  });

  useEffect(() => {
    if (initialTraineeName && isRecordOnly) {
      setFormData(prev => ({ ...prev, name: initialTraineeName }));
    }
  }, [initialTraineeName, isRecordOnly]);

  useEffect(() => {
    if (!profile) return;
    const selectedTrainee = trainees.find(t => t.nickname === formData.name);
    const queryId = (!formData.name || formData.name === '' || formData.name === '__SELF__') ? profile.userId : (selectedTrainee?.userId || '');
    if (!queryId) {
      setTrainersList([]);
      setTrainerName('');
      setNewCommentsCount(0);
      return;
    }

    const fetchTraineeTrainers = async () => {
      try {
        const tQuery = query(collection(db, 'trainees'), where('userId', '==', queryId));
        const tSnap = await getDocs(tQuery);
        let tIds: string[] = [];
        if (!tSnap.empty) {
          const tData = tSnap.docs[0].data();
          tIds = tData.trainerIds || [];
        }

        if (tIds.length > 0) {
          const aQuery = query(collection(db, 'trainers'), where('trainerId', 'in', tIds.slice(0, 10)));
          const aSnap = await getDocs(aQuery);
          const trainersData = aSnap.docs.map(d => d.data());
          trainersData.sort((a, b) => tIds.indexOf(a.trainerId) - tIds.indexOf(b.trainerId));
          setTrainersList(trainersData);
          if (trainersData.length > 0) {
            setTrainerName(trainersData[0].nickname || trainersData[0].displayName || 'Unknown');
          }
        } else {
          setTrainersList([]);
          setTrainerName('');
        }
      } catch (err) {
        console.error('Error fetching trainers in MetricsForm:', err);
      }
    };
    fetchTraineeTrainers();

    const q = query(
      collection(db, 'foodLogs'),
      where('traineeId', '==', queryId),
      where('reviewed', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const now = Date.now();
      let count = 0;
      snap.forEach(doc => {
        const data = doc.data();
        if (data.submittedAt) {
          const t = data.submittedAt.toMillis ? data.submittedAt.toMillis() : 0;
          if ((now - t) <= 24 * 60 * 60 * 1000 && !data.traineeSeen) {
            count++;
          }
        }
      });
      setNewCommentsCount(count);
    });

    return () => unsubscribe();
  }, [profile, formData.name, trainees]);
  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'trainees'), where('trainerIds', 'array-contains', profile.userId));
    
    const unsubscribe = onSnapshot(q, async (snap) => {
      try {
        const list: any[] = [];

        snap.forEach(doc => {
          const data = doc.data();
          const traineeObj = { 
            nickname: data.nickname, 
            userId: data.userId,
            province: data.province || '',
            zone: data.zone || '',
            age: data.age || '',
            height: data.height || '',
            dob: data.dob,
            pictureUrl: data.pictureUrl || '',
            createdAt: data.createdAt ? data.createdAt.toDate().getTime() : 0
          };
          list.push(traineeObj);
        });
        
        // Check graduation in batches of 30 using 'in' query to avoid query storm
        if (list.length > 0) {
          const traineeIds = list.map(t => t.userId).filter(Boolean);
          const chunks: string[][] = [];
          for (let i = 0; i < traineeIds.length; i += 30) {
            chunks.push(traineeIds.slice(i, i + 30));
          }
          
          const trainersMap: Record<string, any> = {};
          const trainerChecks = chunks.map(async (chunk) => {
            if (chunk.length === 0) return;
            const trainersQ = query(collection(db, 'trainers'), where('trainerId', 'in', chunk));
            const trainersSnap = await getDocs(trainersQ);
            trainersSnap.docs.forEach(doc => {
              const data = doc.data();
              if (data.trainerId) {
                trainersMap[data.trainerId] = data;
              }
            });
          });
          
          await Promise.all(trainerChecks);
          
          list.forEach(t => {
            if (t.userId && trainersMap[t.userId]) {
              const data = trainersMap[t.userId];
              const status = data.status;
              if (status !== 'ไม่อนุมัติ') {
                t.isGraduated = true;
                t.graduatedStatus = status;
                t.graduatedCode = data.trainerCode || '-';
              }
            }
          });
        }

        setTrainees(list);
        
      } catch (err) {
        console.error("Error fetching trainees realtime:", err);
      }
    });

    return () => unsubscribe();
  }, [profile, initialTraineeName]);

  const isSelf = formData.name === '__SELF__';
  const selectedTrainee = trainees.find(t => t.nickname === formData.name);
  const displayTrainee = isSelf ? reactiveAdminData : selectedTrainee;
  const traineeName = isSelf ? (profile?.displayName || 'ตัวฉันเอง') : (displayTrainee?.nickname || displayTrainee?.lineName || formData.name);
  const traineePic = isSelf ? profile?.pictureUrl : displayTrainee?.pictureUrl;

  const syncTraineesList = trainees.filter(t => {
    // Cannot sync to self/same manual trainee
    if (t.userId === selectedTrainee?.userId) return false;
    // Exclude other manual trainees
    if (t.userId?.startsWith('manual_')) return false;
    // Exclude graduated/trainers
    if (t.isGraduated) return false;
    
    if (syncSearchQuery.trim()) {
      const term = syncSearchQuery.toLowerCase();
      const name = (t.nickname || '').toLowerCase();
      const prov = (t.province || '').toLowerCase();
      const zone = (t.zone || '').toLowerCase();
      return name.includes(term) || prov.includes(term) || zone.includes(term);
    }
    return true;
  });

  const handleSyncData = async (targetTrainee: any) => {
    if (!selectedTrainee) return;

    setSyncingTraineeId(targetTrainee.userId);
    try {
      const sourceId = selectedTrainee.userId;
      const targetId = targetTrainee.userId;

      // 1. Fetch & update bodyMetrics
      const metricsQ = query(collection(db, 'bodyMetrics'), where('traineeId', '==', sourceId));
      const metricsSnap = await getDocs(metricsQ);
      
      const metricsUpdatePromises = metricsSnap.docs.map(docSnap => {
        return updateDoc(doc(db, 'bodyMetrics', docSnap.id), {
          traineeId: targetId,
          name: targetTrainee.nickname || '',
          province: targetTrainee.province || '',
          address: targetTrainee.zone || ''
        });
      });

      // 2. Fetch & update recommendations
      const recQ = query(collection(db, 'recommendation'), where('targetId', '==', sourceId));
      const recSnap = await getDocs(recQ);
      
      const recUpdatePromises = recSnap.docs.map(docSnap => {
        return updateDoc(doc(db, 'recommendation', docSnap.id), {
          targetId: targetId
        });
      });

      // 3. Fetch & update foodLogs (if any)
      const foodLogsQ = query(collection(db, 'foodLogs'), where('traineeId', '==', sourceId));
      const foodLogsSnap = await getDocs(foodLogsQ);
      
      const foodLogsUpdatePromises = foodLogsSnap.docs.map(docSnap => {
        return updateDoc(doc(db, 'foodLogs', docSnap.id), {
          traineeId: targetId
        });
      });

      // Execute all updates
      await Promise.all([
        ...metricsUpdatePromises,
        ...recUpdatePromises,
        ...foodLogsUpdatePromises
      ]);

      // 4. Delete the manual trainee
      const traineeQ = query(collection(db, 'trainees'), where('userId', '==', sourceId));
      const traineeSnap = await getDocs(traineeQ);
      const deletePromises = traineeSnap.docs.map(docSnap => deleteDoc(doc(db, 'trainees', docSnap.id)));
      await Promise.all(deletePromises);

      // Trigger beautiful auto-fade success popup
      setShowSuccessSync(true);
      setTimeout(() => {
        setShowSuccessSync(false);
      }, 2500);

      // Reset form and UI
      setShowSyncModal(false);
      setSyncSearchQuery('');
      
      // Auto-select the synced trainee
      handleSelectTrainee(targetTrainee);
    } catch (err) {
      console.error('Error syncing trainee:', err);
      alert('เกิดข้อผิดพลาดในการโอนย้ายข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSyncingTraineeId(null);
    }
  };

  // Pre-fill age and height when a trainee is selected if they are empty
  useEffect(() => {
    const prefillData = async () => {
      if (displayTrainee) {
        let newAge = '';
        let newHeight = displayTrainee.height ? displayTrainee.height.toString() : '';

        // 1. Calculate from DOB or Profile Age
        if (displayTrainee.dob) {
          const birthDate = new Date(displayTrainee.dob);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age > 0) newAge = age.toString();
        } else if (displayTrainee.age) {
          newAge = displayTrainee.age.toString();
        }

        // 2. Fetch latest bodyMetrics if still missing
        if (!newAge || !newHeight) {
          try {
            const targetId = displayTrainee.userId || displayTrainee.trainerId;
            if (targetId) {
              const q = query(
                collection(db, 'bodyMetrics'),
                where(displayTrainee.userId ? 'traineeId' : 'trainerId', '==', targetId)
              );
              const snap = await getDocs(q);
              if (!snap.empty) {
                const docs = snap.docs.map(doc => doc.data());
                docs.sort((a, b) => {
                  const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                  const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                  return timeB - timeA;
                });
                const latest = docs[0];
                if (!newAge && latest.age) newAge = latest.age.toString();
                if (!newHeight && latest.height) newHeight = latest.height.toString();
              }
            }
          } catch (err) {
            console.error('Error fetching fallback metrics:', err);
          }
        }

        setFormData(prev => ({
          ...prev,
          age: newAge,
          height: newHeight
        }));
      } else {
        // If no trainee selected, clear age and height
        setFormData(prev => ({
          ...prev,
          age: '',
          height: ''
        }));
      }
    };
    prefillData();
  }, [displayTrainee]);

  useEffect(() => {
    if (!profile || trainees.length === 0 || !isRecordOnly) return;
    const storedId = sessionStorage.getItem(`selectedTraineeId_${profile.userId}`);
    if (storedId) {
      const found = trainees.find(t => t.userId === storedId);
      if (found && found.nickname !== formData.name) {
        setFormData(prev => ({ ...prev, name: found.nickname }));
      }
    }
  }, [trainees, profile, formData.name, isRecordOnly]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'name') {
      if (value === '__NEW_TRAINEE__') {
        if (profile?.userId) sessionStorage.removeItem(`selectedTraineeId_${profile.userId}`);
        setShowManualRegister(true);
        return;
      } else if (value === '__SELF__') {
        if (profile?.userId) sessionStorage.removeItem(`selectedTraineeId_${profile.userId}`);
      }
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectTrainee = (t: any) => {
    setFormData(prev => ({ ...prev, name: t.nickname }));
    if (profile?.userId) {
      sessionStorage.setItem(`selectedTraineeId_${profile.userId}`, t.userId);
    }
    setDropdownOpen(false);
    setSearchQuery('');
  };

  const isFormValid = Object.values(formData).every(val => val.toString().trim() !== '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, 'bodyMetrics'), {
        ...formData,
        name: formData.name === '__SELF__' ? (profile?.displayName || 'เทรนเนอร์') : formData.name,
        advisor: profile?.displayName || 'Unknown',
        trainerId: profile?.userId || 'Unknown',
        traineeId: formData.name === '__SELF__' ? profile?.userId : (selectedTrainee?.userId || ''),
        province: selectedTrainee?.province || '',
        address: selectedTrainee?.zone || '',
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
        physiqueRating: Number(formData.physiqueRating),
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
    } catch (error) {
      console.error('Error adding document: ', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="form-container success-container animate-fade-in-up" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
        <div className="success-icon">🎉</div>
        <h2>บันทึกข้อมูลสำเร็จ!</h2>
        <p style={{ lineHeight: '1.6', margin: '0 0 1.5rem 0', fontSize: '1rem', color: 'var(--text-main)' }}>
          ข้อมูลร่างกายของ <strong>{formData.name === '__SELF__' ? 'คุณ' : (formData.name || 'คุณ')}</strong>
          <span style={{ display: 'block', marginTop: '0.4rem' }}>ถูกบันทึกเรียบร้อยแล้ว</span>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', maxWidth: '300px', margin: '1rem auto 0 auto' }}>
          <button 
            type="button"
            className="btn-secondary" 
            style={{ 
              padding: '0.65rem 1rem', 
              fontSize: '0.9rem', 
              margin: 0, 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px',
              borderColor: '#3b82f6',
              color: '#3b82f6',
              background: 'transparent',
              fontWeight: 'bold',
              borderRadius: '12px',
              cursor: 'pointer'
            }}
            onClick={() => {
              const targetId = formData.name === '__SELF__' ? profile?.userId : selectedTrainee?.userId;
              if (targetId) {
                navigate(`/body-analysis/${targetId}`);
              } else {
                alert('ไม่พบข้อมูลรหัสผู้ใช้');
              }
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            📸 อ่านค่าร่างกาย
          </button>

          <button 
            type="button"
            className="btn-primary" 
            style={{ 
              padding: '0.65rem 1rem', 
              fontSize: '0.9rem', 
              margin: 0, 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px',
              fontWeight: 'bold',
              borderRadius: '12px',
              boxShadow: 'none',
              cursor: 'pointer'
            }}
            onClick={() => { 
              const targetId = formData.name === '__SELF__' ? profile?.userId : selectedTrainee?.userId;
              if (targetId) {
                navigate(`/calculator/${targetId}`);
              } else {
                alert('ไม่พบข้อมูลรหัสผู้ใช้');
              }
            }}
          >
            🥗 คำนวณพลังงานและสารอาหาร
          </button>

          <button 
            type="button"
            className="btn-secondary" 
            style={{ 
              padding: '0.65rem 1rem', 
              fontSize: '0.9rem', 
              margin: 0, 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px',
              fontWeight: 'bold',
              borderRadius: '12px',
              color: '#475569',
              borderColor: '#cbd5e1',
              cursor: 'pointer'
            }}
            onClick={() => { 
              setSuccess(false); 
              setFormData({ name: '', age: '', height: '', weight: '', bodyFat: '', muscleMass: '', metabolicRate: '', boneMass: '', bodyWater: '', visceralFat: '', bodyAge: '', physiqueRating: '' });
            }}
          >
            ✍️ กลับหน้าบันทึก
          </button>
        </div>
      </div>
    );
  }

    const queryId = (!formData.name || formData.name === '' || formData.name === '__SELF__') ? profile?.userId : (selectedTrainee?.userId || '');


    if (!isRecordOnly) {
      return (
        <>
        <div className="form-container animate-fade-in-up">
          {/* Top section: Trainer Card */}
          <div className="form-row" style={{ marginBottom: '1.5rem' }}>
            {/* Trainer Card */}
            <div className="form-group" style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>เทรนเนอร์ (Trainer)</label>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '0.8rem 1rem', 
                background: 'rgba(0,0,0,0.02)', 
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                {profile?.pictureUrl ? (
                  <img 
                    src={profile.pictureUrl} 
                    alt="Advisor" 
                    style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                  />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#cbd5e1' }} />
                )}
                <div style={{ flex: 1 }}>
                  {isEditingTrainerName ? (
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input 
                        type="text" 
                        value={editTrainerNameInput} 
                        onChange={(e) => setEditTrainerNameInput(e.target.value)} 
                        style={{ padding: '0.3rem 0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', flex: '1', minWidth: '100px', maxWidth: '160px' }}
                        disabled={savingTrainerName}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button 
                          type="button"
                          onClick={handleSaveTrainerName} 
                          disabled={savingTrainerName}
                          style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        >
                          บันทึก
                        </button>
                        <button 
                          type="button"
                          onClick={() => setIsEditingTrainerName(false)} 
                          disabled={savingTrainerName}
                          style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{trainerDisplayName}</div>
                      {reactiveAdminData?.trainerCode && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Code: {reactiveAdminData.trainerCode}</div>
                      )}
                    </>
                  )}
                </div>
                
                {!isEditingTrainerName && reactiveAdminData?.docId && (
                  <button
                    type="button"
                    onClick={() => setShowSupplementCourseModal(true)}
                    style={{ background: '#fff1f4', border: '1px solid #ffb3c2', borderRadius: '10px', minHeight: '36px', cursor: 'pointer', fontSize: '0.82rem', color: '#e11d48', padding: '0.35rem 0.65rem', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
                    title="จัดคอร์สอาหารเสริม"
                  >
                    จัดคอร์ส
                  </button>
                )}

                {!isEditingTrainerName && reactiveAdminData?.docId && (
                  <button 
                    type="button"
                    onClick={() => {
                      setEditTrainerNameInput(trainerDisplayName);
                      setIsEditingTrainerName(true);
                    }}
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    title="แก้ไขชื่อเทรนเนอร์"
                  >
                    ✏️
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Food Care Card */}
          {profile?.userId && (
            <div style={{ background: '#fff', padding: '1.2rem', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                การดูแลเรื่องอาหาร
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {trainersList.length > 0 ? trainersList.map((trainer, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      background: '#f8fafc', 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0',
                      gap: '0.5rem',
                      flex: '1 1 calc(50% - 0.75rem)',
                      minWidth: '140px'
                    }}>
                      {trainer.pictureUrl ? (
                        <img src={trainer.pictureUrl} alt="Trainer" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #f59e0b', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1rem' }}>👨‍🏫</div>
                      )}
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>เทรนเนอร์</div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.2, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {trainer.nickname || trainer.displayName || '-'}
                        </div>
                      </div>
                    </div>
                  )) : (
                    trainerName ? (
                      <div style={{ 
                        display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', gap: '0.5rem', flex: 1
                      }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1rem' }}>👨‍🏫</div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>เทรนเนอร์</div>
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.2 }}>{trainerName || '-'}</div>
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                <button 
                  type="button"
                  onClick={() => setShowAddTrainerModal(true)}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', 
                    padding: '0.75rem', borderRadius: '12px', border: '1px dashed #3b82f6',
                    color: '#3b82f6', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', width: '100%',
                    marginBottom: '0.5rem'
                  }}
                >
                  + เพิ่มเทรนเนอร์
                </button>

                <div style={{ display: 'flex', gap: '0.5rem', width: '100%', alignItems: 'stretch' }}>
                  <button 
                    type="button"
                    className="btn-primary" 
                    style={{ flex: 1, width: '50%', margin: 0, padding: '0.75rem 0.25rem', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', backgroundColor: '#3b82f6', borderRadius: '12px', textAlign: 'center', border: '1px solid transparent', whiteSpace: 'nowrap', boxShadow: 'none' }}
                    onClick={() => setShowUploadModal(true)}
                  >
                    <span style={{ fontSize: '1.1rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>📸</span> ส่งภาพอาหาร
                  </button>
                  <button 
                    type="button"
                    style={{ position: 'relative', flex: 1, width: '50%', margin: 0, padding: '0.75rem 0.25rem', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', borderRadius: '12px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', textAlign: 'center', cursor: 'pointer', transition: 'background-color 0.2s', whiteSpace: 'nowrap' }}
                    onClick={handleViewCommentsClick}
                  >
                    {newCommentsCount > 0 && (
                      <div className="animate-shake" style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 5px rgba(239,68,68,0.5)',
                        zIndex: 10
                      }}>
                        {newCommentsCount > 9 ? '9+' : newCommentsCount}
                      </div>
                    )}
                    <span style={{ fontSize: '1.1rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>💬</span> ดูคอมเมนต์
                  </button>
                </div>
                
                <button 
                  type="button"
                  onClick={() => setShowFoodHistoryModal(true)}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', 
                    padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0',
                    color: '#475569', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', width: '100%'
                  }}
                >
                  🍽️ ดูประวัติอาหารทั้งหมด
                </button>

              </div>
            </div>
          )}

          {/* บันทึกค่าร่างกาย Button */}
          <button 
            type="button"
            onClick={() => navigate('/record-metrics')}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)', 
              padding: '1rem', borderRadius: '16px', border: 'none',
              color: '#fff', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', width: '100%',
              boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)',
              marginTop: '1rem', gap: '0.5rem'
            }}
          >
            🏋️‍♂️ บันทึกค่าร่างกาย
          </button>
        </div>

        {showUploadModal && profile?.userId && (
          <FoodUploadModal 
            traineeId={profile.userId} 
            trainerIds={trainersList.map(t => t.trainerId)} 
            onClose={() => setShowUploadModal(false)} 
          />
        )}
        {showLogsModal && profile?.userId && (
          <FoodLogsModal traineeId={profile.userId} onClose={() => setShowLogsModal(false)} />
        )}
        {showFoodHistoryModal && profile?.userId && (
          <FoodHistoryModal targetId={profile.userId} onClose={() => setShowFoodHistoryModal(false)} />
        )}
        {showAddTrainerModal && profile?.userId && (
          <AddTrainerModal 
            traineeId={profile.userId} 
            currentTrainerIds={trainersList.map(t => t.trainerId)}
            onClose={() => setShowAddTrainerModal(false)}
            onSuccess={() => {
              setShowAddTrainerModal(false);
              window.location.reload();
            }}
          />
        )}
        {showSupplementCourseModal && (
          <SupplementCourseModal
            onClose={() => setShowSupplementCourseModal(false)}
            isSuperadmin={reactiveAdminData?.status === 'superadmin'}
            currentTrainerId={profile?.userId || ''}
            trainees={trainees.filter(t => t?.userId).map(t => ({ userId: t.userId, nickname: t.nickname || t.lineName || 'ลูกเทรน', pictureUrl: t.pictureUrl }))}
          />
        )}
        </>
      );
    }

    return (
      <>
      <div className="form-container animate-fade-in-up">
        {/* Navigation & Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <button 
            type="button"
            className="btn-secondary" 
            onClick={() => {
              if (profile?.userId) sessionStorage.removeItem(`selectedTraineeId_${profile.userId}`);
              navigate('/', { state: { clearTrainee: true } });
            }}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', background: '#fff' }}
          >
            ← กลับ
          </button>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>บันทึกค่าร่างกาย</h2>
        </div>
        <p className="subtitle" style={{ marginBottom: '2rem' }}>กรอกค่าจากเครื่องชั่ง Tanita เพื่อติดตามพัฒนาการของลูกเทรน</p>

        {/* Trainee Name dropdown row */}
        <div className="form-row" style={{ marginBottom: '1.5rem' }}>
          {/* Name select / Trainee dropdown */}
          <div className="form-group" style={{ flex: '1', position: 'relative' }}>
            <label>ชื่อลูกเทรน (Name)</label>
            <div 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                padding: '0.65rem 1rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: '44px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {formData.name === '' && <span style={{ color: '#94a3b8' }}>เลือกลูกเทรน</span>}
                {formData.name === '__NEW_TRAINEE__' && <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>ลูกเทรนแบบกำหนดเอง</span>}
                {formData.name === '__SELF__' && <span>บันทึกค่าตัวเอง</span>}
                {formData.name !== '' && formData.name !== '__NEW_TRAINEE__' && formData.name !== '__SELF__' && (
                  <>
                    {selectedTrainee?.pictureUrl ? (
                      <img src={selectedTrainee.pictureUrl} alt="profile" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px' }}>👤</div>
                    )}
                    <span>{formData.name}</span>
                  </>
                )}
              </div>
              <span style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: '#64748b', fontSize: '0.8rem' }}>▼</span>
            </div>
  
            {dropdownOpen && (
              <>
                <div 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 98 }}
                  onClick={() => { setDropdownOpen(false); setSearchQuery(''); }}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  marginTop: '4px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 99,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ padding: '0.5rem', position: 'sticky', top: 0, background: '#fff', zIndex: 11, borderBottom: '1px solid #cbd5e1' }}>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', pointerEvents: 'none' }}>🔍</span>
                      <input 
                        type="text" 
                        placeholder="ค้นหาลูกเทรน..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 32px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div 
                    onClick={() => { handleChange({ target: { name: 'name', value: '__NEW_TRAINEE__' } } as any); setDropdownOpen(false); setSearchQuery(''); }}
                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: 'var(--primary)', fontWeight: 'bold', transition: 'background 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    ลูกเทรนแบบกำหนดเอง
                  </div>
                  <div 
                    onClick={() => { handleChange({ target: { name: 'name', value: '__SELF__' } } as any); setDropdownOpen(false); setSearchQuery(''); }}
                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    บันทึกค่าตัวเอง
                  </div>
                  {trainees.length === 0 && (
                    <div style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>ยังไม่มีลูกเทรน</div>
                  )}
                  {trainees.filter(t => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    const matchName = t.nickname && String(t.nickname).toLowerCase().includes(query);
                    const matchProvince = t.province && String(t.province).toLowerCase().includes(query);
                    const matchZone = t.zone && String(t.zone).toLowerCase().includes(query);
                    return matchName || matchProvince || matchZone;
                  }).map(t => {
                    const locs = [t.province, t.zone].filter(Boolean);
                    const locStr = locs.length > 0 ? ` (${locs.join(' - ')})` : '';
                    return (
                      <div 
                        key={t.userId}
                        onClick={() => handleSelectTrainee(t)}
                        style={{ 
                          padding: '0.75rem 1rem', 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem',
                          background: formData.name === t.nickname ? '#f1f5f9' : '#fff',
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => { if (formData.name !== t.nickname) e.currentTarget.style.background = '#f8fafc' }}
                        onMouseOut={(e) => { if (formData.name !== t.nickname) e.currentTarget.style.background = '#fff' }}
                      >
                        {t.pictureUrl ? (
                          <img src={t.pictureUrl} alt="profile" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px' }}>👤</div>
                        )}
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{t.nickname}</div>
                          {locStr && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{locStr}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
  
        {/* 4. Form starts here */}
        <form onSubmit={handleSubmit} className="metrics-form">

        {displayTrainee && (
          <div style={{ 
            background: 'rgba(59, 130, 246, 0.05)', 
            padding: '1.25rem', 
            borderRadius: '16px', 
            marginBottom: '1.5rem', 
            border: '1px solid rgba(59, 130, 246, 0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.03)',
            position: 'relative'
          }}>
            {selectedTrainee?.userId?.startsWith('manual_') && (
              <button
                type="button"
                onClick={() => setShowSyncModal(true)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                }}
                title="SYNC ข้อมูล"
              >
                <img src="/sync.png" alt="Sync" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
              </button>
            )}
            {/* Left side: Trainee Info & Location */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: '1 1 250px' }}>
              {/* Trainee profile header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {traineePic ? (
                  <img 
                    src={traineePic} 
                    alt="Trainee Profile" 
                    style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px' }}>👤</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1.05rem' }}>{traineeName}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {isSelf ? 'บันทึกข้อมูลของตัวเอง' : 'ลูกเทรน'}
                  </span>
                </div>
              </div>
              
              {/* Location details */}
              <div style={{ 
                margin: 0, 
                color: 'var(--text-main)', 
                fontSize: '0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                borderTop: '1px solid rgba(0,0,0,0.05)',
                paddingTop: '8px'
              }}>
                <div><strong>📍 จังหวัด:</strong> {displayTrainee.province || '-'}</div>
                <div><strong>🏠 โลเคชั่นที่อยู่ปัจจุบัน:</strong> {displayTrainee.zone || '-'}</div>
              </div>
            </div>

            {/* Right side: Action buttons stacked vertically */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: '1 1 180px', minWidth: '180px' }}>
              <button 
                type="button" 
                onClick={() => {
                  const targetId = isSelf ? profile?.userId : displayTrainee?.userId;
                  if (targetId) {
                    navigate(`/body-analysis/${targetId}`);
                  } else {
                    alert('ไม่พบข้อมูลรหัสผู้ใช้');
                  }
                }}
                className="btn-secondary" 
                style={{ 
                  padding: '0.5rem 1rem', 
                  fontSize: '0.85rem', 
                  margin: 0, 
                  width: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px',
                  borderColor: '#3b82f6',
                  color: '#3b82f6',
                  background: 'transparent'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                📸 อ่านค่าร่างกาย
              </button>

              {/* 2. ดูสถิติ (View statistics) */}
              {onViewStats && (
                <button 
                  type="button" 
                  onClick={() => onViewStats(isSelf ? profile?.userId : displayTrainee.userId, formData.name)}
                  className="btn-secondary" 
                  style={{ 
                    padding: '0.5rem 1rem', 
                    fontSize: '0.85rem', 
                    margin: 0, 
                    width: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '6px' 
                  }}
                >
                  📊 ดูสถิติ{isSelf ? 'ของตัวเอง' : ''}
                </button>
              )}

              {/* 3. คำนวณพลังงานและสารอาหาร (Calculate energy and nutrients) */}
              {!displayTrainee?.isGraduated && (
                <button 
                  type="button" 
                  onClick={() => {
                    const targetId = isSelf ? profile?.userId : displayTrainee?.userId;
                    if (targetId) {
                      navigate(`/calculator/${targetId}`);
                    } else {
                      alert('ไม่พบข้อมูลรหัสผู้ใช้');
                    }
                  }}
                  className="btn-primary" 
                  style={{ 
                    padding: '0.5rem 1rem', 
                    fontSize: '0.85rem', 
                    margin: 0, 
                    width: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '6px',
                    boxShadow: 'none'
                  }}
                >
                  🥗 คำนวณพลังงานและสารอาหาร
                </button>
              )}
            </div>
          </div>
        )}

        {selectedTrainee?.isGraduated ? (
          <div style={{ padding: '1.5rem', background: '#fef2f2', color: '#b91c1c', borderRadius: '12px', border: '1px solid #f87171', textAlign: 'center', marginTop: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>ลูกเทรนท่านนี้เป็นเทรนเนอร์แล้ว</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.8rem', marginTop: '0.8rem' }}>
              <span style={{ background: '#fee2e2', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 600 }}>
                สถานะ: {selectedTrainee.graduatedStatus === 'อนุมัติ' ? '✅ อนุมัติแล้ว' : '⏳ รออนุมัติ'}
              </span>
              {selectedTrainee.graduatedCode && selectedTrainee.graduatedCode !== '-' && (
                <span style={{ background: '#fee2e2', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 600 }}>
                  รหัสเทรนเนอร์: {selectedTrainee.graduatedCode}
                </span>
              )}
            </div>
            <p style={{ margin: 0 }}>คุณสามารถดูสถิติได้อย่างเดียว ไม่สามารถบันทึกค่าใหม่ได้</p>
          </div>
        ) : formData.name === '' ? (
          <div style={{ 
            padding: '2.5rem 1.5rem', 
            background: '#f8fafc', 
            color: '#64748b', 
            borderRadius: '16px', 
            border: '1px dashed #cbd5e1', 
            textAlign: 'center', 
            marginTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '2.5rem' }}>👥</span>
            <h4 style={{ margin: 0, color: '#475569', fontSize: '1.1rem' }}>ยังไม่ได้เลือกลูกเทรน</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>กรุณาเลือกชื่อลูกเทรนที่ต้องการบันทึกข้อมูลทางด้านบนก่อนครับ</p>
          </div>
        ) : (
          <>
            {((formData.name === '__SELF__') ||
              (formData.name !== '' &&
               formData.name !== '__NEW_TRAINEE__' &&
               selectedTrainee &&
               !selectedTrainee.isGraduated)) && (
              <button 
                type="button" 
                onClick={() => setShowImageOcrModal(true)}
                style={{
                  background: '#eff6ff',
                  color: '#3b82f6',
                  border: '1px dashed #3b82f6',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  justifyContent: 'center',
                  marginBottom: '1.5rem',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#dbeafe'}
                onMouseOut={(e) => e.currentTarget.style.background = '#eff6ff'}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span>📸 บันทึกค่าร่างกายจากรูปภาพ</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>(กรอกอัตโนมัติ)</span>
                </div>
              </button>
            )}
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
            <label>ระดับมวลกล้ามเนื้อ</label>
            <input type="number" name="physiqueRating" value={formData.physiqueRating} onChange={handleChange} required min="1" max="9" placeholder="ช่วง 1 - 9" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>อัตราการเผาผลาญ (kcal)</label>
            <input type="number" name="metabolicRate" value={formData.metabolicRate} onChange={handleChange} required placeholder="เช่น 1500" />
          </div>
          <div className="form-group">
            <label>อายุเซลล์ (Body Age)</label>
            <input type="number" name="bodyAge" value={formData.bodyAge} onChange={handleChange} required placeholder="เช่น 25" />
          </div>
        </div>

        <div className="form-row visceral-fat-row">
          <div className="form-group">
            <label>ระดับไขมันในช่องท้อง</label>
            <input type="number" name="visceralFat" value={formData.visceralFat} onChange={handleChange} required step="0.1" placeholder="เช่น 5" />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading || !isFormValid}>
          {loading ? 'กำลังบันทึกข้อมูล...' : 'บันทึกข้อมูล'}
        </button>
        </>
        )}
      </form>
      </div>
      
      {showManualRegister && profile && (
        <ManualTraineeForm 
          trainerId={profile.userId}
          onSuccess={(nickname, weight, height, age) => {
            setShowManualRegister(false);
            setFormData(prev => ({ 
              ...prev, 
              name: nickname,
              weight: weight,
              height: height,
              age: age
            }));
          }}
          onCancel={() => setShowManualRegister(false)}
        />
      )}

      {showImageOcrModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          overscrollBehavior: 'contain'
        }}>
          <div className="animate-fade-in-up" style={{
            background: '#fff', borderRadius: '24px', padding: '2rem',
            width: '100%', maxWidth: '450px', position: 'relative',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <button 
              type="button"
              onClick={() => {
                previews.forEach(url => URL.revokeObjectURL(url));
                setSelectedFiles([]);
                setPreviews([]);
                setShowImageOcrModal(false);
              }}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
            >
              &times;
            </button>
            
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span>บันทึกค่าร่างกายจากรูปภาพ</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>(กรอกอัตโนมัติ)</span>
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              อัปโหลดรูปภาพผลการวัดค่าร่างกาย (สามารถเลือกได้หลายรูป) เพื่อให้ AI วิเคราะห์และกรอกข้อมูลให้โดยอัตโนมัติ
            </p>

            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '2rem 1rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: '#f8fafc',
                marginBottom: '1.5rem',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📸</div>
              <div style={{ fontWeight: '600', color: '#475569', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                เลือกรูปภาพผลวัดค่าร่างกาย
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                รองรับรูปภาพหลายรูปพร้อมกัน
              </div>
              
              {selectedFiles.length > 0 && (
                <div style={{ marginTop: '1rem', background: '#eff6ff', padding: '0.5rem', borderRadius: '8px', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  เลือกแล้ว {selectedFiles.length} รูป
                </div>
              )}
            </div>

            <input 
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {previews.length > 0 && (
              <div style={{ 
                background: '#eff6ff', 
                border: '1px solid #bfdbfe', 
                borderRadius: '16px', 
                padding: '12px', 
                marginBottom: '1.5rem',
                display: 'flex', 
                gap: '10px', 
                overflowX: 'auto',
                scrollbarWidth: 'thin'
              }}>
                {previews.map((src, index) => (
                  <div key={index} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #3b82f6', flexShrink: 0 }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      style={{
                        position: 'absolute', top: '4px', right: '4px',
                        background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                        width: '20px', height: '20px', color: '#fff', fontSize: '11px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {ocrError && (
              <div style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fee2e2', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                {ocrError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  previews.forEach(url => URL.revokeObjectURL(url));
                  setSelectedFiles([]);
                  setPreviews([]);
                  setShowImageOcrModal(false);
                }}
                disabled={processingOcr}
                style={{ width: 'auto', margin: 0, padding: '0.5rem 1.25rem' }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleProcessOcr}
                disabled={processingOcr || selectedFiles.length === 0}
                style={{ width: 'auto', margin: 0, padding: '0.5rem 1.25rem', background: 'var(--primary)', border: 'none' }}
              >
                {processingOcr ? 'กำลังประมวลผล...' : '⚙️ ประมวลผลภาพ'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showSuccessOcr && <SuccessPopup show={showSuccessOcr} message="ประมวลผลสำเร็จ" />}

      {showSyncModal && selectedTrainee && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          overscrollBehavior: 'contain'
        }}>
          <div className="animate-fade-in-up" style={{
            background: '#fff', borderRadius: '24px', padding: '2rem',
            width: '100%', maxWidth: '500px', position: 'relative',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <button 
              type="button"
              onClick={() => {
                setShowSyncModal(false);
                setSyncSearchQuery('');
              }}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
            >
              &times;
            </button>
            
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <img src="/sync.png" alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
              SYNC ข้อมูล
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              เลือกรายชื่อลูกเทรนเพื่อโอนย้ายข้อมูลของ<br />
              <strong style={{ color: '#78350f' }}>{selectedTrainee.nickname}</strong> ไปยังคนนั้น
            </p>

            <input 
              type="text" 
              placeholder="ค้นหาชื่อ, จังหวัด, หรือ โลเคชั่น..." 
              value={syncSearchQuery}
              onChange={e => setSyncSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', marginBottom: '15px', boxSizing: 'border-box' }}
            />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
              {syncTraineesList.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '10px' }}>
                  ไม่พบรายชื่อลูกเทรนที่สามารถ SYNC ได้
                </div>
              ) : (
                syncTraineesList.map(t => {
                  const locationLabel = [t.zone, t.province].filter(Boolean).join(', ') || '-';
                  return (
                    <div key={t.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                        {t.pictureUrl ? (
                          <img src={t.pictureUrl} alt="profile" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>👤</div>
                        )}
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 'bold', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{t.nickname}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            📍 {locationLabel}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingSyncTarget(t)}
                        disabled={syncingTraineeId === t.userId}
                        style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '20px', fontSize: '0.9rem', cursor: 'pointer', opacity: syncingTraineeId === t.userId ? 0.7 : 1, flexShrink: 0, marginLeft: '10px' }}
                      >
                        {syncingTraineeId === t.userId ? '...' : 'เลือก'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Sync Confirm Dialog */}
      {pendingSyncTarget && selectedTrainee && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 11000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          overscrollBehavior: 'contain'
        }}>
          <div className="animate-fade-in-up" style={{
            background: '#fff', borderRadius: '24px', padding: '2rem',
            width: '100%', maxWidth: '420px', position: 'relative',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            textAlign: 'center'
          }}>
            <img src="/sync.png" alt="Sync" style={{ width: '60px', height: '60px', objectFit: 'contain', marginBottom: '1rem' }} />
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1.3rem', fontWeight: 'bold' }}>
              ยืนยันการโอนย้ายข้อมูล
            </h3>
            
            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.6', margin: '0 0 1.5rem 0' }}>
              คุณต้องการโอนย้ายข้อมูลทั้งหมดของ<br />
              <strong style={{ color: 'var(--primary)' }}>{selectedTrainee.nickname}</strong><br />
              ไปยัง <strong style={{ color: '#166534' }}>{pendingSyncTarget.nickname}</strong><br />
              ใช่หรือไม่
            </p>
            
            <div style={{ 
              background: '#fffeb2', 
              border: '1px solid #eab308', 
              borderRadius: '12px', 
              padding: '10px 14px', 
              color: '#854d0e', 
              fontSize: '0.85rem', 
              textAlign: 'left',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
              marginBottom: '1.5rem'
            }}>
              <span style={{ fontSize: '1.1rem' }}>⚠️</span>
              <div style={{ lineHeight: '1.5' }}>
                <strong>ข้อควรระวัง:</strong><br />
                การดำเนินการนี้จะลบ<br />
                <strong>{selectedTrainee.nickname}</strong><br />
                ออกจากระบบอย่างถาวร
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPendingSyncTarget(null)}
                style={{ flex: 1, margin: 0, padding: '0.65rem 1rem', borderRadius: '12px', borderColor: '#cbd5e1', color: '#475569', fontWeight: 'bold' }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const target = pendingSyncTarget;
                  setPendingSyncTarget(null);
                  handleSyncData(target);
                }}
                style={{ flex: 1, margin: 0, padding: '0.65rem 1rem', borderRadius: '12px', background: '#ff9800', border: 'none', color: '#fff', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(100, 116, 139, 0.4)' }}
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-fading Success Popup */}
      {showSuccessSync && (
        <SuccessPopup show={showSuccessSync} message="โอนย้ายข้อมูลสำเร็จ" />
      )}

      {showUploadModal && queryId && (
        <FoodUploadModal 
          traineeId={queryId} 
          trainerIds={selectedTrainee ? (selectedTrainee.trainerIds || []) : trainersList.map(t => t.trainerId)} 
          onClose={() => setShowUploadModal(false)} 
        />
      )}
      {showLogsModal && queryId && (
        <FoodLogsModal traineeId={queryId} onClose={() => setShowLogsModal(false)} />
      )}
      {showAddTrainerModal && queryId && (
        <AddTrainerModal 
          traineeId={queryId} 
          currentTrainerIds={selectedTrainee ? (selectedTrainee.trainerIds || []) : trainersList.map(t => t.trainerId)}
          onClose={() => setShowAddTrainerModal(false)}
          onSuccess={() => {
            setShowAddTrainerModal(false);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}

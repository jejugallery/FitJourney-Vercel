import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import EditAppointmentModal from './EditAppointmentModal';
import liff from '@line/liff';
import SuccessPopup from './SuccessPopup';
import { isVideoUrl, getMediaFlexUrl, getMediaThumbnailUrl, getMediaVideoLoopUrl } from '../utils/mediaHelper';

interface AppointmentDetailModalProps {
  appointmentId: string;
  initialAppointmentData?: any;
  onClose: () => void;
  userId: string;
  role: string; // 'superadmin' | 'trainer' | 'trainee'
  invitations: any[];
}

export default function AppointmentDetailModal({ appointmentId, initialAppointmentData, onClose, userId, role, invitations }: AppointmentDetailModalProps) {
  const [appointmentData, setAppointmentData] = useState<any>(initialAppointmentData || null);
  const [creatorData, setCreatorData] = useState<any>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [loading, setLoading] = useState(!initialAppointmentData);
  
  const [showInviteSection, setShowInviteSection] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [potentialInvitees, setPotentialInvitees] = useState<any[]>([]);
  const [inviting, setInviting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const [allAppointmentInvitations, setAllAppointmentInvitations] = useState<any[]>([]);

  useEffect(() => {
    const fetchAppointment = async () => {
      try {
        let currentAppointment = appointmentData;
        if (!currentAppointment) {
          const docRef = doc(db, 'appointments', appointmentId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            currentAppointment = docSnap.data();
            setAppointmentData(currentAppointment);
          }
        }
        
        if (currentAppointment && currentAppointment.createdBy) {
          const q = query(collection(db, 'trainers'), where('trainerId', '==', currentAppointment.createdBy));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setCreatorData(snap.docs[0].data());
          }
        }

        // Fetch current user's profile
        if (userId) {
          const trainerQ = query(collection(db, 'trainers'), where('trainerId', '==', userId));
          const trainerSnap = await getDocs(trainerQ);
          if (!trainerSnap.empty) {
            setCurrentUserData(trainerSnap.docs[0].data());
          } else {
            const traineeQ = query(collection(db, 'trainees'), where('userId', '==', userId));
            const traineeSnap = await getDocs(traineeQ);
            if (!traineeSnap.empty) {
              setCurrentUserData(traineeSnap.docs[0].data());
            }
          }
        }
        
        // Fetch all invitations for this appointment
        const invQ = query(collection(db, 'appointmentInvitations'), where('appointmentId', '==', appointmentId));
        const invSnap = await getDocs(invQ);
        const invList = invSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        
        // Enrich invitations with user info
        const enrichedInvList = await Promise.all(invList.map(async (inv) => {
          if (!inv.inviteeName) {
            try {
              const collectionName = inv.role === 'trainer' ? 'trainers' : 'trainees';
              const idField = inv.role === 'trainer' ? 'trainerId' : 'userId';
              const userQ = query(collection(db, collectionName), where(idField, '==', inv.inviteeId));
              const userSnap = await getDocs(userQ);
              
              if (!userSnap.empty) {
                const userData = userSnap.docs[0].data();
                return {
                  ...inv,
                  inviteeName: userData.nickname || userData.displayName || 'ไม่มีชื่อ',
                  inviteePhoto: userData.pictureUrl || '',
                  inviteeProvince: userData.province || '',
                  inviteeZone: userData.zone || '',
                  inviteeStatus: userData.status || ''
                };
              }
            } catch (err) {
              console.error("Error enriching invitee:", err);
            }
          }
          return inv;
        }));
        setAllAppointmentInvitations(enrichedInvList);
        
        // Mark as viewed if not already
        const myInv = enrichedInvList.find(inv => inv.inviteeId === userId);
        if (myInv && !myInv.viewed) {
          updateDoc(doc(db, 'appointmentInvitations', myInv.id), { viewed: true }).catch(console.error);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointment();
  }, [appointmentId]);

  const fetchAppointmentData = async () => {
    try {
      const docRef = doc(db, 'appointments', appointmentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAppointmentData(data);
        
        if (data.createdBy) {
          const q = query(collection(db, 'trainers'), where('trainerId', '==', data.createdBy));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setCreatorData(snap.docs[0].data());
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadInvitees = async () => {
    setShowInviteSection(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    
    if (potentialInvitees.length > 0) return;

    try {
      // Fetch all approved/superadmin trainers first to identify who has upgraded
      const trainersQ = query(collection(db, 'trainers'), where('status', 'in', ['อนุมัติ', 'superadmin']));
      const trainersSnap = await getDocs(trainersQ);
      const tList = trainersSnap.docs.map(d => ({ ...d.data(), userType: 'trainer' }));
      const approvedTrainerIds = new Set(tList.map((t: any) => t.trainerId || t.userId).filter(Boolean));

      if (role === 'superadmin') {
        const traineesSnap = await getDocs(collection(db, 'trainees'));
        const trList = traineesSnap.docs
          .map(d => ({ ...d.data(), userType: 'trainee' }))
          .filter((t: any) => !t.userId?.startsWith('manual_'))
          .filter((t: any) => !approvedTrainerIds.has(t.userId)); // Exclude trainees who are already approved trainers
        
        setPotentialInvitees([...tList, ...trList]);
      } else if (role === 'trainer') {
        const traineesQ = query(collection(db, 'trainees'), where('trainerIds', 'array-contains', userId));
        const traineesSnap = await getDocs(traineesQ);
        const trList = traineesSnap.docs
          .map(d => {
            const data = d.data();
            const isTrainer = approvedTrainerIds.has(data.userId);
            return {
              ...data,
              userType: isTrainer ? 'trainer' : 'trainee',
              status: isTrainer ? 'อนุมัติ' : (data.status || '')
            };
          })
          .filter((t: any) => !t.userId?.startsWith('manual_'));
        
        setPotentialInvitees(trList);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInvite = async (invitee: any) => {
    const targetId = invitee.userId || invitee.trainerId;
    if (!targetId) return;

    setInviting(targetId);
    try {
      await addDoc(collection(db, 'appointmentInvitations'), {
        appointmentId,
        inviterId: userId,
        inviteeId: targetId,
        role: invitee.userType,
        inviteeStatus: invitee.status || '',
        status: 'pending',
        inviteeName: invitee.nickname || invitee.displayName || 'ไม่มีชื่อ',
        inviteePhoto: invitee.pictureUrl || '',
        inviteeProvince: invitee.province || '',
        inviteeZone: invitee.zone || '',
        createdAt: serverTimestamp()
      });

      if (invitee.userType === 'trainer') {
        await updateDoc(doc(db, 'appointments', appointmentId), {
          invitedTrainers: arrayUnion(targetId)
        });
      }

      setAllAppointmentInvitations(prev => [...prev, { 
        inviteeId: targetId,
        status: 'pending',
        inviteeName: invitee.nickname || invitee.displayName || 'ไม่มีชื่อ',
        inviteePhoto: invitee.pictureUrl || '',
        inviteeProvince: invitee.province || '',
        inviteeZone: invitee.zone || '',
        role: invitee.userType,
        inviteeStatus: invitee.status || ''
      }]);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชิญ');
    } finally {
      setInviting(null);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!window.confirm('คุณต้องการลบการนัดหมายนี้ใช่หรือไม่?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', appointmentId));
      
      const invQ = query(collection(db, 'appointmentInvitations'), where('appointmentId', '==', appointmentId));
      const invSnap = await getDocs(invQ);
      for (const d of invSnap.docs) {
        await deleteDoc(doc(db, 'appointmentInvitations', d.id));
      }
      
      onClose();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการลบการนัดหมาย');
    }
  };

  const handleAcceptOrJoin = async () => {
    try {
      if (currentUserInv?.id) {
        await updateDoc(doc(db, 'appointmentInvitations', currentUserInv.id), { status: 'accepted' });
        setAllAppointmentInvitations(prev => prev.map(inv => 
          inv.id === currentUserInv.id ? { ...inv, status: 'accepted' } : inv
        ));
      } else {
        const docRef = await addDoc(collection(db, 'appointmentInvitations'), {
          appointmentId,
          inviterId: appointmentData.createdBy || userId,
          inviteeId: userId,
          role: role === 'superadmin' ? 'trainer' : role,
          inviteeStatus: currentUserData?.status || (role === 'superadmin' ? 'superadmin' : ''),
          status: 'accepted',
          inviteeName: currentUserData?.nickname || currentUserData?.displayName || 'แอดมิน',
          inviteePhoto: currentUserData?.pictureUrl || '',
          inviteeProvince: currentUserData?.province || '',
          inviteeZone: currentUserData?.zone || '',
          createdAt: serverTimestamp(),
          viewed: true
        });
        
        setAllAppointmentInvitations(prev => [...prev, {
          id: docRef.id,
          appointmentId,
          inviterId: appointmentData.createdBy || userId,
          inviteeId: userId,
          role: role === 'superadmin' ? 'trainer' : role,
          inviteeStatus: currentUserData?.status || (role === 'superadmin' ? 'superadmin' : ''),
          status: 'accepted',
          inviteeName: currentUserData?.nickname || currentUserData?.displayName || 'แอดมิน',
          inviteePhoto: currentUserData?.pictureUrl || '',
          inviteeProvince: currentUserData?.province || '',
          inviteeZone: currentUserData?.zone || '',
          viewed: true
        }]);
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเข้าร่วมนัดหมาย');
    }
  };

  const handleAddToCalendar = () => {
    const params = new URLSearchParams({
      name: appointmentData?.name || 'นัดหมาย',
      startDatetimeIso: appointmentData?.startDatetimeIso || '',
      endDatetimeIso: appointmentData?.endDatetimeIso || '',
      description: appointmentData?.description || '',
      location: appointmentData?.location || '',
    });
    const url = `${window.location.origin}/download-ics?${params.toString()}`;
    if ((window as any).liff && (window as any).liff.openWindow) {
      (window as any).liff.openWindow({ url, external: true });
    } else {
      window.open(url, '_blank');
    }
  };

  const handleShareToLine = async () => {
    try {
      if (!liff.isApiAvailable('shareTargetPicker')) {
        alert('อุปกรณ์นี้ไม่รองรับการแชร์ข้อความผ่าน LINE (shareTargetPicker)');
        return;
      }

      const DEFAULT_EVENT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/fitjourneythailand.appspot.com/o/default-event.png?alt=media";
      const isSameDay = appointmentData.startDatetimeIso && appointmentData.endDatetimeIso &&
        appointmentData.startDatetimeIso.substring(0, 10) === appointmentData.endDatetimeIso.substring(0, 10);
      const endPart = isSameDay
        ? appointmentData.endDatetimeDisplay.split(',')[1] || appointmentData.endDatetimeDisplay
        : appointmentData.endDatetimeDisplay;
      const datetimeString = appointmentData.datetime + (appointmentData.endDatetimeDisplay ? ` - ${endPart}` : '');

      const bodyContents: any[] = [
        {
          type: 'box',
          layout: 'horizontal',
          alignItems: 'center',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '🤝 เรามีนัดกันนะ',
                  size: 'xs',
                  color: '#ffffff',
                  weight: 'bold',
                  align: 'center'
                }
              ],
              backgroundColor: '#ef4444', // Red color for appointments badge
              paddingAll: '6px',
              paddingStart: '12px',
              paddingEnd: '12px',
              cornerRadius: '20px',
              flex: 0
            },
            {
              type: 'filler'
            },
            {
              type: 'image',
              url: 'https://cdn-icons-png.flaticon.com/512/9513/9513588.png',
              size: '24px',
              aspectRatio: '1:1',
              flex: 0,
              action: {
                type: 'uri',
                label: 'Share',
                uri: `https://liff.line.me/2010284484-Mahx0Ao8?appointmentId=${appointmentId}`
              }
            }
          ]
        },
        {
          type: 'text',
          text: appointmentData.name || 'นัดหมายใหม่',
          weight: 'bold',
          size: 'xl',
          color: '#1e293b',
          margin: 'md',
          wrap: true
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              spacing: 'sm',
              alignItems: 'center',
              contents: [
                {
                  type: 'text',
                  text: '🕒',
                  size: 'sm',
                  flex: 0
                },
                {
                  type: 'text',
                  text: datetimeString || '-',
                  size: 'sm',
                  color: '#475569',
                  wrap: true,
                  flex: 1
                }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              spacing: 'sm',
              alignItems: 'center',
              contents: [
                {
                  type: 'text',
                  text: '📍',
                  size: 'sm',
                  flex: 0
                },
                {
                  type: 'text',
                  text: appointmentData.location || '-',
                  size: 'sm',
                  color: '#475569',
                  wrap: true,
                  flex: 1
                }
              ]
            }
          ]
        }
      ];

      if (appointmentData.description) {
        bodyContents.push(
          { type: 'separator', margin: 'lg' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            contents: [
              {
                type: 'text',
                text: appointmentData.description,
                size: 'sm',
                color: '#334155',
                wrap: true
              }
            ]
          }
        );
      }

      const bubble: any = {
        type: 'bubble',
        hero: isVideoUrl(appointmentData.imageUrl) ? {
          type: 'video',
          url: getMediaVideoLoopUrl(appointmentData.imageUrl),
          previewUrl: getMediaThumbnailUrl(appointmentData.imageUrl),
          altContent: {
            type: 'image',
            size: 'full',
            aspectRatio: '16:9',
            aspectMode: 'cover',
            url: getMediaThumbnailUrl(appointmentData.imageUrl)
          },
          aspectRatio: '16:9'
        } : {
          type: 'image',
          url: getMediaFlexUrl(appointmentData.imageUrl) || DEFAULT_EVENT_IMAGE,
          size: 'full',
          aspectRatio: '16:9',
          aspectMode: 'cover'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          contents: bodyContents
        }
      };

      // Link directly to the external download-ics page which forces Chrome/Safari open
      let buttonLabel = 'เพิ่มลงบนปฏิทิน';
      let buttonColor = '#3b82f6';
      const calendarParams = new URLSearchParams({
        name: (appointmentData.name || 'นัดหมาย').substring(0, 100),
        startDatetimeIso: appointmentData.startDatetimeIso || '',
        endDatetimeIso: appointmentData.endDatetimeIso || '',
        description: (appointmentData.description || '').substring(0, 150),
        location: (appointmentData.location || '').substring(0, 150),
        openExternalBrowser: '1',
      });
      let buttonUri = `https://fitjourneythailand.web.app/download-ics?${calendarParams.toString()}`;

      if (appointmentData.linkType === 'zoom' && appointmentData.linkUrl) {
        buttonLabel = 'เข้าผ่าน Zoom';
        buttonColor = '#2d8cff';
        buttonUri = appointmentData.linkUrl.trim();
      } else if (appointmentData.linkType === 'google_map' && appointmentData.linkUrl) {
        buttonLabel = 'เปิดแผนที่ 🗺️';
        buttonColor = '#22c55e';
        buttonUri = appointmentData.linkUrl.trim();
      }

      // Add the button to the footer
      bubble.footer = {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: buttonColor,
            cornerRadius: '30px',
            paddingAll: '10px',
            action: {
              type: 'uri',
              label: buttonLabel,
              uri: buttonUri
            },
            contents: [
              {
                type: 'text',
                text: buttonLabel,
                color: '#ffffff',
                weight: 'bold',
                size: 'sm',
                align: 'center'
              }
            ]
          }
        ],
        flex: 0
      };

      const flexMsg = {
        type: 'flex',
        altText: `เรามีนัดกันนะ: ${appointmentData.name}`,
        contents: bubble
      };

      const res = await liff.shareTargetPicker([flexMsg as any]);
      if (res) {
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 2000);
      }
    } catch (error) {
      console.error('Error sharing appointment:', error);
      alert('เกิดข้อผิดพลาดในการแชร์นัดหมาย');
    }
  };

  if (loading || !appointmentData) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '16px' }}>กำลังโหลด...</div>
      </div>
    );
  }

  const myInvFromProps = invitations && invitations.length > 0 ? invitations[0] : null;
  const currentUserInv = allAppointmentInvitations.find(inv => inv.inviteeId === userId) || myInvFromProps;

  const isCreator = appointmentData?.createdBy === userId;
  const isSuperadmin = role === 'superadmin';
  const isTrainer = role === 'trainer';

  const isAccepted = currentUserInv?.status === 'accepted' || isCreator;

  const pendingInvitations = allAppointmentInvitations.filter(inv => inv.status === 'pending' && inv.inviteeId !== appointmentData.createdBy);
  let acceptedInvitations = allAppointmentInvitations.filter(inv => inv.status === 'accepted');

  const creatorInvitation = creatorData ? {
    inviteeId: appointmentData.createdBy,
    inviteeName: creatorData.nickname || creatorData.displayName || 'ผู้สร้างนัดหมาย',
    inviteePhoto: creatorData.pictureUrl || '',
    inviteeProvince: creatorData.province || '',
    inviteeZone: creatorData.zone || '',
    role: 'trainer',
    status: 'accepted'
  } : null;

  if (creatorInvitation && !acceptedInvitations.some(inv => inv.inviteeId === appointmentData.createdBy)) {
    acceptedInvitations = [creatorInvitation, ...acceptedInvitations];
  }

  const invitedSet = new Set(allAppointmentInvitations.map(inv => inv.inviteeId));
  if (appointmentData.createdBy) {
    invitedSet.add(appointmentData.createdBy);
  }

  const showAcceptButton = 
    ((isTrainer || role === 'trainee') && !isCreator && !isAccepted && currentUserInv) ||
    (isSuperadmin && !isCreator && !isAccepted);

  const showInviteButton = (isSuperadmin || isTrainer) && isAccepted;

  const availableInvitees = potentialInvitees.filter(person => {
    const id = person.userId || person.trainerId;
    if (!id) return false;
    if (id === userId) return false;
    if (invitedSet.has(id)) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const name = (person.nickname || person.displayName || '').toLowerCase();
      const prov = (person.province || '').toLowerCase();
      const zone = (person.zone || '').toLowerCase();
      const roleLabel = person.status === 'superadmin' ? 'ซูเปอร์แอดมิน' : (person.userType === 'trainer' ? 'เทรนเนอร์' : 'ลูกเทรน');
      return name.includes(term) || prov.includes(term) || zone.includes(term) || roleLabel.includes(term);
    }
    return true;
  });

  const alreadyInvitedInvitees = potentialInvitees.filter(person => {
    const id = person.userId || person.trainerId;
    if (!id) return false;
    if (id === userId) return false;
    if (!invitedSet.has(id)) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const name = (person.nickname || person.displayName || '').toLowerCase();
      const prov = (person.province || '').toLowerCase();
      const zone = (person.zone || '').toLowerCase();
      const roleLabel = person.status === 'superadmin' ? 'ซูเปอร์แอดมิน' : (person.userType === 'trainer' ? 'เทรนเนอร์' : 'ลูกเทรน');
      return name.includes(term) || prov.includes(term) || zone.includes(term) || roleLabel.includes(term);
    }
    return true;
  });

  const modalContent = (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 20000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '600px',
        maxHeight: '90vh', overflowY: 'auto', position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 2, display: 'flex', gap: '8px' }}>
          {isCreator && (
            <button 
              onClick={() => setShowEditModal(true)}
              style={{ background: 'rgba(255,255,255,0.85)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="แก้ไขนัดหมาย"
            >
              ✏️
            </button>
          )}
          {(isCreator || isSuperadmin) && (
            <button 
              onClick={handleDeleteAppointment}
              style={{ background: 'rgba(255,255,255,0.85)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="ลบนัดหมาย"
            >
              🗑️
            </button>
          )}
        </div>

        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(255,255,255,0.85)', color: '#dc2626', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, fontSize: '1.4rem', fontWeight: 'bold' }}
        >
          ✕
        </button>

        {appointmentData.imageUrl && (
          isVideoUrl(appointmentData.imageUrl) ? (
            <video src={appointmentData.imageUrl} autoPlay muted loop playsInline style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
          ) : (
            <img src={appointmentData.imageUrl} alt={appointmentData.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
          )
        )}

        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 10px 0', color: 'var(--text-main)', fontSize: '1.8rem' }}>{appointmentData.name}</h2>
          
          {creatorData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
              {creatorData.pictureUrl ? (
                <img src={creatorData.pictureUrl} alt="creator" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px' }}>👤</div>
              )}
              <span style={{ fontSize: '0.95rem', color: '#64748b' }}>
                นัดหมายโดย <strong style={{ color: 'var(--text-main)' }}>{creatorData.nickname || creatorData.displayName || 'แอดมิน'}</strong>
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '1rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🕒</span> {appointmentData.datetime} {appointmentData.endDatetimeDisplay && (
                (appointmentData.startDatetimeIso && appointmentData.endDatetimeIso && appointmentData.startDatetimeIso.substring(0, 10) === appointmentData.endDatetimeIso.substring(0, 10))
                  ? ` - ${appointmentData.endDatetimeDisplay.split(',')[1] || appointmentData.endDatetimeDisplay}`
                  : ` - ${appointmentData.endDatetimeDisplay}`
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '1rem' }}>
              <span style={{ fontSize: '1.2rem' }}>📍</span> {appointmentData.location}
            </div>
          </div>

          {appointmentData.description && (
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', color: '#334155', lineHeight: '1.6', marginBottom: '24px', whiteSpace: 'pre-wrap' }}>
              {appointmentData.description}
            </div>
          )}

          {/* Accepted Invitations */}
          {acceptedInvitations.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontSize: '0.9rem' }}>✅ ยืนยันนัดหมายแล้ว</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '4px' }}>
                {acceptedInvitations.map(inv => (
                  <div key={inv.inviteeId} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f0fdf4', padding: '4px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                    {inv.inviteePhoto ? (
                      <img src={inv.inviteePhoto} alt="profile" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', flexShrink: 0 }}>👤</div>
                    )}
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 'bold', color: '#166534', fontSize: '0.7rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{inv.inviteeName || 'ไม่มีชื่อ'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Invitations */}
          {role !== 'trainee' && pendingInvitations.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontSize: '0.9rem' }}>⏳ รอตอบรับนัดหมาย</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '4px' }}>
                {pendingInvitations.map(inv => (
                  <div key={inv.inviteeId} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fffbeb', padding: '4px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                    {inv.inviteePhoto ? (
                      <img src={inv.inviteePhoto} alt="profile" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fcd34d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px', flexShrink: 0 }}>👤</div>
                    )}
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 'bold', color: '#b45309', fontSize: '0.7rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{inv.inviteeName || 'ไม่มีชื่อ'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              {showAcceptButton && (
                <button 
                  onClick={handleAcceptOrJoin}
                  style={{ flex: 1, padding: '12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  ✅ ตอบรับการนัดหมาย
                </button>
              )}
              {showInviteButton && !showInviteSection && (
                <button 
                  onClick={handleLoadInvitees}
                  style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  + เชิญนัดหมาย
                </button>
              )}
            </div>
            {(isAccepted || isCreator) && appointmentData?.startDatetimeIso && (
              <button
                onClick={handleAddToCalendar}
                style={{ width: '100%', padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                📅 เพิ่มลงปฏิทิน
              </button>
            )}
            <button
              onClick={handleShareToLine}
              style={{ width: '100%', padding: '12px', background: '#06C755', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              💬 แชร์นัดหมายไปยัง LINE
            </button>
          </div>

          {showInviteSection && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
              <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-main)' }}>เชิญนัดหมาย</h3>
              
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="ค้นหาชื่อ, จังหวัด, หรือ โลเคชั่น..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', marginBottom: '15px', boxSizing: 'border-box' }}
              />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                {availableInvitees.length === 0 && alreadyInvitedInvitees.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '10px' }}>ไม่พบรายชื่อที่สามารถเชิญได้</div>
                )}
                {availableInvitees.map(person => {
                  const id = person.userId || person.trainerId;
                  const name = person.nickname || person.displayName || 'ไม่มีชื่อ';
                  const roleLabel = person.status === 'superadmin' ? 'ซูเปอร์แอดมิน' : (person.userType === 'trainer' ? 'เทรนเนอร์' : 'ลูกเทรน');
                  const locationLabel = [person.zone, person.province].filter(Boolean).join(', ') || '-';

                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                        {person.pictureUrl ? (
                          <img src={person.pictureUrl} alt="profile" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>👤</div>
                        )}
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 'bold', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{roleLabel}</span> • 📍 {locationLabel}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleInvite(person)}
                        disabled={inviting === id}
                        style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '20px', fontSize: '0.9rem', cursor: 'pointer', opacity: inviting === id ? 0.7 : 1, flexShrink: 0, marginLeft: '10px' }}
                      >
                        {inviting === id ? '...' : 'เชิญ'}
                      </button>
                    </div>
                  );
                })}

                {alreadyInvitedInvitees.length > 0 && (
                  <>
                    {availableInvitees.length > 0 && (
                      <div style={{ borderTop: '1px dashed #e2e8f0', margin: '4px 0' }} />
                    )}
                    {alreadyInvitedInvitees.map(person => {
                      const id = person.userId || person.trainerId;
                      const name = person.nickname || person.displayName || 'ไม่มีชื่อ';
                      const roleLabel = person.status === 'superadmin' ? 'ซูเปอร์แอดมิน' : (person.userType === 'trainer' ? 'เทรนเนอร์' : 'ลูกเทรน');
                      const locationLabel = [person.zone, person.province].filter(Boolean).join(', ') || '-';
                      const inv = allAppointmentInvitations.find(i => i.inviteeId === id);
                      const isAcceptedInv = inv?.status === 'accepted';

                      return (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: isAcceptedInv ? '#f0fdf4' : '#fffbeb', borderRadius: '12px', border: `1px solid ${isAcceptedInv ? '#bbf7d0' : '#fde68a'}`, opacity: 0.85 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                            {person.pictureUrl ? (
                              <img src={person.pictureUrl} alt="profile" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>👤</div>
                            )}
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontWeight: 'bold', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{name}</div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{roleLabel}</span> • 📍 {locationLabel}
                              </div>
                            </div>
                          </div>
                          <span style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            flexShrink: 0,
                            marginLeft: '10px',
                            background: isAcceptedInv ? '#dcfce7' : '#fef9c3',
                            color: isAcceptedInv ? '#166534' : '#854d0e',
                            border: `1px solid ${isAcceptedInv ? '#86efac' : '#fde047'}`
                          }}>
                            {isAcceptedInv ? '✅ ตอบรับแล้ว' : '⏳ ถูกเชิญแล้ว'}
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {showEditModal && (
        <EditAppointmentModal 
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchAppointmentData();
          }}
          appointment={{ id: appointmentId, ...appointmentData }}
        />
      )}
      <SuccessPopup show={showSuccessPopup} message="แชร์นัดหมายเรียบร้อยแล้ว" />
    </div>
  );

  return createPortal(modalContent, document.body);
}

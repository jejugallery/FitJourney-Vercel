import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import EditEventModal from './EditEventModal';
import { isVideoUrl } from '../utils/mediaHelper';
import { eventsApi, eventInvitationsApi } from '../utils/api';

const getEventDateText = (ev: any): string => {
  if (ev.startDatetimeIso && ev.endDatetimeIso && ev.startDatetimeIso.substring(0, 10) !== ev.endDatetimeIso.substring(0, 10)) {
    const d1 = new Date(ev.startDatetimeIso);
    const d2 = new Date(ev.endDatetimeIso);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      const opt: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
      return `${d1.toLocaleDateString('th-TH', opt)} - ${d2.toLocaleDateString('th-TH', opt)}`;
    }
  }
  
  const endPart = ev.endDatetimeDisplay
    ? ((ev.startDatetimeIso && ev.endDatetimeIso && ev.startDatetimeIso.substring(0, 10) === ev.endDatetimeIso.substring(0, 10))
      ? (ev.endDatetimeDisplay.split(',')[1] || ev.endDatetimeDisplay)
      : ev.endDatetimeDisplay)
    : '';
  return ev.datetime + (endPart ? ` - ${endPart}` : '');
};

interface EventDetailModalProps {
  eventId: string;
  initialEventData?: any;
  onClose: () => void;
  userId: string;
  role: string; // 'superadmin' | 'trainer' | 'trainee'
  invitations: any[];
}

export default function EventDetailModal({ eventId, initialEventData, onClose, userId, role, invitations }: EventDetailModalProps) {
  const [eventData, setEventData] = useState<any>(initialEventData || null);
  const [creatorData, setCreatorData] = useState<any>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [loading, setLoading] = useState(!initialEventData);
  
  const [showInviteSection, setShowInviteSection] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [potentialInvitees, setPotentialInvitees] = useState<any[]>([]);
  const [inviting, setInviting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const [allEventInvitations, setAllEventInvitations] = useState<any[]>([]);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        let currentEvent = eventData;
        if (!currentEvent) {
          currentEvent = await eventsApi.get(eventId);
          setEventData(currentEvent);
        }
        
        if (currentEvent && currentEvent.createdBy) {
          const q = query(collection(db, 'trainers'), where('trainerId', '==', currentEvent.createdBy));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setCreatorData(snap.docs[0].data());
          }
        }

        // Fetch current user's (inviter) profile
        if (userId) {
          // Try trainers first
          const trainerQ = query(collection(db, 'trainers'), where('trainerId', '==', userId));
          const trainerSnap = await getDocs(trainerQ);
          if (!trainerSnap.empty) {
            setCurrentUserData(trainerSnap.docs[0].data());
          } else {
            // Try trainees
            const traineeQ = query(collection(db, 'trainees'), where('userId', '==', userId));
            const traineeSnap = await getDocs(traineeQ);
            if (!traineeSnap.empty) {
              setCurrentUserData(traineeSnap.docs[0].data());
            }
          }
        }
        
        // Fetch all invitations for this event to see who is already invited
        const invList = await eventInvitationsApi.listForEvent(eventId);
        
        // Enrich old invitations that don't have embedded data
        const enrichedInvList = await Promise.all(invList.map(async (inv: any) => {
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
        setAllEventInvitations(enrichedInvList);
        
        // Mark as viewed if not already
        const myInv = enrichedInvList.find(inv => inv.inviteeId === userId);
        if (myInv && !myInv.viewed) {
          eventInvitationsApi.update(myInv.id, { viewed: true }).catch(console.error);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const data = await eventsApi.get(eventId);
      setEventData(data);
      
      if (data.createdBy) {
        const q = query(collection(db, 'trainers'), where('trainerId', '==', data.createdBy));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setCreatorData(snap.docs[0].data());
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
    
    if (potentialInvitees.length > 0) return; // already loaded

    try {
      // Fetch all approved/superadmin trainers first to identify who has upgraded
      const trainersQ = query(collection(db, 'trainers'), where('status', 'in', ['อนุมัติ', 'superadmin']));
      const trainersSnap = await getDocs(trainersQ);
      const tList = trainersSnap.docs.map(d => ({ ...d.data(), userType: 'trainer' }));
      const approvedTrainerIds = new Set(tList.map((t: any) => t.trainerId || t.userId).filter(Boolean));

      if (role === 'superadmin') {
        // Superadmin can invite trainers (and trainees, but let's focus on trainers for superadmin as per requirement, or both)
        // Let's load trainers and superadmins
        
        // Load all trainees (exclude manual trainees)
        const traineesSnap = await getDocs(collection(db, 'trainees'));
        const trList = traineesSnap.docs
          .map(d => ({ ...d.data(), userType: 'trainee' }))
          .filter((t: any) => !t.userId?.startsWith('manual_'))
          .filter((t: any) => !approvedTrainerIds.has(t.userId)); // Exclude trainees who are already approved trainers
        
        setPotentialInvitees([...tList, ...trList]);
      } else if (role === 'trainer') {
        // Trainer can only invite their own trainees (exclude manual trainees)
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
      const newInv = await eventInvitationsApi.create({
        eventId,
        inviterId: userId,
        inviteeId: targetId,
        role: invitee.userType,
        inviteeStatus: invitee.status || '',
        status: 'pending',
        inviteeName: invitee.nickname || invitee.displayName || 'ไม่มีชื่อ',
        inviteePhoto: invitee.pictureUrl || '',
        inviteeProvince: invitee.province || '',
        inviteeZone: invitee.zone || '',
      });

      setAllEventInvitations(prev => [...prev, { 
        id: newInv.id,
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

  const handleDeleteEvent = async () => {
    if (!window.confirm('คุณต้องการลบกิจกรรมนี้ใช่หรือไม่?')) return;
    try {
      await eventsApi.delete(eventId);
      await eventInvitationsApi.deleteForEvent(eventId);
      onClose();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการลบกิจกรรม');
    }
  };

  const handleAcceptOrJoin = async () => {
    try {
      if (currentUserInv?.id) {
        await eventInvitationsApi.update(currentUserInv.id, { status: 'accepted' });
        setAllEventInvitations(prev => prev.map(inv => 
          inv.id === currentUserInv.id ? { ...inv, status: 'accepted' } : inv
        ));
      } else {
        const docRef = await eventInvitationsApi.create({
          eventId,
          inviterId: eventData.createdBy || userId,
          inviteeId: userId,
          role: role === 'superadmin' ? 'trainer' : role,
          inviteeStatus: currentUserData?.status || (role === 'superadmin' ? 'superadmin' : ''),
          status: 'accepted',
          inviteeName: currentUserData?.nickname || currentUserData?.displayName || 'แอดมิน',
          inviteePhoto: currentUserData?.pictureUrl || '',
          inviteeProvince: currentUserData?.province || '',
          inviteeZone: currentUserData?.zone || '',
          viewed: true
        });
        
        setAllEventInvitations(prev => [...prev, {
          id: docRef.id,
          eventId,
          inviterId: eventData.createdBy || userId,
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
      alert('เกิดข้อผิดพลาดในการเข้าร่วมกิจกรรม');
    }
  };

  const handleAddToCalendar = () => {
    const params = new URLSearchParams({
      name: eventData?.name || 'กิจกรรม',
      startDatetimeIso: eventData?.startDatetimeIso || '',
      endDatetimeIso: eventData?.endDatetimeIso || '',
      description: eventData?.description || '',
      location: eventData?.location || '',
    });
    const url = `${window.location.origin}/download-ics?${params.toString()}`;
    if ((window as any).liff && (window as any).liff.openWindow) {
      (window as any).liff.openWindow({ url, external: true });
    } else {
      window.open(url, '_blank');
    }
  };


  if (loading || !eventData) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '16px' }}>กำลังโหลด...</div>
      </div>
    );
  }

  // Use invitations prop as a fallback to ensure we find the current user's invitation
  const myInvFromProps = invitations && invitations.length > 0 ? invitations[0] : null;
  const currentUserInv = allEventInvitations.find(inv => inv.inviteeId === userId) || myInvFromProps;

  const isCreator = eventData?.createdBy === userId;
  const isSuperadmin = role === 'superadmin';
  const isTrainer = role === 'trainer';

  // Creator is automatically joined
  const isAccepted = currentUserInv?.status === 'accepted' || isCreator;

  const pendingInvitations = allEventInvitations.filter(inv => inv.status === 'pending' && inv.inviteeId !== eventData.createdBy);
  let acceptedInvitations = allEventInvitations.filter(inv => inv.status === 'accepted');

  const creatorInvitation = creatorData ? {
    inviteeId: eventData.createdBy,
    inviteeName: creatorData.nickname || creatorData.displayName || 'ผู้สร้างกิจกรรม',
    inviteePhoto: creatorData.pictureUrl || '',
    inviteeProvince: creatorData.province || '',
    inviteeZone: creatorData.zone || '',
    role: 'trainer',
    status: 'accepted'
  } : null;

  if (creatorInvitation && !acceptedInvitations.some(inv => inv.inviteeId === eventData.createdBy)) {
    acceptedInvitations = [creatorInvitation, ...acceptedInvitations];
  }

  const invitedSet = new Set(allEventInvitations.map(inv => inv.inviteeId));
  if (eventData.createdBy) {
    invitedSet.add(eventData.createdBy);
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
              title="แก้ไขกิจกรรม"
            >
              ✏️
            </button>
          )}
          {(isCreator || isSuperadmin) && (
            <button 
              onClick={handleDeleteEvent}
              style={{ background: 'rgba(255,255,255,0.85)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="ลบกิจกรรม"
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

        {eventData.imageUrl && (
          isVideoUrl(eventData.imageUrl) ? (
            <video src={eventData.imageUrl} autoPlay muted loop playsInline style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
          ) : (
            <img src={eventData.imageUrl} alt={eventData.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
          )
        )}

        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 10px 0', color: 'var(--text-main)', fontSize: '1.8rem' }}>{eventData.name}</h2>
          
          {creatorData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
              {creatorData.pictureUrl ? (
                <img src={creatorData.pictureUrl} alt="creator" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px' }}>👤</div>
              )}
              <span style={{ fontSize: '0.95rem', color: '#64748b' }}>
                จัดโดย <strong style={{ color: 'var(--text-main)' }}>{creatorData.nickname || creatorData.displayName || 'แอดมิน'}</strong>
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '1rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🕒</span> {getEventDateText(eventData)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '1rem' }}>
              <span style={{ fontSize: '1.2rem' }}>📍</span> {eventData.location}
            </div>
            {(eventData.linkType === 'rsvp' || eventData.linkType === 'zoom') && (
              <div style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', gap: '7px', marginTop: '4px', padding: '7px 12px', borderRadius: '999px', background: eventData.linkType === 'rsvp' ? '#f3e8ff' : '#e0f2fe', color: eventData.linkType === 'rsvp' ? '#6d28d9' : '#0369a1', fontSize: '0.85rem', fontWeight: 'bold' }}>
                <span>{eventData.linkType === 'rsvp' ? '✍️' : '🎥'}</span>
                รูปแบบปุ่มลิงก์: {eventData.linkType === 'rsvp' ? 'ลงชื่อ' : 'เข้าผ่าน Zoom'}
              </div>
            )}
          </div>

          {eventData.description && (
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', color: '#334155', lineHeight: '1.6', marginBottom: '24px', whiteSpace: 'pre-wrap' }}>
              {eventData.description}
            </div>
          )}

          {/* Accepted Invitations */}
          {acceptedInvitations.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontSize: '0.9rem' }}>✅ ตอบรับคำเชิญแล้ว</h3>
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
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontSize: '0.9rem' }}>⏳ รอตอบรับคำเชิญ</h3>
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
                  ✅ ตอบรับเข้าร่วมกิจกรรม
                </button>
              )}
              {showInviteButton && !showInviteSection && (
                <button 
                  onClick={handleLoadInvitees}
                  style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  + เชิญผู้เข้าร่วม
                </button>
              )}
            </div>
            {(isAccepted || isCreator) && eventData?.startDatetimeIso && (
              <button
                onClick={handleAddToCalendar}
                style={{ width: '100%', padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                📅 เพิ่มลงปฏิทิน
              </button>
            )}

          </div>

          {showInviteSection && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
              <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-main)' }}>เชิญผู้เข้าร่วม</h3>
              
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
                      const inv = allEventInvitations.find(i => i.inviteeId === id);
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
        <EditEventModal 
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchEventData();
          }}
          event={{ id: eventId, ...eventData }}
        />
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}

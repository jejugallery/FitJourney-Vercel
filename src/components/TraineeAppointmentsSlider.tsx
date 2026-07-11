import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, onSnapshot, where, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import AppointmentDetailModal from './AppointmentDetailModal';
import { isVideoUrl } from '../utils/mediaHelper';

interface TraineeAppointmentsSliderProps {
  userId: string;
}

export default function TraineeAppointmentsSlider({ userId }: TraineeAppointmentsSliderProps) {
  const [rawAppointments, setRawAppointments] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [confirmInvId, setConfirmInvId] = useState<string | null>(null);
  const [creators, setCreators] = useState<Record<string, any>>({});
  
  const appointments = useMemo(() => {
    const myAppointmentIds = new Set(invitations.map(inv => inv.appointmentId));
    const now = new Date().getTime();
    
    const myAppointments = rawAppointments.filter(e => {
      if (!myAppointmentIds.has(e.id)) return false;
      if (e.datetime) {
        let appointmentTime = 0;
        if (e.endDatetimeIso) {
          appointmentTime = new Date(e.endDatetimeIso).getTime();
        } else if (e.startDatetimeIso) {
          appointmentTime = new Date(e.startDatetimeIso).getTime();
        } else {
          appointmentTime = new Date(e.datetime).getTime();
        }
        
        if (!isNaN(appointmentTime)) {
          const diffHours = (now - appointmentTime) / (1000 * 60 * 60);
          if (diffHours > 2) return false;
        }
      }
      return true;
    });

    // sort by upcoming appointment date ascending (soonest first)
    myAppointments.sort((a, b) => {
      const getTime = (e: any) => {
        if (e.startDatetimeIso) return new Date(e.startDatetimeIso).getTime();
        if (e.datetime) return new Date(e.datetime).getTime();
        return 0;
      };
      return getTime(a) - getTime(b);
    });

    return myAppointments;
  }, [rawAppointments, invitations]);
  
  const sliderRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when popup is open
  useEffect(() => {
    if (confirmInvId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [confirmInvId]);

  useEffect(() => {
    const fetchCreators = async () => {
      try {
        const trainersSnap = await getDocs(collection(db, 'trainers'));
        const creatorsMap: Record<string, any> = {};
        trainersSnap.docs.forEach(d => {
          const data = d.data();
          if (data.trainerId) {
            creatorsMap[data.trainerId] = {
              name: data.nickname || data.displayName || 'แอดมิน',
              photo: data.pictureUrl || ''
            };
          }
        });
        setCreators(creatorsMap);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCreators();
  }, []);

  useEffect(() => {
    if (!userId) return;
    
    // Fetch invitations for this trainee
    const invQ = query(collection(db, 'appointmentInvitations'), where('inviteeId', '==', userId));
    const unsubInv = onSnapshot(invQ, (snap) => {
      const invList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setInvitations(invList);
    });

    return () => unsubInv();
  }, [userId]);

  useEffect(() => {
    const unsubAppointments = onSnapshot(collection(db, 'appointments'), (snap) => {
      const allAppointments: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRawAppointments(allAppointments);
    });

    return () => unsubAppointments();
  }, []);

  const handleAddToCalendar = (ev: any) => {
    const params = new URLSearchParams({
      name: ev.name || 'นัดหมาย',
      startDatetimeIso: ev.startDatetimeIso || '',
      endDatetimeIso: ev.endDatetimeIso || '',
      description: ev.description || '',
      location: ev.location || '',
    });
    const url = `${window.location.origin}/download-ics?${params.toString()}`;
    if ((window as any).liff && (window as any).liff.openWindow) {
      (window as any).liff.openWindow({ url, external: true });
    } else {
      window.open(url, '_blank');
    }
  };

  const handleAccept = async (e: React.MouseEvent, invitationId: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'appointmentInvitations', invitationId), { status: 'accepted' });
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการตอบรับคำเชิญ');
    }
  };

  if (appointments.length === 0) return null;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-main)', paddingLeft: '4px' }}>
        🤝 นัดหมาย
      </h3>
      
      <div 
        ref={sliderRef}
        style={{ 
          display: 'flex', 
          overflowX: 'auto', 
          gap: '16px', 
          paddingBottom: '10px',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none' // IE/Edge
        }}
        className="hide-scrollbar"
      >
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        
        {appointments.map(ev => {
          const myInv = invitations.find(i => i.appointmentId === ev.id);
          
          return (
            <div 
              key={ev.id}
              onClick={() => setSelectedAppointmentId(ev.id)}
              style={{
                minWidth: '280px',
                width: '280px',
                border: '1px solid #e2e8f0', 
                borderRadius: '16px', 
                overflow: 'hidden', 
                cursor: 'pointer',
                background: '#fff', 
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                scrollSnapAlign: 'start',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {ev.imageUrl ? (
                isVideoUrl(ev.imageUrl) ? (
                  <video src={ev.imageUrl} muted loop playsInline autoPlay style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                ) : (
                  <img src={ev.imageUrl} alt={ev.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                )
              ) : (
                <div style={{ width: '100%', height: '140px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  🤝
                </div>
              )}
              
              <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {ev.name}
                </div>

                {ev.createdBy && creators[ev.createdBy] && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    {creators[ev.createdBy].photo ? (
                      <img src={creators[ev.createdBy].photo} alt="creator" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px' }}>👤</div>
                    )}
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      นัดหมายโดย {creators[ev.createdBy].name}
                    </span>
                  </div>
                )}

                <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                  🕒 {ev.datetime} {ev.endDatetimeDisplay && (
                    (ev.startDatetimeIso && ev.endDatetimeIso && ev.startDatetimeIso.substring(0, 10) === ev.endDatetimeIso.substring(0, 10))
                      ? ` - ${ev.endDatetimeDisplay.split(',')[1] || ev.endDatetimeDisplay}`
                      : ` - ${ev.endDatetimeDisplay}`
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  📍 {ev.location}
                </div>
                
                <div style={{ marginTop: 'auto' }}>
                  {myInv && myInv.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmInvId(myInv.id); }}
                        style={{ flex: 1, padding: '8px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        🎯 ยืนยันนัดหมาย
                      </button>
                    </div>
                  )}
                  
                  {myInv && myInv.status === 'accepted' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ padding: '6px 0', color: '#166534', fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                        <span style={{background: '#dcfce7', padding: '4px 8px', borderRadius: '12px'}}>✅ ยืนยันการนัดหมายแล้ว</span>
                      </div>
                      {ev.startDatetimeIso && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddToCalendar(ev); }}
                          style={{ width: '100%', padding: '8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          📅 เพิ่มลงปฏิทิน
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedAppointmentId && (
        <AppointmentDetailModal 
          appointmentId={selectedAppointmentId} 
          initialAppointmentData={appointments.find(e => e.id === selectedAppointmentId)}
          onClose={() => setSelectedAppointmentId(null)} 
          userId={userId} 
          role="trainee"
          invitations={invitations.filter(i => i.appointmentId === selectedAppointmentId)}
        />
      )}

      {confirmInvId && createPortal(
        <div
          onClick={() => setConfirmInvId(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '20px',
              padding: '32px 28px', width: '100%', maxWidth: '340px',
              textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎯</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#1e293b' }}>ยืนยันนัดหมาย</h3>
            <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '0.95rem' }}>ยืนยันที่จะตอบรับการนัดหมายนี้ ?</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setConfirmInvId(null)}
                style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer' }}
              >
                ยกเลิก
              </button>
              <button
                onClick={async (e) => { await handleAccept(e as any, confirmInvId!); setConfirmInvId(null); }}
                style={{ flex: 1, padding: '12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer' }}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

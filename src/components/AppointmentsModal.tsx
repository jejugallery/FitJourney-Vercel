import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, onSnapshot, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import CreateAppointmentModal from './CreateAppointmentModal';
import AppointmentDetailModal from './AppointmentDetailModal';
import { isVideoUrl } from '../utils/mediaHelper';

interface AppointmentsModalProps {
  onClose: () => void;
  userId: string;
  role: string; // 'superadmin' | 'trainer' | 'trainee'
  onSwitchEvents?: () => void;
}

export default function AppointmentsModal({ onClose, userId, role, onSwitchEvents }: AppointmentsModalProps) {
  const [rawAppointments, setRawAppointments] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmInvId, setConfirmInvId] = useState<string | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [creators, setCreators] = useState<Record<string, any>>({});

  const appointments = useMemo(() => {
    // Filter out appointments older than 2 hours
    const now = new Date().getTime();
    let validAppointments = rawAppointments.filter(e => {
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

    // Sort by upcoming appointment date ascending (soonest first)
    validAppointments.sort((a, b) => {
      const getTime = (e: any) => {
        if (e.startDatetimeIso) return new Date(e.startDatetimeIso).getTime();
        if (e.datetime) return new Date(e.datetime).getTime();
        return 0;
      };
      return getTime(a) - getTime(b);
    });

    if (role === 'superadmin') {
      return validAppointments;
    } else {
      const myAppointmentIds = new Set(invitations.map(inv => inv.appointmentId));
      return validAppointments.filter(e => myAppointmentIds.has(e.id) || e.createdBy === userId);
    }
  }, [rawAppointments, role, invitations, userId]);

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
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showCreateModal, selectedAppointmentId]);

  useEffect(() => {
    // 1. Fetch invitations for this user
    const invQ = query(collection(db, 'appointmentInvitations'), where('inviteeId', '==', userId));
    const unsubInv = onSnapshot(invQ, (snap) => {
      const invList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setInvitations(invList);
    }, (err) => {
      console.error("invQ error:", err);
      alert("Error loading invitations: " + err.message);
    });

    return () => unsubInv();
  }, [userId]);

  useEffect(() => {
    // 2. Fetch appointments
    const appointmentsQ = query(collection(db, 'appointments'));

    const unsubAppointments = onSnapshot(appointmentsQ, (snap) => {
      let allAppointments = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setRawAppointments(allAppointments);
      setLoading(false);
    }, (err) => {
      console.error("appointmentsQ error:", err);
      alert("Error loading appointments: " + err.message);
      setLoading(false);
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

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', zIndex: 15000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '20px', backdropFilter: 'blur(4px)'
      }}>
        <div style={{
          background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '600px',
          padding: '24px', position: 'relative', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <button 
            onClick={onClose}
            style={{ position: 'absolute', top: '20px', right: '20px', background: '#fef2f2', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: '1.2rem', fontWeight: 'bold' }}
          >
            ✕
          </button>

          <h2 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🤝 นัดหมาย | <span style={{ cursor: 'pointer', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} onClick={onSwitchEvents}>📅</span>
          </h2>

          {(role === 'superadmin' || role === 'trainer') && (
            <button 
              onClick={() => setShowCreateModal(true)}
              style={{ width: '100%', padding: '12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginBottom: '20px', transition: 'all 0.2s' }}
            >
              + สร้างนัดหมายใหม่
            </button>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>กำลังโหลด...</div>
          ) : appointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
              ยังไม่มีการนัดหมายในขณะนี้
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {appointments.map(ev => {
                const myInv = invitations.find(i => i.appointmentId === ev.id);
                
                return (
                  <div 
                    key={ev.id}
                    onClick={() => setSelectedAppointmentId(ev.id)}
                    style={{
                      border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer',
                      transition: 'all 0.2s', background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
                  >
                    {ev.imageUrl && (
                      isVideoUrl(ev.imageUrl) ? (
                        <video src={ev.imageUrl} muted loop playsInline autoPlay style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                      ) : (
                        <img src={ev.imageUrl} alt={ev.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                      )
                    )}
                    <div style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '8px' }}>
                        {ev.name}
                      </div>

                      {ev.createdBy && creators[ev.createdBy] && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          {creators[ev.createdBy].photo ? (
                            <img src={creators[ev.createdBy].photo} alt="creator" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px' }}>👤</div>
                          )}
                          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            โดย {creators[ev.createdBy].name}
                          </span>
                        </div>
                      )}

                      <div style={{ fontSize: '0.9rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                        🕒 {ev.datetime} {ev.endDatetimeDisplay && (
                          (ev.startDatetimeIso && ev.endDatetimeIso && ev.startDatetimeIso.substring(0, 10) === ev.endDatetimeIso.substring(0, 10))
                            ? ` - ${ev.endDatetimeDisplay.split(',')[1] || ev.endDatetimeDisplay}`
                            : ` - ${ev.endDatetimeDisplay}`
                        )}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        📍 {ev.location}
                      </div>
                      
                      {myInv && myInv.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setConfirmInvId(myInv.id); }}
                            style={{ flex: 1, padding: '10px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}
                          >
                            🎯 ยืนยันนัดหมาย
                          </button>
                        </div>
                      )}
                      
                      {myInv && myInv.status === 'accepted' && (
                        <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                          <div style={{ padding: '6px 12px', background: '#dcfce7', color: '#166534', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            ✅ ยืนยันเข้าร่วมการนัดหมายแล้ว
                          </div>
                          {ev.startDatetimeIso && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAddToCalendar(ev); }}
                              style={{ padding: '7px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                              📅 เพิ่มลงปฏิทิน
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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

      {showCreateModal && (
        <CreateAppointmentModal onClose={() => setShowCreateModal(false)} userId={userId} />
      )}

      {selectedAppointmentId && (
        <AppointmentDetailModal 
          appointmentId={selectedAppointmentId} 
          initialAppointmentData={appointments.find(e => e.id === selectedAppointmentId)}
          onClose={() => setSelectedAppointmentId(null)} 
          userId={userId} 
          role={role}
          invitations={invitations.filter(i => i.appointmentId === selectedAppointmentId)}
        />
      )}
    </>
  );
}

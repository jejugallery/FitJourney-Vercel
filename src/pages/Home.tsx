import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, limit, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLiff } from '../context/LiffContext';
import { eventInvitationsApi, appointmentInvitationsApi } from '../utils/api';
import MetricsForm from '../components/MetricsForm';
import TraineeDashboard from './TraineeDashboard';
import EventsModal from '../components/EventsModal';
import AppointmentsModal from '../components/AppointmentsModal';
import Navbar from '../components/Navbar';
import TrainerFoodReviewModal from '../components/TrainerFoodReviewModal';
import HealthKnowledgeModal from '../components/HealthKnowledgeModal';
import HealthKnowledgePlayerModal from '../components/HealthKnowledgePlayerModal';
import liff from '@line/liff';
import SuccessPopup from '../components/SuccessPopup';

export default function Home({ isRecordOnly = false }: { isRecordOnly?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { reviewTraineeId } = useParams<{ reviewTraineeId: string }>();
  const { profile, realProfile, setMockProfile, mockProfile, loading: liffLoading, error: liffError } = useLiff();

  const [checkingRole, setCheckingRole] = useState(() => {
    const cachedRole = sessionStorage.getItem('cachedUserRole');
    return cachedRole ? false : true;
  });
  const [role, setRole] = useState<'admin_approved' | 'admin_pending' | 'trainee' | 'none' | null>(() => {
    return (sessionStorage.getItem('cachedUserRole') as any) || null;
  });
  
  const [newTrainee, setNewTrainee] = useState<{nickname: string, dob?: string, age?: number} | null>(null);
  const [selectedTraineeForForm, setSelectedTraineeForForm] = useState(sessionStorage.getItem('lastViewedTraineeNickname') || '');
  
  const [adminData, setAdminData] = useState<any>(() => {
    const cachedData = sessionStorage.getItem('cachedAdminData');
    return cachedData ? JSON.parse(cachedData) : null;
  });
  const [viewMode, setViewMode] = useState<'form' | 'dashboard'>(location.state?.viewMode || 'form');
  const [viewingTraineeId, setViewingTraineeId] = useState<string | null>(location.state?.viewingTraineeId || null);
  const [formKey, setFormKey] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);

  useEffect(() => {
    if (role) {
      sessionStorage.setItem('cachedUserRole', role);
    } else {
      sessionStorage.removeItem('cachedUserRole');
    }
  }, [role]);

  useEffect(() => {
    if (adminData) {
      sessionStorage.setItem('cachedAdminData', JSON.stringify(adminData));
    } else {
      sessionStorage.removeItem('cachedAdminData');
    }
  }, [adminData]);

  // Sync viewMode and viewingTraineeId when navigating back to this page (e.g. from FoodHistoryPage)
  useEffect(() => {
    if (location.state?.viewMode) {
      setViewMode(location.state.viewMode);
    }
    if (location.state?.viewingTraineeId !== undefined) {
      setViewingTraineeId(location.state.viewingTraineeId || null);
    }
    if (location.state?.clearTrainee) {
      setSelectedTraineeForForm('');
      sessionStorage.removeItem('lastViewedTraineeNickname');
      setFormKey(k => k + 1);
    }
  }, [location.state]);

  const [isRealSuperadmin, setIsRealSuperadmin] = useState(false);

  useEffect(() => {
    const checkRealSuperadmin = async () => {
      const uId = realProfile?.userId || profile?.userId;
      if (!uId) return;
      try {
        const q = query(collection(db, 'trainers'), where('trainerId', '==', uId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setIsRealSuperadmin(snap.docs[0].data().status === 'superadmin');
        }
      } catch (err) {
        console.error("Error checking real superadmin:", err);
      }
    };
    checkRealSuperadmin();
  }, [realProfile, profile]);

  const DevPanel = () => {
    const isMockActive = !!mockProfile;
    const showDevPanel = isRealSuperadmin;

    if (!showDevPanel) return null;

    const handleToggleMock = () => {
      if (isMockActive) {
        setMockProfile(null);
      } else {
        const uId = realProfile?.userId || profile?.userId;
        if (uId) {
          setMockProfile({
            userId: `mock_trainee_${uId}`,
            displayName: 'ลูกเทรนทดสอบ (Mock)',
            pictureUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png'
          });
        }
      }
    };

    return (
      <button
        onClick={handleToggleMock}
        title={isMockActive ? "ออกจากโหมดจำลองลูกเทรน" : "สลับเป็นลูกเทรนทดสอบ (Mock)"}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 99999,
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: isMockActive ? '#ef4444' : '#f59e0b',
          border: '2px solid #fff',
          boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '20px',
          transition: 'all 0.2s ease',
          padding: 0,
          outline: 'none'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.25)';
        }}
      >
        {isMockActive ? '🔴' : '🛠️'}
      </button>
    );
  };

  const handleSendInviteCard = async () => {
    try {
      if (!liff.isApiAvailable('shareTargetPicker')) {
        alert('อุปกรณ์นี้ไม่รองรับการแชร์ข้อความผ่าน LINE (shareTargetPicker)');
        return;
      }

      setInviting(true);

      const senderName = adminData?.nickname || adminData?.displayName || profile?.displayName || 'เทรนเนอร์ของคุณ';
      
      // Strict sanitization of senderImageUrl
      let senderImageUrl = profile?.pictureUrl || adminData?.pictureUrl || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";
      if (!senderImageUrl || typeof senderImageUrl !== 'string' || !senderImageUrl.startsWith('https://')) {
        senderImageUrl = "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";
      }

      const trainerCode = adminData?.trainerCode ? String(adminData.trainerCode) : '';
      const registerUri = trainerCode
        ? `https://liff.line.me/2010284484-jvUDlx0u/register-trainee?trainerCode=${encodeURIComponent(trainerCode)}`
        : "https://liff.line.me/2010284484-jvUDlx0u/register-trainee";

      // Build trainerInfoContents imperatively with profile name and code stacked vertically
      const profileInfoContents: any[] = [
        {
          type: "text",
          text: senderName,
          align: "start",
          weight: "bold",
          size: "md",
          color: "#1e293b"
        }
      ];

      if (trainerCode) {
        profileInfoContents.push({
          type: "text",
          margin: "xs",
          contents: [
            {
              type: "span",
              text: "รหัสเทรนเนอร์: ",
              color: "#64748b",
              size: "xs"
            },
            {
              type: "span",
              text: trainerCode,
              color: "#FF416C",
              weight: "bold",
              size: "xs"
            }
          ]
        });
      }

      const trainerInfoContents: any[] = [
        {
          type: "text",
          text: "จาก",
          size: "xs",
          color: "#94a3b8",
          align: "center"
        },
        {
          type: "separator",
          margin: "md",
          color: "#fde2ec"
        },
        {
          type: "box",
          layout: "horizontal",
          spacing: "md",
          justifyContent: "center",
          alignItems: "center",
          contents: [
            {
              type: "image",
              url: senderImageUrl,
              size: "xs",
              aspectMode: "fit",
              aspectRatio: "1:1",
              flex: 0
            },
            {
              type: "box",
              layout: "vertical",
              flex: 0,
              contents: profileInfoContents
            }
          ]
        }
      ];

      // Simplified Flex Message using the user's custom layout with Hero Image and #fde2ec background
      const flexMessage = {
        type: "flex",
        altText: `คุณได้รับคำเชิญเข้าร่วมโปรแกรมวิเคราะห์ร่างกาย จาก ${senderName}`,
        contents: {
          type: "bubble",
          hero: {
            type: "image",
            url: "https://fitjourneythailand.web.app/invite_hero.png",
            size: "full",
            aspectRatio: "16:9",
            aspectMode: "cover"
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            backgroundColor: "#fde2ec",
            contents: [
              {
                type: "box",
                layout: "vertical",
                margin: "lg",
                spacing: "md",
                contents: trainerInfoContents
              }
            ],
            paddingAll: "lg"
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            backgroundColor: "#fde2ec",
            contents: [
              {
                type: "box",
                layout: "vertical",
                backgroundColor: "#FF416C",
                cornerRadius: "30px",
                paddingAll: "10px",
                action: {
                  type: "uri",
                  label: "ลงทะเบียนเลย",
                  uri: registerUri
                },
                contents: [
                  {
                    type: "text",
                    text: "ลงทะเบียนเลย",
                    color: "#ffffff",
                    weight: "bold",
                    size: "sm",
                    align: "center"
                  }
                ]
              }
            ],
            paddingAll: "lg",
            flex: 0
          }
        }
      };

      console.log('[InviteCard]', JSON.stringify(flexMessage));

      const res = await liff.shareTargetPicker([flexMessage as any]);
      
      if (res) {
        setShowLineQrModal(false);
        setShowInviteSuccess(true);
        setTimeout(() => setShowInviteSuccess(false), 2000);
      } else {
        console.log('[InviteCard] cancelled or rejected');
      }
    } catch (err: any) {
      console.error('[InviteCard] error:', err);
    } finally {
      setInviting(false);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [viewMode]);

  useEffect(() => {
    if (reviewTraineeId && role === 'admin_approved') {
      setShowFoodReviewModal(true);
    }
  }, [reviewTraineeId, role]);

  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [rawPendingTrainers, setRawPendingTrainers] = useState<any[]>([]);
  const [showSuperadminModal, setShowSuperadminModal] = useState(false);
  const [newTrainerAlert, setNewTrainerAlert] = useState<{show: boolean, name: string, pictureUrl: string}>({show: false, name: '', pictureUrl: ''});
  const [showFoodReviewModal, setShowFoodReviewModal] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [showAppointmentsModal, setShowAppointmentsModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showLineQrModal, setShowLineQrModal] = useState(false);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [activeKnowledgeItem, setActiveKnowledgeItem] = useState<any>(null);
  const [pendingFoodCount, setPendingFoodCount] = useState(0);
  const [pendingEventsCount, setPendingEventsCount] = useState(0);
  const [pendingAppointmentsCount, setPendingAppointmentsCount] = useState(0);

  const [myTraineeIds, setMyTraineeIds] = useState<string[]>([]);
  const [traineesLoaded, setTraineesLoaded] = useState(false);

  const myTraineeIdsRef = useRef(myTraineeIds);
  useEffect(() => {
    myTraineeIdsRef.current = myTraineeIds;
  }, [myTraineeIds]);

  const pendingTrainers = useMemo(() => {
    return isSuperadmin 
      ? rawPendingTrainers 
      : rawPendingTrainers.filter(t => myTraineeIds.includes(t.trainerId));
  }, [rawPendingTrainers, isSuperadmin, myTraineeIds]);

  useEffect(() => {
    if (showLineQrModal || showSuperadminModal || newTrainerAlert.show) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [showLineQrModal, showSuperadminModal, newTrainerAlert.show]);

  const handleApproveTrainer = async (docId: string) => {
    try {
      await updateDoc(doc(db, 'trainers', docId), { status: 'อนุมัติ' });
      setRawPendingTrainers(prev => {
        const updated = prev.filter(t => t.id !== docId);
        const filteredLength = isSuperadmin 
          ? updated.length 
          : updated.filter(t => myTraineeIds.includes(t.trainerId)).length;
        if (filteredLength === 0) {
          setShowSuperadminModal(false);
        }
        return updated;
      });
    } catch (err) {
      console.error('Error approving trainer:', err);
      alert('เกิดข้อผิดพลาดในการอนุมัติ');
    }
  };
  const handleRejectTrainer = async (docId: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะไม่อนุมัติเทรนเนอร์ท่านนี้?')) return;
    try {
      await updateDoc(doc(db, 'trainers', docId), { status: 'ไม่อนุมัติ' });
      setRawPendingTrainers(prev => {
        const updated = prev.filter(t => t.id !== docId);
        const filteredLength = isSuperadmin 
          ? updated.length 
          : updated.filter(t => myTraineeIds.includes(t.trainerId)).length;
        if (filteredLength === 0) {
          setShowSuperadminModal(false);
        }
        return updated;
      });
    } catch (err) {
      console.error('Error rejecting trainer:', err);
      alert('เกิดข้อผิดพลาดในการปฏิเสธ');
    }
  };

  useEffect(() => {
    const checkUserRole = async () => {
      if (!profile) return;
      
      try {
        // 1. Check if user is an approved admin/trainer
        const adminQ = query(collection(db, 'trainers'), where('trainerId', '==', profile.userId));
        const adminSnap = await getDocs(adminQ);
        
        if (!adminSnap.empty) {
          const adminDocData = { ...adminSnap.docs[0].data(), docId: adminSnap.docs[0].id } as any;
          if (adminDocData.status === 'อนุมัติ' || adminDocData.status === 'superadmin') {
            const isUserSuperadmin = adminDocData.status === 'superadmin';
            setIsSuperadmin(isUserSuperadmin);
            setRole('admin_approved');
            setAdminData(adminDocData);

            if (isUserSuperadmin) {
              const ensureMockTrainee = async () => {
                try {
                  const mockTraineeId = `mock_trainee_${profile.userId}`;
                  const tRef = doc(db, 'trainees', mockTraineeId);
                  const tSnap = await getDoc(tRef);
                  if (!tSnap.exists()) {
                    await setDoc(tRef, {
                      userId: mockTraineeId,
                      nickname: 'ลูกเทรนทดสอบ (Mock)',
                      pictureUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
                      gender: 'male',
                      dob: '1995-01-01',
                      height: 175,
                      province: 'กรุงเทพมหานคร',
                      zone: 'ปทุมวัน',
                      phone: '0800000000',
                      trainerIds: [profile.userId],
                      createdAt: new Date()
                    });
                  }
                } catch (mockErr) {
                  console.error("Error ensuring mock trainee exists:", mockErr);
                }
              };
              ensureMockTrainee();
            }
            
            // Check for new trainee
            const myTraineesQ = query(collection(db, 'trainees'), where('trainerIds', 'array-contains', profile.userId));
            const myTraineesSnap = await getDocs(myTraineesQ);
            
            if (!myTraineesSnap.empty) {
              const myTrainees = myTraineesSnap.docs.map(d => d.data());
              
              const loggedQ = query(collection(db, 'bodyMetrics'), where('trainerId', '==', profile.userId));
              const loggedSnap = await getDocs(loggedQ);
              const loggedNames = new Set();
              loggedSnap.forEach(d => loggedNames.add(d.data().name));
              
              const potentialNewTrainees = myTrainees.filter(t => 
                !loggedNames.has(t.nickname) && 
                t.userId && 
                typeof t.userId === 'string' && 
                t.userId.startsWith('U') && 
                t.userId.length === 33
              );
              const realNewTraineesList = [];
              
              // Load set of trainee IDs already notified for this trainer
              const storageKey = `notifiedNewTrainees_${profile.userId}`;
              const alreadyNotified: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
              const notifiedSet = new Set(alreadyNotified);

              for (const t of potentialNewTrainees) {
                // Skip if already notified once before
                const traineeKey = t.userId || t.nickname;
                if (notifiedSet.has(traineeKey)) continue;

                let hasMetrics = false;
                if (t.userId) {
                  const q = query(collection(db, 'bodyMetrics'), where('traineeId', '==', t.userId), limit(1));
                  const snap = await getDocs(q);
                  if (!snap.empty) hasMetrics = true;
                }
                if (!hasMetrics) {
                  const qName = query(collection(db, 'bodyMetrics'), where('name', '==', t.nickname), limit(1));
                  const snapName = await getDocs(qName);
                  if (!snapName.empty) hasMetrics = true;
                }
                if (!hasMetrics) {
                  realNewTraineesList.push(t);
                }
              }

              if (realNewTraineesList.length > 0) {
                realNewTraineesList.sort((a, b) => {
                  const tA = a.createdAt ? a.createdAt.toMillis() : 0;
                  const tB = b.createdAt ? b.createdAt.toMillis() : 0;
                  return tB - tA;
                });
                const traineeToShow = realNewTraineesList[0] as any;
                // Mark as notified so it won't show again
                const traineeKey = traineeToShow.userId || traineeToShow.nickname;
                const updated = [...alreadyNotified, traineeKey];
                localStorage.setItem(storageKey, JSON.stringify(updated));
                setNewTrainee(traineeToShow);
              }
            }

          } else if (adminDocData.status === 'รออนุมัติ') {
            // Treat as trainee so they can view info, join events, and submit food logs normally
            const traineeQ = query(collection(db, 'trainees'), where('userId', '==', profile.userId));
            const traineeSnap = await getDocs(traineeQ);
            if (!traineeSnap.empty) {
              setRole('trainee');
            } else {
              setRole('none');
              navigate('/register-trainee', { replace: true });
            }
          } else {
            setRole('admin_pending');
            // Redirect other pending/rejected admins to admin registration page directly
            navigate('/register-admin', { replace: true });
          }
          return;
        }

        // 2. Check if user is a trainee
        const traineeQ = query(collection(db, 'trainees'), where('userId', '==', profile.userId));
        const traineeSnap = await getDocs(traineeQ);

        if (!traineeSnap.empty) {
          setRole('trainee');
        } else {
          setRole('none');
          // If no record anywhere, redirect to trainee registration
          navigate('/register-trainee', { replace: true });
        }
      } catch (err) {
        console.error("Error checking role:", err);
        setRole('none');
      } finally {
        setCheckingRole(false);
      }
    };

    if (profile) {
      checkUserRole();
    } else if (!liffLoading) {
      setCheckingRole(false);
    }
  }, [profile, liffLoading, navigate]);

  // URL Parameter check for Shared Health Knowledge
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const knowledgeId = params.get('knowledgeId');

    if (knowledgeId) {
      const fetchKnowledge = async () => {
        try {
          const docRef = doc(db, 'healthKnowledges', knowledgeId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() } as any;
            setActiveKnowledgeItem(data);
          }
        } catch (err) {
          console.error("Error loading shared knowledge item:", err);
        }
      };

      fetchKnowledge();
    }
  }, [profile]);

  // 1. Listen to trainees of the current trainer to get their LINE userIds
  useEffect(() => {
    if (role !== 'admin_approved' || !profile) {
      setTraineesLoaded(false);
      return;
    }

    const traineesQ = query(
      collection(db, 'trainees'),
      where('trainerIds', 'array-contains', profile.userId)
    );

    const unsubscribe = onSnapshot(traineesQ, (snap) => {
      const ids = snap.docs.map(doc => doc.data().userId).filter(Boolean);
      setMyTraineeIds(ids);
      setTraineesLoaded(true);
    }, (err) => {
      console.error("Error listening to trainees:", err);
      setTraineesLoaded(true);
    });

    return () => unsubscribe();
  }, [role, profile]);

  // 2. Listen to pending trainers and filter them reactively
  useEffect(() => {
    if (role !== 'admin_approved' || !profile) return;
    if (!isSuperadmin && !traineesLoaded) return;

    const pendingQ = query(collection(db, 'trainers'), where('status', '==', 'รออนุมัติ'));
    let isInitialLoad = true;

    const unsubscribe = onSnapshot(pendingQ, (snap) => {
      const allPending = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setRawPendingTrainers(allPending);

      let hasNewTrainer = false;
      let addedName = '';
      let addedPic = '';

      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          if (!isInitialLoad) {
            const newTrainer = { id: change.doc.id, ...change.doc.data() } as any;
            const isAllowed = isSuperadmin || myTraineeIdsRef.current.includes(newTrainer.trainerId);
            if (isAllowed) {
              hasNewTrainer = true;
              addedName = newTrainer.nickname || newTrainer.displayName || 'เทรนเนอร์ใหม่';
              addedPic = newTrainer.pictureUrl || '';
            }
          }
        }
      });

      const currentFiltered = isSuperadmin 
        ? allPending 
        : allPending.filter(t => myTraineeIdsRef.current.includes(t.trainerId));

      if (isInitialLoad && currentFiltered.length > 0) {
        setShowSuperadminModal(true);
      }

      if (hasNewTrainer) {
        setNewTrainerAlert({ show: true, name: addedName, pictureUrl: addedPic });
      }
      isInitialLoad = false;
    });

    return () => unsubscribe();
  }, [role, profile, isSuperadmin, traineesLoaded]);


  useEffect(() => {
    if (role === 'admin_approved' && profile) {
      const q = query(
        collection(db, 'foodLogs'),
        where('trainerIds', 'array-contains', profile.userId),
        where('reviewed', '==', false)
      );
      const unsubscribe = onSnapshot(q, (snap) => {
        const now = Date.now();
        const validDocs = snap.docs.filter(doc => {
          const data = doc.data();
          if (data.submittedAt === undefined) return false;
          if (data.submittedAt === null) return true;
          const t = data.submittedAt.toMillis ? data.submittedAt.toMillis() : 0;
          return (now - t) <= 24 * 60 * 60 * 1000;
        });
        setPendingFoodCount(validDocs.length);
      });
      return () => unsubscribe();
    }
  }, [role, profile]);

  const fetchPendingCounts = async () => {
    if (role === 'admin_approved' && profile) {
      try {
        const [eventRes, apptRes] = await Promise.all([
          eventInvitationsApi.getPendingCount(profile.userId),
          appointmentInvitationsApi.getPendingCount(profile.userId)
        ]);
        setPendingEventsCount(eventRes.count);
        setPendingAppointmentsCount(apptRes.count);
      } catch (err) {
        console.error("Error fetching pending notification counts:", err);
      }
    }
  };

  useEffect(() => {
    fetchPendingCounts();
    const interval = setInterval(fetchPendingCounts, 10000);
    return () => clearInterval(interval);
  }, [role, profile]);

  if (liffLoading || checkingRole) {
    return (
      <div className="form-container" style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>กำลังโหลด...</h2>
        <p className="subtitle">กรุณารอสักครู่ ระบบกำลังตรวจสอบข้อมูล</p>
      </div>
    );
  }

  if (liffError) {
    console.error("LIFF Error from Context:", liffError);
    return (
      <div className="form-container" style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>เกิดข้อผิดพลาด</h2>
        <p className="subtitle">{liffError}</p>
      </div>
    );
  }

  // If approved admin, show metrics form
  if (role === 'admin_approved') {
    if (reviewTraineeId && profile?.userId) {
      return (
        <>
          <TrainerFoodReviewModal 
            trainerId={profile.userId} 
            initialTraineeId={reviewTraineeId}
            onClose={() => {
              if (liff.isInClient()) {
                liff.closeWindow();
              } else {
                navigate('/', { replace: true });
              }
            }} 
          />
          <DevPanel />
        </>
      );
    }

    if (viewMode === 'dashboard') {
      return (
        <>
          <TraineeDashboard 
            targetTraineeId={viewingTraineeId || undefined} 
            isTrainerSelf={viewingTraineeId === profile?.userId} 
            onBackClick={() => { setViewMode('form'); setViewingTraineeId(null); setSelectedTraineeForForm(''); sessionStorage.removeItem('lastViewedTraineeNickname'); setFormKey(k => k + 1); }}
            showProfile={true}
            onProfileClick={() => setShowFoodReviewModal(true)}
            onEventsClick={() => setShowEventsModal(true)}
            onAppointmentsClick={() => setShowAppointmentsModal(true)}
            onBillingClick={() => setShowBillingModal(true)}
            onKnowledgeClick={() => setShowKnowledgeModal(true)}
            notificationCount={pendingFoodCount}
            eventNotificationCount={pendingEventsCount}
            appointmentNotificationCount={pendingAppointmentsCount}
          />
          {showKnowledgeModal && profile?.userId && (
            <HealthKnowledgeModal 
              onClose={() => setShowKnowledgeModal(false)}
              userId={profile.userId}
            />
          )}
          {showFoodReviewModal && profile?.userId && (
            <TrainerFoodReviewModal 
              trainerId={profile.userId} 
              initialTraineeId={reviewTraineeId}
              onClose={() => {
                setShowFoodReviewModal(false);
                if (reviewTraineeId) {
                  navigate('/', { replace: true });
                }
              }} 
            />
          )}
          {showEventsModal && profile?.userId && (
            <EventsModal 
              onClose={() => setShowEventsModal(false)}
              userId={profile.userId}
              role={isSuperadmin ? 'superadmin' : 'trainer'}
              onSwitchAppointments={() => {
                setShowEventsModal(false);
                setShowAppointmentsModal(true);
              }}
            />
          )}
          {showAppointmentsModal && profile?.userId && (
            <AppointmentsModal 
              onClose={() => setShowAppointmentsModal(false)}
              userId={profile.userId}
              role={isSuperadmin ? 'superadmin' : 'trainer'}
              onSwitchEvents={() => {
                setShowAppointmentsModal(false);
                setShowEventsModal(true);
              }}
            />
          )}
          {showBillingModal && profile?.userId && (
            <EventsModal 
              onClose={() => setShowBillingModal(false)}
              userId={profile.userId}
              role={isSuperadmin ? 'superadmin' : 'trainer'}
              initialMode="billing"
              billingOnly={true}
            />
          )}
          <DevPanel />
        </>
      );
    }

    return (
      <>
        <Navbar 
          showProfile={true} 
          onLogoClick={() => setShowLineQrModal(true)}
          onProfileClick={() => setShowFoodReviewModal(true)}
          onEventsClick={() => setShowEventsModal(true)}
          onAppointmentsClick={() => setShowAppointmentsModal(true)}
          onBillingClick={() => setShowBillingModal(true)}
          onKnowledgeClick={() => setShowKnowledgeModal(true)}
          notificationCount={pendingFoodCount}
          eventNotificationCount={pendingEventsCount}
          appointmentNotificationCount={pendingAppointmentsCount}
        />



      {/* LINE QR / Invite Modal */}
      {showLineQrModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 15000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', backdropFilter: 'blur(4px)'
        }}>
          <div className="animate-fade-in-up" style={{
            background: '#fff', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '350px',
            textAlign: 'center', position: 'relative', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <button 
              onClick={() => setShowLineQrModal(false)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: '#fef2f2', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#dc2626', fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >✕</button>
            <img src="https://i.postimg.cc/bwYtpKXr/invite.png" alt="Invite" style={{ width: '64px', height: '64px', marginBottom: '10px', objectFit: 'contain' }} />
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)', fontSize: '1.3rem' }}>ส่งการ์ดเชิญ</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>ลงทะเบียนเข้าร่วมโปรแกรมผ่าน LINE</p>
            <button
              onClick={handleSendInviteCard}
              disabled={inviting}
              style={{
                width: '100%',
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                padding: '0.8rem',
                borderRadius: '12px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                cursor: inviting ? 'not-allowed' : 'pointer',
                opacity: inviting ? 0.7 : 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 6px -1px rgba(255, 65, 108, 0.2)'
              }}
            >
              {inviting ? 'กำลังโหลดรายชื่อเพื่อน...' : '📤 ส่งให้เพื่อน'}
            </button>
          </div>
        </div>
      )}

      {/* Superadmin Modal */}
      {showSuperadminModal && (isSuperadmin || pendingTrainers.length > 0) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '1.5rem',
            width: '100%', maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>อนุมัติเทรนเนอร์</h3>
              <button 
                onClick={() => setShowSuperadminModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>{pendingTrainers.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>ไม่มีเทรนเนอร์ที่รออนุมัติ</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pendingTrainers.map(trainer => (
                  <div key={trainer.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                    {/* คอลัมน์ที่ 1: รูปภาพ */}
                    <div>
                      {trainer.pictureUrl ? (
                        <img src={trainer.pictureUrl} alt="Profile" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#cbd5e1' }} />
                      )}
                    </div>
                    
                    {/* คอลัมน์ที่ 2: ชื่อและปุ่ม */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
                      {/* แถวแรก: ชื่อและรหัส */}
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-main)' }}>{trainer.nickname || trainer.displayName || 'ไม่ระบุชื่อ'}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>รหัสอ้างอิง: {trainer.trainerCode}</div>
                      </div>
                      
                      {/* แถวที่สอง: ปุ่มอนุมัติ/ไม่อนุมัติ */}
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
                        <button 
                          style={{ flex: 1, padding: '0.6rem 0.5rem', fontSize: '0.95rem', borderRadius: '8px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                          onClick={() => handleApproveTrainer(trainer.id)}
                        >
                          ✅ อนุมัติ
                        </button>
                        <button 
                          style={{ flex: 1, padding: '0.6rem 0.5rem', fontSize: '0.95rem', borderRadius: '8px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                          onClick={() => handleRejectTrainer(trainer.id)}
                        >
                          ❌ ไม่อนุมัติ
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Trainer Alert Modal */}
      {newTrainerAlert.show && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          overflow: 'hidden'
        }}>
          <div className="animate-fade-in-up" style={{
            background: 'white',
            borderRadius: '24px',
            padding: '2.5rem 2rem',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            position: 'relative'
          }}>
            <button 
              type="button"
              onClick={() => setNewTrainerAlert({ show: false, name: '', pictureUrl: '' })}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: '#f1f5f9',
                border: 'none',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
                fontSize: '1.2rem'
              }}
            >✕</button>
            
            <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem', lineHeight: 1 }}>🎉</div>
            <h2 style={{ color: 'var(--primary)', marginBottom: '1.5rem', fontSize: '1.4rem' }}>มีเทรนเนอร์ใหม่รออนุมัติ!</h2>
            
            {newTrainerAlert.pictureUrl ? (
              <img src={newTrainerAlert.pictureUrl} alt="profile" style={{ width: '110px', height: '110px', borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--primary)', marginBottom: '1rem', boxShadow: '0 8px 16px rgba(255, 65, 108, 0.2)' }} />
            ) : (
              <div style={{ width: '110px', height: '110px', borderRadius: '50%', background: '#cbd5e1', border: '4px solid var(--primary)', margin: '0 auto 1rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '2rem' }}>👤</div>
            )}
            
            <h3 style={{ margin: '0 0 2rem 0', color: 'var(--text-main)', fontSize: '1.3rem' }}>{newTrainerAlert.name}</h3>
            
            <button
              className="btn-primary"
              onClick={() => {
                setNewTrainerAlert({ show: false, name: '', pictureUrl: '' });
                setShowSuperadminModal(true);
              }}
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', borderRadius: '14px', fontWeight: 'bold' }}
            >
              เปิดดูคำขอเลย
            </button>
          </div>
        </div>
      )}

        {newTrainee && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              background: '#fff', padding: '2rem', borderRadius: '16px',
              maxWidth: '400px', width: '90%', textAlign: 'center',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }} className="animate-fade-in-up">
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>👋</div>
              <h3 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>คุณมีลูกเทรนลงทะเบียนใหม่</h3>
              {(() => {
                let prefix = 'คุณ ';
                if (newTrainee.dob && adminData?.dob) {
                  const traineeAge = new Date(newTrainee.dob).getTime();
                  const trainerAge = new Date(adminData.dob).getTime();
                  if (traineeAge > trainerAge) prefix = 'น้อง ';
                  else if (traineeAge < trainerAge) prefix = 'พี่ ';
                } else if (newTrainee.age && adminData?.age) {
                  if (newTrainee.age < adminData.age) prefix = 'น้อง ';
                  else if (newTrainee.age > adminData.age) prefix = 'พี่ ';
                }
                return (
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1.2rem' }}>
                    <strong>{prefix}{newTrainee.nickname}</strong>
                  </p>
                );
              })()}
              <button 
                className="btn-primary" 
                style={{ width: '100%' }}
                onClick={() => {
                  setSelectedTraineeForForm(newTrainee.nickname);
                  setNewTrainee(null);
                }}
              >
                เริ่มบันทึกค่าร่างกาย
              </button>
            </div>
          </div>
        )}
        <main style={{ paddingTop: '20px' }}>
          <MetricsForm 
            key={formKey}
            isRecordOnly={isRecordOnly}
            initialTraineeName={selectedTraineeForForm} 
            adminData={adminData}
            isSuperadmin={isRealSuperadmin}
            onViewStats={(id, nickname) => {
              if (id) setViewingTraineeId(id);
              if (nickname) {
                setSelectedTraineeForForm(nickname);
                sessionStorage.setItem('lastViewedTraineeNickname', nickname);
              }
              setViewMode('dashboard');
            }}
          />
        </main>
        {showFoodReviewModal && profile?.userId && (
          <TrainerFoodReviewModal 
            trainerId={profile.userId} 
            initialTraineeId={reviewTraineeId}
            onClose={() => {
              setShowFoodReviewModal(false);
              if (reviewTraineeId) {
                navigate('/', { replace: true });
              }
            }} 
          />
        )}
        {showEventsModal && profile?.userId && (
          <EventsModal 
            onClose={() => setShowEventsModal(false)}
            userId={profile.userId}
            role={isSuperadmin ? 'superadmin' : 'trainer'}
            onSwitchAppointments={() => {
              setShowEventsModal(false);
              setShowAppointmentsModal(true);
            }}
          />
        )}
        {showAppointmentsModal && profile?.userId && (
          <AppointmentsModal 
            onClose={() => setShowAppointmentsModal(false)}
            userId={profile.userId}
            role={isSuperadmin ? 'superadmin' : 'trainer'}
            onSwitchEvents={() => {
              setShowAppointmentsModal(false);
              setShowEventsModal(true);
            }}
          />
        )}
        {showBillingModal && profile?.userId && (
          <EventsModal 
            onClose={() => setShowBillingModal(false)}
            userId={profile.userId}
            role={isSuperadmin ? 'superadmin' : 'trainer'}
            initialMode="billing"
            billingOnly={true}
          />
        )}
        {showKnowledgeModal && profile?.userId && (
          <HealthKnowledgeModal 
            onClose={() => setShowKnowledgeModal(false)}
            userId={profile.userId}
          />
        )}
        {activeKnowledgeItem && (
          <HealthKnowledgePlayerModal
            videoUrl={activeKnowledgeItem.videoUrl}
            title={activeKnowledgeItem.title}
            category={activeKnowledgeItem.category}
            onClose={() => setActiveKnowledgeItem(null)}
          />
        )}
        {showInviteSuccess && (
          <SuccessPopup show={showInviteSuccess} message="ส่งการ์ดเชิญสำเร็จ" />
        )}
        <DevPanel />
      </>
    );
  }

  // Unauthorized access overlay for non-trainers accessing review-food
  const UnauthorizedModal = () => {
    if (!reviewTraineeId) return null;
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.55)', zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
      }}>
        <div style={{
          background: '#fff', borderRadius: '24px', padding: '32px 24px',
          width: '100%', maxWidth: '340px', textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          animation: 'fadeInUp 0.3s ease'
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🔒</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#1e293b', fontWeight: 700 }}>
            ไม่มีสิทธิ์เข้าถึง
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 24px 0', lineHeight: 1.6 }}>
            หน้านี้สำหรับเทรนเนอร์ที่ได้รับอนุมัติเท่านั้น<br />
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้
          </p>
          <button
            onClick={() => {
              if (liff.isInClient()) {
                liff.closeWindow();
              } else {
                navigate('/', { replace: true });
              }
            }}
            style={{
              width: '100%', padding: '0.8rem', borderRadius: '14px',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff', border: 'none', fontWeight: 700,
              fontSize: '0.95rem', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(124,58,237,0.3)'
            }}
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    );
  };

  // If registered trainee, show dashboard
  if (role === 'trainee') {
    return (
      <>
        <UnauthorizedModal />
        <TraineeDashboard showProfile={false} />
        {activeKnowledgeItem && (
          <HealthKnowledgePlayerModal
            videoUrl={activeKnowledgeItem.videoUrl}
            title={activeKnowledgeItem.title}
            category={activeKnowledgeItem.category}
            onClose={() => setActiveKnowledgeItem(null)}
          />
        )}
        <DevPanel />
      </>
    );
  }

  // Fallback (e.g. if redirect didn't happen fast enough)
  if (reviewTraineeId) {
    return <UnauthorizedModal />;
  }

  return null;
}

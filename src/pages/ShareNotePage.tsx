import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useLiff } from '../context/LiffContext';
import liff from '@line/liff';
import { AutoResizeTextarea } from '../components/AutoResizeTextarea';

interface NoteItem {
  id: string;
  knowledgeId: string;
  userId: string;
  displayName: string;
  pictureUrl: string;
  note: string;
  createdAt: any;
}

export default function ShareNotePage() {
  const [searchParams] = useSearchParams();

  const getParamSafe = (name: string): string | null => {
    let val = searchParams.get(name);
    if (val) return val;

    const urlParams = new URLSearchParams(window.location.search);
    val = urlParams.get(name);
    if (val) return val;

    const href = window.location.href;
    const regex = new RegExp(`[?&]${name}=([^&#]*)`, 'i');
    const match = href.match(regex);
    if (match) return decodeURIComponent(match[1]);

    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    val = hashParams.get(name);
    if (val) return val;

    const liffState = urlParams.get('liff.state');
    if (liffState) {
      const decodedState = decodeURIComponent(liffState);
      const stateParams = new URLSearchParams(decodedState.split('?')[1] || decodedState);
      val = stateParams.get(name);
      if (val) return val;

      const stateRegex = new RegExp(`[?&]${name}=([^&#]*)`, 'i');
      const stateMatch = decodedState.match(stateRegex);
      if (stateMatch) return decodeURIComponent(stateMatch[1]);
    }

    return null;
  };

  const knowledgeId = getParamSafe('knowledgeId');
  const { profile, loading: liffLoading, error: liffError } = useLiff();

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState<any>(null);
  const [prevKnowledgeId, setPrevKnowledgeId] = useState(knowledgeId);
  const [noteText, setNoteText] = useState(() => {
    if (knowledgeId) {
      return localStorage.getItem(`fj_draft_note_${knowledgeId}`) || '';
    }
    return '';
  });

  if (knowledgeId !== prevKnowledgeId) {
    setPrevKnowledgeId(knowledgeId);
    setNoteText(knowledgeId ? (localStorage.getItem(`fj_draft_note_${knowledgeId}`) || '') : '');
  }

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  // Continue Video Refs & States
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const toastTimeoutRef = useRef<any>(null);
  const [showContinueToast, setShowContinueToast] = useState(false);
  const [lastResumeTime, setLastResumeTime] = useState<number | null>(null);

  // Helper to load Youtube Iframe API safely
  const loadYoutubeAPI = (callback: () => void) => {
    if ((window as any).YT && (window as any).YT.Player) {
      callback();
      return;
    }

    if (!document.getElementById('youtube-iframe-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const interval = setInterval(() => {
      if ((window as any).YT && (window as any).YT.Player) {
        clearInterval(interval);
        callback();
      }
    }, 100);
  };

  // YouTube Player initialization and progress tracking
  useEffect(() => {
    if (!isPlayingVideo || !knowledge) return;
    const isYoutube = knowledge.videoUrl?.includes('youtube.com') || knowledge.videoUrl?.includes('youtu.be');
    if (!isYoutube) return;

    let player: any;
    let timerId: any;

    const initYT = () => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = knowledge.videoUrl.match(regExp);
      const ytId = (match && match[2].length === 11) ? match[2] : null;
      if (!ytId) return;

      const savedTimeStr = localStorage.getItem(`fj_video_progress_${knowledgeId}`);
      const savedTime = savedTimeStr ? parseFloat(savedTimeStr) : 0;

      const targetEl = document.getElementById('yt-player');
      if (!targetEl) {
        requestAnimationFrame(initYT);
        return;
      }

      player = new (window as any).YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        videoId: ytId,
        playerVars: {
          autoplay: 1,
          start: savedTime > 2 ? Math.floor(savedTime) : 0,
          rel: 0
        },
        events: {
          onReady: () => {
            ytPlayerRef.current = player;
            if (savedTime > 2) {
              setLastResumeTime(savedTime);
              setShowContinueToast(true);
              if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
              toastTimeoutRef.current = setTimeout(() => {
                setShowContinueToast(false);
              }, 5000);
            }
          },
          onStateChange: (event: any) => {
            if (event.data === 1) { // YT.PlayerState.PLAYING
              timerId = setInterval(() => {
                if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
                  const curr = player.getCurrentTime();
                  const duration = player.getDuration();
                  if (duration && duration - curr > 5) {
                    localStorage.setItem(`fj_video_progress_${knowledgeId}`, curr.toString());
                  } else {
                    localStorage.removeItem(`fj_video_progress_${knowledgeId}`);
                  }
                }
              }, 1000);
            } else {
              if (timerId) {
                clearInterval(timerId);
                timerId = null;
              }
            }
          }
        }
      });
    };

    loadYoutubeAPI(() => {
      initYT();
    });

    return () => {
      if (timerId) clearInterval(timerId);
      if (player && typeof player.destroy === 'function') {
        player.destroy();
      }
      ytPlayerRef.current = null;
    };
  }, [isPlayingVideo, knowledge, knowledgeId]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleVideoPlay = () => {
    const savedTimeStr = localStorage.getItem(`fj_video_progress_${knowledgeId}`);
    if (savedTimeStr && videoRef.current) {
      const savedTime = parseFloat(savedTimeStr);
      if (savedTime > 2 && videoRef.current.currentTime < 1) {
        videoRef.current.currentTime = savedTime;
        setLastResumeTime(savedTime);
        setShowContinueToast(true);
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => {
          setShowContinueToast(false);
        }, 5000);
      }
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      if (duration && duration - curr > 5) {
        localStorage.setItem(`fj_video_progress_${knowledgeId}`, curr.toString());
      } else {
        localStorage.removeItem(`fj_video_progress_${knowledgeId}`);
      }
    }
  };

  const handleRestartVideo = () => {
    localStorage.removeItem(`fj_video_progress_${knowledgeId}`);
    setShowContinueToast(false);

    if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      ytPlayerRef.current.seekTo(0, true);
    }
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Save note draft to localStorage on change
  useEffect(() => {
    if (!knowledgeId) return;
    if (noteText) {
      localStorage.setItem(`fj_draft_note_${knowledgeId}`, noteText);
    } else {
      localStorage.removeItem(`fj_draft_note_${knowledgeId}`);
    }
  }, [noteText, knowledgeId]);

  // 1. Fetch Knowledge details
  useEffect(() => {
    if (liffLoading) return;
    if (liffError) {
      setErrorText(liffError);
      setLoading(false);
      return;
    }
    if (!profile) return;

    if (!knowledgeId) {
      setErrorText('ไม่พบรหัสคลังความรู้ (knowledgeId)');
      setLoading(false);
      return;
    }

    const fetchKnowledge = async () => {
      try {
        const docRef = doc(db, 'healthKnowledges', knowledgeId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setErrorText('ไม่พบข้อมูลสื่อความรู้นี้ในระบบ');
          setLoading(false);
          return;
        }

        setKnowledge({ id: docSnap.id, ...docSnap.data() });
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching knowledge:', err);
        setErrorText(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
        setLoading(false);
      }
    };

    fetchKnowledge();
  }, [knowledgeId, liffLoading, liffError, profile]);

  // 2. Listen to notes for this knowledgeId (Real-time)
  useEffect(() => {
    if (!knowledgeId) return;

    const q = query(
      collection(db, 'knowledgeNotes'),
      where('knowledgeId', '==', knowledgeId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: NoteItem[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as NoteItem);
      });
      setNotes(list);
    }, (err) => {
      console.error('Error listening to notes:', err);
    });

    return () => unsubscribe();
  }, [knowledgeId]);

  // Sort notes in memory to prevent missing index errors in Firestore
  const sortedNotes = [...notes].sort((a, b) => {
    const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
    const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
    return timeB - timeA;
  });

  const handleShareNote = async () => {
    if (!noteText.trim()) {
      alert('กรุณากรอกความรู้ที่ได้รับก่อนแชร์ครับ');
      return;
    }

    if (!profile) {
      alert('ไม่พบข้อมูลโปรไฟล์ LINE ของคุณ กรุณาลองใหม่อีกครั้ง');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Save to database
      const newNote = {
        knowledgeId: knowledgeId,
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl || '',
        note: noteText.trim(),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'knowledgeNotes'), newNote);

      // 2. Construct Flex Message
      const noteFlexMsg = {
        type: 'flex',
        altText: `📝 ${profile.displayName} ได้แบ่งปันความรู้ที่ได้รับ`,
        contents: {
          type: 'bubble',
          ...(knowledge.isChallenge ? {
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#E11D48',
              paddingAll: 'sm',
              contents: [
                {
                  type: 'text',
                  text: 'ฟังลิงก์ Challenge',
                  color: '#FFFFFF',
                  weight: 'bold',
                  size: 'sm',
                  align: 'center'
                }
              ]
            }
          } : {}),
          hero: {
            type: 'image',
            url: knowledge.videoThumbnailUrl || 'https://i.ytimg.com/vi/placeholder/maxresdefault.jpg',
            size: 'full',
            aspectRatio: '16:9',
            aspectMode: 'cover'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: [
              ...(knowledge.isChallenge ? [
                {
                  type: 'text',
                  text: 'ชวนฟังลิงก์นี้ แชร์สิ่งที่ได้รับ\nส่งต่อความฮอตให้เพื่อน ๆ ในกลุ่มกัน',
                  size: 'xs',
                  color: '#718096',
                  wrap: true,
                  align: 'center',
                  lineSpacing: '4px'
                },
                {
                  type: 'separator'
                }
              ] : []),
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'md',
                alignItems: 'center',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    width: '40px',
                    height: '40px',
                    cornerRadius: 'xxl',
                    contents: [
                      {
                        type: 'image',
                        url: profile.pictureUrl || 'https://cdn-icons-png.flaticon.com/512/9513/9513588.png',
                        size: 'full',
                        aspectRatio: '1:1',
                        aspectMode: 'cover'
                      }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                      {
                        type: 'text',
                        text: profile.displayName,
                        weight: 'bold',
                        size: 'sm',
                        color: '#1e293b'
                      },
                      {
                        type: 'text',
                        text: 'แชร์ความรู้ที่ได้ 💡',
                        size: 'xxs',
                        color: '#64748b'
                      }
                    ]
                  }
                ]
              },
              {
                type: 'separator'
              },
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#f8fafc',
                paddingAll: 'md',
                cornerRadius: 'md',
                contents: [
                  {
                    type: 'text',
                    text: noteText.trim(),
                    wrap: true,
                    size: 'sm',
                    color: '#334155',
                    lineSpacing: '4px'
                  }
                ]
              }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'md',
                alignItems: 'center',
                contents: [
                  {
                    type: 'image',
                    url: 'https://i.ibb.co/nKmrGp7/media-1782811555487.png',
                    size: '40px',
                    aspectRatio: '1:1',
                    aspectMode: 'cover',
                    flex: 0,
                    action: {
                      type: 'uri',
                      label: 'Play',
                      uri: knowledge.videoUrl ? (knowledge.videoUrl.includes('?') ? `${knowledge.videoUrl}&openExternalBrowser=1` : `${knowledge.videoUrl}?openExternalBrowser=1`) : ''
                    }
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: '#10B981',
                    cornerRadius: 'xxl',
                    paddingAll: '10px',
                    flex: 1,
                    action: {
                      type: 'uri',
                      label: 'ขอแชร์ด้วย',
                      uri: `https://liff.line.me/2010284484-SbnH29sB?knowledgeId=${knowledgeId}`
                    },
                    contents: [
                      {
                        type: 'text',
                        text: 'ขอแชร์ด้วย 📝',
                        color: '#ffffff',
                        weight: 'bold',
                        size: 'sm',
                        align: 'center'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      };

      // 3. Share message
      let sharedSuccessfully = false;

      if (liff.isInClient()) {
        try {
          await liff.sendMessages([noteFlexMsg as any]);
          sharedSuccessfully = true;
        } catch (sendErr) {
          console.warn('Failed to send messages directly, falling back to shareTargetPicker:', sendErr);
        }
      }

      if (!sharedSuccessfully && liff.isApiAvailable('shareTargetPicker')) {
        const res = await liff.shareTargetPicker([noteFlexMsg as any]);
        if (res) {
          sharedSuccessfully = true;
        }
      }

      if (sharedSuccessfully || liff.isInClient()) {
        setShowSuccess(true);
        if (knowledgeId) {
          localStorage.removeItem(`fj_draft_note_${knowledgeId}`);
        }
        setNoteText('');
        if (liff.isInClient()) {
          setTimeout(() => {
            liff.closeWindow();
          }, 2000);
        }
      } else {
        alert('ระบบบันทึกความรู้เรียบร้อยแล้ว แต่อุปกรณ์นี้ไม่รองรับการแชร์ในห้องแชท');
        if (knowledgeId) {
          localStorage.removeItem(`fj_draft_note_${knowledgeId}`);
        }
        setNoteText('');
      }
    } catch (err: any) {
      console.error('Error sharing note:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกหรือแชร์ข้อมูล: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeAgo = (createdAt: any) => {
    if (!createdAt) return '';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'เมื่อครู่นี้';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `เมื่อ ${diffMin} นาทีที่แล้ว`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `เมื่อ ${diffHour} ชั่วโมงที่แล้ว`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `เมื่อ ${diffDay} วันที่แล้ว`;
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  };

  if (liffLoading || loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #FF416C', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '20px', fontSize: '1.1rem', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>กำลังโหลดข้อมูล...</p>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  if (errorText) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <span style={{ fontSize: '3rem' }}>⚠️</span>
        <h2 style={{ margin: '15px 0 10px 0', color: '#e11d48' }}>พบข้อผิดพลาด</h2>
        <p style={{ color: '#64748b', marginBottom: '20px', maxWidth: '400px' }}>{errorText}</p>
        <button 
          onClick={() => {
            try {
              liff.closeWindow();
            } catch (e) {
              window.close();
            }
          }}
          style={{ padding: '10px 24px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ปิดหน้านี้
        </button>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
            <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </div>
        <h2 style={{ marginTop: '24px', color: '#16a34a', fontWeight: 'bold', fontSize: '1.3rem', textAlign: 'center', padding: '0 20px', lineHeight: '1.6' }}>
          แชร์ความรู้ที่ได้รับสำเร็จแล้ว! 🎉
        </h2>
        <p style={{ marginTop: '8px', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
          ระบบจะปิดหน้าต่างนี้โดยอัตโนมัติ
        </p>
        <style dangerouslySetInnerHTML={{__html: `
          .checkmark {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: block;
            stroke-width: 4;
            stroke: #16a34a;
            stroke-miterlimit: 10;
            box-shadow: inset 0px 0px 0px #16a34a;
            animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both;
          }
          .checkmark__circle {
            stroke-dasharray: 166;
            stroke-dashoffset: 166;
            stroke-width: 4;
            stroke-miterlimit: 10;
            stroke: #16a34a;
            fill: none;
            animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
          }
          .checkmark__check {
            transform-origin: 50% 50%;
            stroke-dasharray: 48;
            stroke-dashoffset: 48;
            stroke: #ffffff;
            animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
          }
          @keyframes stroke {
            100% { stroke-dashoffset: 0; }
          }
          @keyframes fill {
            100% { box-shadow: inset 0px 0px 0px 40px #16a34a; }
          }
          @keyframes scale {
            0%, 100% { transform: none; }
            50% { transform: scale3d(1.1, 1.1, 1); }
          }
        `}} />
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      minHeight: '100vh',
      padding: '20px 16px',
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxSizing: 'border-box'
    }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}} />
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '420px',
        padding: '24px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Clip Thumbnail & Title Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {knowledge && (isPlayingVideo ? (
            <div 
              style={{
                width: '100%',
                aspectRatio: '16/9',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                backgroundColor: '#000',
                position: 'relative'
              }}
            >
              {(() => {
                const isYoutube = knowledge.videoUrl?.includes('youtube.com') || knowledge.videoUrl?.includes('youtu.be');
                if (isYoutube) {
                  return (
                    <div 
                      id="yt-player" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        display: 'block' 
                      }} 
                    />
                  );
                }
                return (
                  <video
                    ref={videoRef}
                    src={knowledge.videoUrl}
                    autoPlay
                    controls
                    playsInline
                    loop
                    onPlay={handleVideoPlay}
                    onTimeUpdate={handleVideoTimeUpdate}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                );
              })()}

              {/* Premium Glassmorphism Continue Playback Toast */}
              {showContinueToast && lastResumeTime !== null && (
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '30px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  zIndex: 100,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  animation: 'fadeIn 0.3s ease-out',
                  pointerEvents: 'auto',
                  whiteSpace: 'nowrap'
                }}>
                  <span>▶ เล่นต่อจากที่ดูค้างไว้ ({formatSeconds(lastResumeTime)})</span>
                  <button
                    onClick={handleRestartVideo}
                    style={{
                      background: '#FF416C',
                      color: '#ffffff',
                      border: 'none',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      transition: 'transform 0.1s'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    เริ่มใหม่ ↺
                  </button>
                  <button
                    onClick={() => setShowContinueToast(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      padding: '0 2px',
                      fontWeight: 'bold'
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ) : knowledge.videoThumbnailUrl ? (
            <div 
              style={{
                width: '100%',
                aspectRatio: '16/9',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                position: 'relative',
                cursor: 'pointer'
              }}
              onClick={() => {
                if (knowledge.videoUrl) {
                  setIsPlayingVideo(true);
                }
              }}
            >
              <img
                src={knowledge.videoThumbnailUrl}
                alt="Clip Cover"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* Play Button Overlay */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                transition: 'background-color 0.2s'
              }}>
                <div 
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 65, 108, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 16px rgba(255, 65, 108, 0.4)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ marginLeft: '3px' }}
                  >
                    <path d="M8 5V19L19 12L8 5Z" fill="#FFFFFF" />
                  </svg>
                </div>
              </div>
            </div>
          ) : null)}
          <h3 style={{
            margin: '4px 0 0 0',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            color: '#1e293b',
            lineHeight: 1.4,
            textAlign: 'left'
          }}>
            {knowledge ? knowledge.title : ''}
          </h3>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: '#f1f5f9' }} />

        {/* User Information */}
        {profile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '12px 16px', borderRadius: '16px' }}>
            {profile.pictureUrl ? (
              <img
                src={profile.pictureUrl}
                alt="profile"
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #ede9fe' }}
              />
            ) : (
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>👤</div>
            )}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#334155' }}>{profile.displayName}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>ผู้ส่งบันทึกความรู้</div>
            </div>
          </div>
        ) : null}

        {/* Text Input Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>
            💡 ความรู้ที่ได้รับจากคลิปนี้
          </label>
          <AutoResizeTextarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            disabled={submitting}
            placeholder="พิมพ์สรุปความรู้หรือสิ่งที่ได้รับที่ประทับใจ..."
            maxLength={800}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '16px',
              border: '1.5px solid #cbd5e1',
              fontSize: '0.95rem',
              color: '#334155',
              boxSizing: 'border-box',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              minHeight: '100px',
              overflowY: 'hidden',
              transition: 'border-color 0.2s'
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            fontSize: '0.75rem',
            color: noteText.length >= 800 ? '#ef4444' : '#94a3b8',
            marginTop: '2px'
          }}>
            {noteText.length} / 800 ตัวอักษร
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={handleShareNote}
          disabled={submitting || !noteText.trim()}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '16px',
            border: 'none',
            fontWeight: 'bold',
            fontSize: '1rem',
            cursor: noteText.trim() ? 'pointer' : 'not-allowed',
            background: noteText.trim() ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : '#e2e8f0',
            color: noteText.trim() ? '#ffffff' : '#94a3b8',
            boxShadow: noteText.trim() ? '0 8px 20px rgba(16,185,129,0.25)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          {submitting ? 'กำลังแชร์...' : 'แชร์ให้เพื่อน ๆ ➦'}
        </button>

        {/* Divider */}
        <div style={{ height: '1px', background: '#f1f5f9', marginTop: '8px' }} />

        {/* Friends' Notes List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
          {sortedNotes.length === 0 ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '0.85rem',
              backgroundColor: '#f8fafc',
              borderRadius: '16px',
              border: '1px dashed #cbd5e1'
            }}>
              ยังไม่มีใครแชร์บันทึกความรู้ของตนเองเป็นคนแรกเลย...
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxHeight: '350px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {sortedNotes.map((noteItem) => (
                <div 
                  key={noteItem.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '14px',
                    background: '#f8fafc',
                    borderRadius: '16px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
                  }}
                >
                  {noteItem.pictureUrl ? (
                    <img
                      src={noteItem.pictureUrl}
                      alt={noteItem.displayName}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>👤</div>
                  )}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#334155' }}>{noteItem.displayName}</span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{formatTimeAgo(noteItem.createdAt)}</span>
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: '0.85rem',
                      color: '#475569',
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {noteItem.note}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


    </div>
  );
}

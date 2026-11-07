import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import liff from '@line/liff';
import QRCode from 'qrcode';
import { useLiff } from '../context/LiffContext';
import {
  type SpyPlayer,
  type SpyRoom,
  type SpyAiHint,
  joinSpyGameRoom,
  subscribeToSpyRoom,
  subscribeToSpyPlayers,
  updateSpyRoomCategory,
  startSpyGame,
  markSpyCardViewed,
  revealSpyGame,
  resetSpyGame,
  leaveSpyGameRoom,
  POETIC_ROOM_NAMES,
  generateSpyAiHints,
} from '../services/spyGameService';

interface ModalDialogConfig {
  isOpen: boolean;
  type?: 'confirm' | 'alert' | 'danger';
  icon?: string;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export default function SpyGamePage() {
  const navigate = useNavigate();
  const params = useParams<{ roomId?: string }>();
  const [searchParams] = useSearchParams();
  const rawRoomId = params.roomId || searchParams.get('roomId') || '';
  const roomId = rawRoomId.trim().toLowerCase();
  const initialRoomName = searchParams.get('roomName') || searchParams.get('name') || '';

  const { profile, loading: liffLoading } = useLiff();

  // Local guest fallback if opened outside LINE or without login
  const [guestName, setGuestName] = useState(() => {
    return localStorage.getItem('spy_guest_name') || '';
  });
  const [guestId] = useState(() => {
    let id = localStorage.getItem('spy_guest_id');
    if (!id) {
      id = 'guest_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('spy_guest_id', id);
    }
    return id;
  });

  // Active user identity
  const activeUserId = profile?.userId || guestId;
  const activeDisplayName = profile?.displayName || guestName;
  const activePictureUrl = profile?.pictureUrl || '';

  // Room creation and Join by code state (for !roomId page)
  const [createRoomName, setCreateRoomName] = useState(() => {
    return POETIC_ROOM_NAMES[Math.floor(Math.random() * POETIC_ROOM_NAMES.length)];
  });
  const [hostNameInput, setHostNameInput] = useState(() => {
    return profile?.displayName || guestName || '';
  });
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState('');

  // Update hostNameInput if LINE profile loads later
  useEffect(() => {
    if (profile?.displayName && !hostNameInput) {
      setHostNameInput(profile.displayName);
    }
  }, [profile?.displayName, hostNameInput]);

  useEffect(() => {
    try {
      sessionStorage.setItem('is_spy_game', '1');
    } catch {}
  }, []);

  // Handle LIFF state redirect cleanup if present in query params
  useEffect(() => {
    const liffState = searchParams.get('liff.state');
    if (liffState) {
      const decoded = decodeURIComponent(liffState);
      const match = decoded.match(/spy-game\/([0-9a-zA-Z_-]+)/);
      if (match && match[1] && !params.roomId) {
        navigate(`/spy-game/${match[1]}`, { replace: true });
      }
    }
  }, [searchParams, params.roomId, navigate]);

  // Room State
  const [room, setRoom] = useState<SpyRoom | null>(null);
  const [players, setPlayers] = useState<SpyPlayer[]>([]);
  const [myPlayer, setMyPlayer] = useState<SpyPlayer | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [startingGame, setStartingGame] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasLeft, setHasLeft] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // QR Code Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // AI Hint Assistant State
  const [showHintModal, setShowHintModal] = useState(false);
  const [aiHints, setAiHints] = useState<SpyAiHint[]>([]);
  const [loadingAiHint, setLoadingAiHint] = useState(false);
  const [copiedHintIndex, setCopiedHintIndex] = useState<number | null>(null);

  // Generate Invite URL & QR Code
  const getInviteUrl = (code: string) => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.origin}/?page=spy-game&roomId=${code}`;
    }
    return `https://liff.line.me/2010284484-jvUDlx0u?page=spy-game&roomId=${code}`;
  };

  useEffect(() => {
    if (roomId) {
      const inviteUrl = getInviteUrl(roomId);
      const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(inviteUrl)}`;
      QRCode.toDataURL(inviteUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#1E293B',
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => setQrDataUrl(fallbackUrl));
    }
  }, [roomId]);

  // Custom FitJourney Themed Pop-up Dialog State
  const [dialog, setDialog] = useState<ModalDialogConfig>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showConfirm = ({
    title,
    message,
    icon = '❓',
    type = 'confirm',
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    onConfirm,
  }: {
    title: string;
    message: string;
    icon?: string;
    type?: 'confirm' | 'danger';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }) => {
    setDialog({
      isOpen: true,
      type,
      icon,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      onCancel: () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const showAlert = ({
    title,
    message,
    icon = '⚠️',
    confirmText = 'ตกลง',
  }: {
    title: string;
    message: string;
    icon?: string;
    confirmText?: string;
  }) => {
    setDialog({
      isOpen: true,
      type: 'alert',
      icon,
      title,
      message,
      confirmText,
      onConfirm: () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Card Flip State
  const [isFlipped, setIsFlipped] = useState(false);
  const prevStatusRef = useRef<string>('waiting');

  // Realtime Firebase Firestore subscriptions
  useEffect(() => {
    if (!roomId || liffLoading || !activeDisplayName) return;

    let unsubRoom: (() => void) | null = null;
    let unsubPlayers: (() => void) | null = null;
    let isMounted = true;

    const initRoom = async () => {
      try {
        await joinSpyGameRoom(
          roomId,
          {
            userId: activeUserId,
            displayName: activeDisplayName,
            pictureUrl: activePictureUrl,
          },
          initialRoomName
        );

        if (!isMounted) return;

        unsubRoom = subscribeToSpyRoom(roomId, (roomData) => {
          if (!isMounted) return;
          setRoom(roomData);
          if (roomData) {
            setIsHost(roomData.hostId === activeUserId);
            if (prevStatusRef.current !== 'playing' && roomData.status === 'playing') {
              setIsFlipped(false);
              setAiHints([]);
            }
            prevStatusRef.current = roomData.status;
          }
          setLoadingRoom(false);
        });

        unsubPlayers = subscribeToSpyPlayers(roomId, (playerList) => {
          if (!isMounted) return;
          setPlayers(playerList);
          const me = playerList.find((p) => p.userId === activeUserId);
          setMyPlayer(me || null);
        });
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err.message || 'ไม่สามารถเข้าร่วมห้องได้');
          setLoadingRoom(false);
        }
      }
    };

    initRoom();

    return () => {
      isMounted = false;
      if (unsubRoom) unsubRoom();
      if (unsubPlayers) unsubPlayers();
    };
  }, [roomId, activeUserId, activeDisplayName, liffLoading, activePictureUrl, initialRoomName]);

  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalHostName = hostNameInput.trim() || 'ผู้เล่น';
    if (!profile?.displayName) {
      setGuestName(finalHostName);
      localStorage.setItem('spy_guest_name', finalHostName);
    }
    setCreatingRoom(true);
    // Generate pure 6-digit numeric room code
    const newRoomId = String(Math.floor(100000 + Math.random() * 900000));
    const finalRoomName = createRoomName.trim() || 'อรุณรุ่งเรืองรอง';
    navigate(`/?page=spy-game&roomId=${newRoomId}&roomName=${encodeURIComponent(finalRoomName)}`);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinRoomCode.trim();
    if (!code) return;
    if (code.length !== 6) {
      showAlert({
        title: 'รหัสไม่ถูกต้อง',
        message: 'กรุณากรอกรหัสตัวเลข 6 หลักให้ครบถ้วน',
        icon: '🔢',
      });
      return;
    }
    navigate(`/?page=spy-game&roomId=${code}`);
  };

  const handleSelectCategory = async (category: 'food' | 'daily' | 'animal') => {
    if (!isHost || !roomId) return;
    try {
      await updateSpyRoomCategory(roomId, category);
    } catch (err: any) {
      showAlert({
        title: 'เปลี่ยนหมวดหมู่ไม่สำเร็จ',
        message: err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนหมวดหมู่',
        icon: '⚠️',
      });
    }
  };

  const handleStartGame = async () => {
    if (!isHost || !roomId) return;
    if (players.length < 2) {
      showAlert({
        title: 'ต้องการผู้เล่นเพิ่ม',
        message: 'ต้องการผู้เล่นอย่างน้อย 2 คนขึ้นไปเพื่อเริ่มเกม (แนะนำ 3 คนขึ้นไป)',
        icon: '👥',
      });
      return;
    }
    setStartingGame(true);
    try {
      await startSpyGame(roomId, room?.category || 'food', players);
    } catch (err: any) {
      showAlert({
        title: 'เริ่มเกมไม่สำเร็จ',
        message: err.message || 'ไม่สามารถเริ่มเกมได้ กรุณาลองใหม่อีกครั้ง',
        icon: '⚠️',
      });
    } finally {
      setStartingGame(false);
    }
  };

  const handleReveal = () => {
    if (!isHost || !roomId) return;
    showConfirm({
      title: 'เฉลยสายลับ',
      message: 'คุณต้องการเฉลยสายลับและจบเกมรอบนี้ใช่หรือไม่?',
      icon: '🔍',
      confirmText: 'เฉลยเลย',
      cancelText: 'เล่นต่อ',
      onConfirm: async () => {
        try {
          await revealSpyGame(roomId);
        } catch (err: any) {
          showAlert({
            title: 'เฉลยผลไม่สำเร็จ',
            message: err.message || 'ไม่สามารถเฉลยผลได้',
            icon: '⚠️',
          });
        }
      },
    });
  };

  const handleReset = async () => {
    if (!isHost || !roomId) return;
    try {
      await resetSpyGame(roomId, players);
      setIsFlipped(false);
      setAiHints([]);
    } catch (err: any) {
      showAlert({
        title: 'เกิดข้อผิดพลาด',
        message: err.message || 'ไม่สามารถเริ่มรอบใหม่ได้',
        icon: '⚠️',
      });
    }
  };

  const toggleFlip = () => {
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    const next = !isFlipped;
    setIsFlipped(next);
    if (next && roomId && activeUserId && !myPlayer?.cardViewed) {
      markSpyCardViewed(roomId, activeUserId).catch(() => {});
    }
  };

  const handleFetchAiHints = async () => {
    if (!myPlayer?.word || myPlayer.isSpy || myPlayer.is_spy) return;
    setShowHintModal(true);
    if (aiHints.length > 0) return;
    setLoadingAiHint(true);
    try {
      const hints = await generateSpyAiHints(myPlayer.word, room?.category || 'food');
      setAiHints(hints);
    } catch (err) {
      console.error('[SpyGame] Error getting AI hints:', err);
    } finally {
      setLoadingAiHint(false);
    }
  };

  const handleExitGame = () => {
    if (!roomId || !activeUserId || isExiting) return;
    showConfirm({
      title: 'ออกจากเกม',
      message: 'คุณต้องการออกจากเกมใช่หรือไม่?',
      icon: '🚪',
      type: 'danger',
      confirmText: 'ออกจากเกม',
      cancelText: 'อยู่ต่อ',
      onConfirm: async () => {
        setIsExiting(true);
        setHasLeft(true);
        try {
          await leaveSpyGameRoom(roomId, activeUserId, players);
        } catch (err: any) {
          console.error('[SpyGame] Error leaving room:', err);
        } finally {
          setIsExiting(false);
        }
      },
    });
  };

  const handleExitToHome = () => {
    try {
      if (liff && liff.isInClient && liff.isInClient()) {
        liff.closeWindow();
        return;
      }
    } catch {
      // ignore
    }
    navigate('/');
  };

  // -------------------------------------------------------------
  // SCREEN A: CREATE ROOM / JOIN BY CODE (When no roomId in URL)
  // Exactly matching the requested design mockup
  // -------------------------------------------------------------
  if (!roomId) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F8FAFC',
          backgroundImage:
            'radial-gradient(circle at top right, rgba(255,65,108,0.06), transparent 45%), radial-gradient(circle at bottom left, rgba(255,75,43,0.06), transparent 45%)',
          color: '#1E293B',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 20px',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Header Title Section */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '3.6rem', lineHeight: 1, marginBottom: '14px' }}>🕵️‍♂️</div>
            <div
              style={{
                color: '#FF416C',
                fontWeight: 900,
                letterSpacing: '2.5px',
                fontSize: '0.82rem',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}
            >
              UNDERCOVER GAME
            </div>
            <h1
              style={{
                fontSize: '2rem',
                fontWeight: 900,
                color: '#1E293B',
                margin: '0 0 8px 0',
                letterSpacing: '-0.5px',
              }}
            >
              เกมจับสายลับ
            </h1>
            <p
              style={{
                color: '#64748B',
                fontSize: '0.92rem',
                margin: 0,
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              เกมบลัฟคำศัพท์สุดมันส์ หาตัวสายลับที่เนียนที่สุดในกลุ่ม!
            </p>
          </div>

          {/* Card 1: สร้างห้องเกมใหม่ */}
          <form
            onSubmit={handleCreateRoomSubmit}
            style={{
              background: '#FFFFFF',
              borderRadius: '26px',
              padding: '24px 22px',
              boxShadow: '0 12px 36px rgba(15, 23, 42, 0.06)',
              border: '1px solid #F1F5F9',
              marginBottom: '20px',
            }}
          >
            {/* Card Header */}
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: '#1E293B',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>✨</span>
              <span>สร้างห้องเกมใหม่</span>
            </div>

            {/* Field 1: ชื่อห้องเกม + สุ่มชื่อบทกวี */}
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                  🌸 ชื่อห้องเกม:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = POETIC_ROOM_NAMES[Math.floor(Math.random() * POETIC_ROOM_NAMES.length)];
                    setCreateRoomName(next);
                  }}
                  style={{
                    background: '#FFF1F2',
                    border: '1px solid #FECDD3',
                    color: '#FF416C',
                    borderRadius: '20px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s',
                  }}
                >
                  🎲 สุ่มชื่อบทกวี
                </button>
              </div>
              <input
                type="text"
                value={createRoomName}
                onChange={(e) => setCreateRoomName(e.target.value)}
                placeholder="เช่น อรุณรุ่งเรืองรอง"
                maxLength={30}
                required
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: '16px',
                  border: '1.5px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  color: '#1E293B',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Field 2: ชื่อของคุณ (ผู้สร้างห้อง) */}
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '8px',
                }}
              >
                👑 ชื่อของคุณ (ผู้สร้างห้อง):
              </label>
              <input
                type="text"
                value={hostNameInput}
                onChange={(e) => setHostNameInput(e.target.value)}
                placeholder="ระบุชื่อของคุณ"
                maxLength={20}
                required
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: '16px',
                  border: '1.5px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  color: '#1E293B',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div
                style={{
                  fontSize: '0.78rem',
                  color: '#64748B',
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ✏️ สามารถแก้ไขชื่อที่จะใช้แสดงในเกมได้ตามต้องการ
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={creatingRoom}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '18px',
                padding: '15px',
                fontSize: '1.05rem',
                fontWeight: 800,
                cursor: creatingRoom ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 25px rgba(255, 65, 108, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              {creatingRoom ? 'กำลังสร้างห้อง...' : '🚀 สร้างห้องเกมและเริ่มเล่น'}
            </button>
          </form>

          {/* Card 2: หรือเข้าร่วมด้วยรหัสตัวเลข 6 หลัก */}
          <form
            onSubmit={handleJoinByCode}
            style={{
              background: '#FFFFFF',
              borderRadius: '26px',
              padding: '22px 22px',
              boxShadow: '0 12px 36px rgba(15, 23, 42, 0.06)',
              border: '1px solid #F1F5F9',
            }}
          >
            <label
              style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '12px',
              }}
            >
              🔢 หรือเข้าร่วมด้วยรหัสตัวเลข 6 หลัก:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="tel"
                pattern="[0-9]*"
                maxLength={6}
                value={joinRoomCode}
                onChange={(e) => setJoinRoomCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="เช่น 123456"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '16px',
                  border: '1.5px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  color: '#1E293B',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  outline: 'none',
                  boxSizing: 'border-box',
                  letterSpacing: '3px',
                  textAlign: 'center',
                }}
              />
              <button
                type="submit"
                disabled={!joinRoomCode.trim()}
                style={{
                  width: '100%',
                  background: !joinRoomCode.trim() ? '#E2E8F0' : '#1E293B',
                  color: !joinRoomCode.trim() ? '#94A3B8' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '14px 20px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  cursor: !joinRoomCode.trim() ? 'not-allowed' : 'pointer',
                  boxShadow: !joinRoomCode.trim() ? 'none' : '0 4px 14px rgba(30, 41, 59, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
              >
                <span>เข้าห้อง</span>
                <span>➔</span>
              </button>
            </div>
          </form>
        </div>

        {/* FitJourney Themed Modal Dialog */}
        {dialog.isOpen && renderDialog()}
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN B: GUEST NAME PROMPT (When entering room via URL/QR without displayName)
  // -------------------------------------------------------------
  if (!liffLoading && !activeDisplayName) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F8FAFC',
          backgroundImage:
            'radial-gradient(circle at top right, rgba(255,65,108,0.06), transparent 45%), radial-gradient(circle at bottom left, rgba(255,75,43,0.06), transparent 45%)',
          color: '#1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = hostNameInput.trim();
            if (!trimmed) return;
            setGuestName(trimmed);
            localStorage.setItem('spy_guest_name', trimmed);
          }}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '26px',
            padding: '32px 24px',
            width: '100%',
            maxWidth: '360px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(15, 23, 42, 0.12)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🕵️‍♂️</div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1E293B', margin: '0 0 6px 0' }}>
            เข้าเล่นเกมจับสายลับ
          </h2>
          <p style={{ color: '#FF416C', fontSize: '0.88rem', fontWeight: 700, margin: '0 0 12px 0' }}>
            🔢 รหัสห้อง: {roomId}
          </p>
          <p style={{ fontSize: '0.88rem', color: '#64748B', margin: '0 0 20px 0', lineHeight: 1.5 }}>
            กรุณาระบุชื่อของคุณเพื่อเข้าร่วมห้องกับเพื่อน ๆ
          </p>

          <input
            type="text"
            required
            autoFocus
            maxLength={20}
            placeholder="เช่น มังกร, เจมส์, แพรว"
            value={hostNameInput}
            onChange={(e) => setHostNameInput(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '16px',
              border: '2px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              color: '#1E293B',
              fontSize: '1rem',
              fontWeight: 600,
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '16px',
            }}
          />

          <button
            type="submit"
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '16px',
              padding: '14px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(255, 65, 108, 0.3)',
            }}
          >
            เข้าห้องเล่นเลย 🎮
          </button>
        </form>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN C: LOADING ROOM
  // -------------------------------------------------------------
  if (liffLoading || loadingRoom) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F8FAFC',
          color: '#1E293B',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '4px solid #F1F5F9',
            borderTopColor: '#FF416C',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px',
          }}
        />
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1E293B' }}>
          กำลังโหลดห้องเกม... (รหัส: {roomId})
        </h2>
        {initialRoomName && (
          <p style={{ color: '#FF416C', fontSize: '0.9rem', marginTop: '6px', fontWeight: 600 }}>
            🌸 ห้อง "{initialRoomName}"
          </p>
        )}
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN D: USER LEFT OR ROOM CLOSED (NO "กลับสู่หน้าหลัก" on exit)
  // -------------------------------------------------------------
  if (!loadingRoom && (!room || room.status === 'closed' || hasLeft)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F8FAFC',
          backgroundImage:
            'radial-gradient(circle at top right, rgba(255,65,108,0.06), transparent 45%), radial-gradient(circle at bottom left, rgba(255,75,43,0.06), transparent 45%)',
          color: '#1E293B',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            backgroundColor: '#FFF1F4',
            color: '#FF416C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.4rem',
            marginBottom: '20px',
            boxShadow: '0 8px 24px rgba(255, 65, 108, 0.12)',
          }}
        >
          {hasLeft ? '🚪' : '🔒'}
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E293B', marginBottom: '8px' }}>
          {hasLeft ? 'คุณออกจากเกมแล้ว' : 'ห้องนี้ถูกปิดแล้ว'}
        </h2>
        <p
          style={{
            color: '#64748B',
            fontSize: '0.92rem',
            maxWidth: '320px',
            lineHeight: 1.6,
            marginBottom: hasLeft ? '0' : '28px',
          }}
        >
          {hasLeft
            ? 'คุณได้ออกจากเกมเรียบร้อยแล้ว ขอบคุณที่มาร่วมสนุกกับเพื่อน ๆ'
            : 'ห้องเกมนี้ถูกปิดแล้ว หรือเกมสิ้นสุดลงแล้ว'}
        </p>

        {/* If room was closed by host and user hasn't explicitly clicked left, offer exit */}
        {!hasLeft && (
          <button
            onClick={handleExitToHome}
            style={{
              background: 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '16px',
              padding: '14px 28px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(255, 65, 108, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            🏠 กลับสู่หน้าหลัก FitJourney
          </button>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN E: IN-GAME ROOM (WAITING / PLAYING / REVEALED)
  // -------------------------------------------------------------
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        backgroundImage:
          'radial-gradient(circle at top right, rgba(255,65,108,0.06), transparent 45%), radial-gradient(circle at bottom left, rgba(255,75,43,0.06), transparent 45%)',
        color: '#1E293B',
        fontFamily: 'Inter, system-ui, sans-serif',
        paddingBottom: '40px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E2E8F0',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.6rem' }}>🕵️‍♂️</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 900, letterSpacing: '1px', color: '#FF416C' }}>
                UNDERCOVER
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: '#FFF1F4',
                  color: '#E11D48',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  border: '1px solid #FECDD3',
                }}
              >
                รหัส: {roomId}
              </span>
            </div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1E293B', marginTop: '1px' }}>
              {room?.roomName ? `🌸 ห้อง "${room.roomName}"` : 'เกมจับสายลับ'}
            </div>
          </div>
        </div>

        {/* ปุ่มชวนเพื่อน เปิด QR Code Modal */}
        <button
          onClick={() => setShowQrModal(true)}
          style={{
            background: '#FFF1F4',
            color: '#FF416C',
            border: '1px solid #FECDD3',
            padding: '7px 14px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(255, 65, 108, 0.1)',
          }}
        >
          <span>📱</span>
          <span>ชวนเพื่อน</span>
        </button>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 16px' }}>
        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '16px',
              color: '#DC2626',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>⚠️ {errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ----------------- STATE 1: WAITING LOBBY ----------------- */}
        {room?.status === 'waiting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Players in Lobby */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '20px',
                padding: '18px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>ผู้เล่นที่เข้าร่วมแล้ว ({players.length} คน)</span>
                <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>● ออนไลน์</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '10px',
                }}
              >
                {players.map((p) => {
                  const isMe = p.user_id === activeUserId;
                  return (
                    <div
                      key={p.user_id}
                      style={{
                        background: isMe ? '#FFF1F4' : '#F8FAFC',
                        border: isMe ? '1px solid #FECDD3' : '1px solid #E2E8F0',
                        borderRadius: '14px',
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          backgroundColor: '#E2E8F0',
                          backgroundImage: p.picture_url ? `url(${p.picture_url})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: '#64748B',
                          flexShrink: 0,
                        }}
                      >
                        {!p.picture_url && p.display_name.charAt(0)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: isMe ? '#E11D48' : '#1E293B',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {p.display_name} {isMe ? '(คุณ)' : ''}
                        </div>
                        {p.is_host && (
                          <div style={{ fontSize: '0.65rem', color: '#D97706', fontWeight: 600 }}>👑 Host</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Selector with 3 Categories (food, daily, animal) */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '20px',
                padding: '18px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>หมวดหมู่คำศัพท์ (Category)</span>
                {isHost && <span style={{ fontSize: '0.75rem', color: '#FF416C', fontWeight: 600 }}>แตะเพื่อเลือก</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {/* Food Category */}
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleSelectCategory('food')}
                  style={{
                    background:
                      (room?.category || 'food') === 'food'
                        ? 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)'
                        : '#F8FAFC',
                    border:
                      (room?.category || 'food') === 'food' ? '2px solid #FF416C' : '1px solid #E2E8F0',
                    borderRadius: '16px',
                    padding: '16px 8px',
                    color: (room?.category || 'food') === 'food' ? '#FFFFFF' : '#475569',
                    cursor: isHost ? 'pointer' : 'default',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    boxShadow:
                      (room?.category || 'food') === 'food' ? '0 8px 18px rgba(255, 65, 108, 0.3)' : 'none',
                  }}
                >
                  <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>🍲</div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>อาหาร</div>
                </button>

                {/* Daily Essentials Category */}
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleSelectCategory('daily')}
                  style={{
                    background:
                      room?.category === 'daily'
                        ? 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)'
                        : '#F8FAFC',
                    border: room?.category === 'daily' ? '2px solid #FF416C' : '1px solid #E2E8F0',
                    borderRadius: '16px',
                    padding: '16px 8px',
                    color: room?.category === 'daily' ? '#FFFFFF' : '#475569',
                    cursor: isHost ? 'pointer' : 'default',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    boxShadow: room?.category === 'daily' ? '0 8px 18px rgba(255, 65, 108, 0.3)' : 'none',
                  }}
                >
                  <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>🧴</div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>ของใช้</div>
                </button>

                {/* Animal Category (สัตว์โลกน่ารัก) */}
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleSelectCategory('animal')}
                  style={{
                    background:
                      room?.category === 'animal'
                        ? 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)'
                        : '#F8FAFC',
                    border: room?.category === 'animal' ? '2px solid #FF416C' : '1px solid #E2E8F0',
                    borderRadius: '16px',
                    padding: '16px 8px',
                    color: room?.category === 'animal' ? '#FFFFFF' : '#475569',
                    cursor: isHost ? 'pointer' : 'default',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    boxShadow: room?.category === 'animal' ? '0 8px 18px rgba(255, 65, 108, 0.3)' : 'none',
                  }}
                >
                  <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>🐾</div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>สัตว์โลก</div>
                </button>
              </div>
            </div>

            {/* Action Section */}
            {isHost ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleStartGame}
                  disabled={startingGame || players.length < 2 || isExiting}
                  style={{
                    background:
                      players.length < 2
                        ? '#E2E8F0'
                        : 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)',
                    color: players.length < 2 ? '#94A3B8' : '#FFFFFF',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '16px',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    cursor: players.length < 2 || startingGame || isExiting ? 'not-allowed' : 'pointer',
                    width: '100%',
                    boxShadow: players.length >= 2 ? '0 10px 24px rgba(255, 65, 108, 0.35)' : 'none',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {startingGame ? (
                    <>กำลังแจกการ์ด...</>
                  ) : (
                    <>🚀 เริ่มเกมจับสายลับ ({players.length} คน)</>
                  )}
                </button>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={handleExitGame}
                    disabled={isExiting}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      fontSize: '0.85rem',
                      cursor: isExiting ? 'not-allowed' : 'pointer',
                      padding: '8px 16px',
                      textDecoration: 'underline',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    🚪 ออกจากเกม
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    padding: '20px',
                    textAlign: 'center',
                    border: '1px dashed #CBD5E1',
                    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1E293B' }}>
                    กำลังรอ Host เริ่มเกม...
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>
                    เมื่อ Host กดเริ่ม AI จะสุ่มคำศัพท์ส่งให้ทุกคน
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={handleExitGame}
                    disabled={isExiting}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      fontSize: '0.85rem',
                      cursor: isExiting ? 'not-allowed' : 'pointer',
                      padding: '8px 16px',
                      textDecoration: 'underline',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    🚪 ออกจากเกม
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- STATE 2: PLAYING (3D CARD FLIP) ----------------- */}
        {room?.status === 'playing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            {/* Room Name & Category Banner with Room Code */}
            <div
              style={{
                background: '#FFFFFF',
                padding: '8px 18px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#334155',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: '#FF416C' }}>🔢 รหัส {roomId}</span>
              <span style={{ color: '#CBD5E1' }}>•</span>
              {room?.roomName && (
                <>
                  <span style={{ color: '#1E293B' }}>🌸 {room.roomName}</span>
                  <span style={{ color: '#CBD5E1' }}>•</span>
                </>
              )}
              <span>
                {room?.category === 'animal'
                  ? '🐾 หมวดสัตว์โลกน่ารัก'
                  : room?.category === 'daily'
                  ? '🧴 หมวดของใช้ในชีวิตประจำวัน'
                  : '🍲 หมวดอาหาร'}
              </span>
              <span style={{ color: '#CBD5E1' }}>•</span>
              <span style={{ color: '#64748B' }}>ผู้เล่น {players.length} คน</span>
            </div>

            {/* 3D Flip Card Container */}
            <div
              onClick={toggleFlip}
              style={{
                width: '100%',
                maxWidth: '300px',
                height: '420px',
                perspective: '1000px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  textAlign: 'center',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* --- CARD BACK (คว่ำการ์ด) --- */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    borderRadius: '24px',
                    background: 'linear-gradient(145deg, #FF416C 0%, #FF4B2B 100%)',
                    border: '3px solid #FFFFFF',
                    boxShadow:
                      '0 20px 45px rgba(255, 65, 108, 0.3), 0 4px 12px rgba(15, 23, 42, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '24px 20px',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Card Corner Accents with Room Code */}
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      color: 'rgba(255,255,255,0.9)',
                      fontWeight: 800,
                    }}
                  >
                    <span>♠</span>
                    <span>รหัส: {roomId} • UNDERCOVER</span>
                    <span>♠</span>
                  </div>

                  {/* Card Center Emblem */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '96px',
                        height: '96px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: '2px dashed rgba(255, 255, 255, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '3rem',
                        marginBottom: '16px',
                        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      🕵️‍♂️
                    </div>
                    <div
                      style={{
                        fontSize: '1.3rem',
                        fontWeight: 800,
                        color: '#FFFFFF',
                        letterSpacing: '0.5px',
                      }}
                    >
                      การ์ดคำศัพท์ลับ
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#FFE4E6', marginTop: '6px' }}>
                      แตะการ์ดเพื่อเปิดดูคำของคุณ
                    </div>
                  </div>

                  {/* Card Footer Warning */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.18)',
                      borderRadius: '12px',
                      padding: '8px 14px',
                      fontSize: '0.75rem',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🤫</span>
                    <span>ระวังคนข้างๆ แอบดูนะ!</span>
                  </div>
                </div>

                {/* --- CARD FRONT (หงายการ์ด) --- */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    borderRadius: '24px',
                    background: '#FFFFFF',
                    border:
                      myPlayer?.isSpy || myPlayer?.is_spy ? '3px solid #EF4444' : '3px solid #FF416C',
                    boxShadow:
                      myPlayer?.isSpy || myPlayer?.is_spy
                        ? '0 20px 45px rgba(239, 68, 68, 0.22), 0 4px 12px rgba(15, 23, 42, 0.05)'
                        : '0 20px 45px rgba(255, 65, 108, 0.18), 0 4px 12px rgba(15, 23, 42, 0.05)',
                    transform: 'rotateY(180deg)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '24px 20px',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Card Front Top */}
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom:
                        myPlayer?.isSpy || myPlayer?.is_spy ? '1px solid #FEE2E2' : '1px solid #FFE4E6',
                      paddingBottom: '10px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        color: myPlayer?.isSpy || myPlayer?.is_spy ? '#DC2626' : '#FF416C',
                      }}
                    >
                      {room?.category === 'animal'
                        ? '🐾 สัตว์โลก'
                        : room?.category === 'daily'
                        ? '🧴 ของใช้'
                        : '🍲 อาหาร'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: myPlayer?.isSpy || myPlayer?.is_spy ? '#DC2626' : '#64748B',
                        background: myPlayer?.isSpy || myPlayer?.is_spy ? '#FEE2E2' : 'transparent',
                        padding: myPlayer?.isSpy || myPlayer?.is_spy ? '3px 10px' : '0',
                        borderRadius: '12px',
                      }}
                    >
                      {myPlayer?.isSpy || myPlayer?.is_spy ? '🕵️‍♂️ SPY' : 'คำของคุณ'}
                    </span>
                  </div>

                  {/* Card Front Word Display */}
                  {myPlayer?.isSpy || myPlayer?.is_spy ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: '#DC2626',
                          marginBottom: '10px',
                          fontWeight: 800,
                        }}
                      >
                        บทบาทของคุณคือ
                      </div>

                      <div
                        style={{
                          background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                          border: '2px solid #EF4444',
                          borderRadius: '16px',
                          padding: '20px 16px',
                          width: '100%',
                          boxSizing: 'border-box',
                          boxShadow: '0 8px 25px rgba(220, 38, 38, 0.25)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '2rem',
                            fontWeight: 900,
                            color: '#F87171',
                            letterSpacing: '2px',
                            marginBottom: '4px',
                          }}
                        >
                          🕵️‍♂️ SPY
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#FECACA', fontWeight: 700 }}>
                          คุณคือสายลับ
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: '#475569',
                          marginTop: '14px',
                          lineHeight: 1.5,
                          maxWidth: '250px',
                          background: '#FEF2F2',
                          border: '1px dashed #FCA5A5',
                          borderRadius: '12px',
                          padding: '10px 12px',
                        }}
                      >
                        🤫 <strong style={{ color: '#DC2626' }}>ภารกิจของคุณ:</strong>
                        <br />
                        ตั้งใจฟังคำใบ้ของเพื่อนให้ดี แล้วแกล้งเนียนใบ้ตามอย่าให้ใครจับได้!
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: '#64748B',
                          marginBottom: '10px',
                          fontWeight: 600,
                        }}
                      >
                        คำศัพท์ของคุณคือ
                      </div>

                      <div
                        style={{
                          background: '#FFF1F4',
                          border: '2px solid #FECDD3',
                          borderRadius: '16px',
                          padding: '18px 14px',
                          width: '100%',
                          boxSizing: 'border-box',
                          boxShadow: '0 4px 15px rgba(255, 65, 108, 0.1)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '1.75rem',
                            fontWeight: 900,
                            color: '#E11D48',
                            letterSpacing: '1px',
                            wordBreak: 'break-word',
                          }}
                        >
                          {myPlayer?.word || 'กำลังรอคำศัพท์...'}
                        </div>
                      </div>

                      {/* AI Hint Button for Non-SPY Citizen */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFetchAiHints();
                        }}
                        style={{
                          marginTop: '12px',
                          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '20px',
                          padding: '7px 16px',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                          transition: 'all 0.2s',
                        }}
                      >
                        <span>✨</span>
                        <span>AI ช่วยคิดคำใบ้</span>
                      </button>

                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: '#64748B',
                          marginTop: '12px',
                          lineHeight: 1.5,
                          maxWidth: '240px',
                        }}
                      >
                        🎯 จำคำนี้ไว้ให้ดี!
                        <br />
                        ห้ามพูดคำนี้ตรงๆ แต่ให้ใบ้สั้นๆ 1 ประโยค
                      </div>
                    </div>
                  )}

                  {/* Card Front Button to Flip Back */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFlip();
                    }}
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      color: '#475569',
                      borderRadius: '20px',
                      padding: '8px 16px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🙈 คว่ำการ์ด (ซ่อนคำ)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Helper Text */}
            <div style={{ fontSize: '0.8rem', color: '#64748B', textAlign: 'center' }}>
              แตะที่การ์ดเพื่อ คว่ำ หรือ หงายการ์ด ได้ตลอดเวลา
            </div>

            {/* Game Rules Box */}
            <div
              style={{
                width: '100%',
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FF416C', marginBottom: '8px' }}>
                📋 วิธีการเล่น:
              </div>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: '0.8rem',
                  color: '#475569',
                  lineHeight: 1.6,
                }}
              >
                <li>
                  ผู้เล่นทุกคนได้คำศัพท์เดียวกัน แต่มี <strong>1 คนเป็นสายลับ (SPY)</strong>
                </li>
                <li>
                  ผลัดกันพูดใบ้คำของตัวเองคนละ 1 ประโยค (สายลับต้องแอบฟังเพื่อนแล้วเนียนใบ้ตาม)
                </li>
                <li>เมื่อพูดครบ ให้ปรึกษากันแล้วโหวตชี้ตัวคนที่คิดว่าเป็นสายลับ!</li>
              </ol>
            </div>

            {/* Host Controls */}
            {isHost && (
              <div style={{ width: '100%', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleReveal}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '16px',
                    fontSize: '1rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  🔍 เฉลยสายลับ / จบเกมรอบนี้
                </button>
              </div>
            )}
          </div>
        )}

        {/* ----------------- STATE 3: REVEALED RESULTS ----------------- */}
        {room?.status === 'revealed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header Result */}
            <div
              style={{
                background: 'linear-gradient(135deg, #FFF1F4 0%, #FFF7F5 100%)',
                border: '2px solid #FECDD3',
                borderRadius: '20px',
                padding: '24px 16px',
                textAlign: 'center',
                boxShadow: '0 10px 30px rgba(255, 65, 108, 0.08)',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#E11D48', margin: '0 0 8px 0' }}>
                เฉลยผลเกมจับสายลับ!
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#FF416C', fontWeight: 700, marginBottom: '4px' }}>
                🔢 รหัสห้อง: {roomId} {room?.roomName ? `• 🌸 ห้อง "${room.roomName}"` : ''}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                ใครกันนะที่เนียนที่สุดในกลุ่ม?
              </div>
            </div>

            {/* Common Word Card */}
            <div
              style={{
                background: '#F0FDF4',
                border: '2px solid #BBF7D0',
                borderRadius: '20px',
                padding: '20px 16px',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.08)',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#166534', marginBottom: '6px' }}>
                👥 คำศัพท์ของรอบนี้ (คำของพลเมือง)
              </div>
              <div
                style={{
                  fontSize: '1.8rem',
                  fontWeight: 900,
                  color: '#15803D',
                  letterSpacing: '1px',
                }}
              >
                {room?.commonWord}
              </div>
            </div>

            {/* Players and Roles list */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '20px',
                padding: '18px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569', marginBottom: '14px' }}>
                บทบาทของผู้เล่นทุกคน
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {players.map((p) => {
                  const isSpy = p.is_spy;
                  const isMe = p.user_id === activeUserId;
                  return (
                    <div
                      key={p.user_id}
                      style={{
                        background: isSpy ? '#FFF1F4' : '#F8FAFC',
                        border: isSpy ? '1px solid #FECDD3' : '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: '#E2E8F0',
                            backgroundImage: p.picture_url ? `url(${p.picture_url})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            color: '#64748B',
                          }}
                        >
                          {!p.picture_url && p.display_name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B' }}>
                            {p.display_name} {isMe ? '(คุณ)' : ''}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: isSpy ? '#E11D48' : '#64748B',
                              fontWeight: isSpy ? 700 : 500,
                            }}
                          >
                            {isSpy ? '🕵️‍♂️ ผู้เล่นนี้คือสายลับ' : `คำที่ได้: ${p.word}`}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          backgroundColor: isSpy ? '#E11D48' : '#F1F5F9',
                          color: isSpy ? '#FFFFFF' : '#475569',
                          border: isSpy ? 'none' : '1px solid #E2E8F0',
                        }}
                      >
                        {isSpy ? '🕵️‍♂️ สายลับ' : '👥 พลเมือง'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Host Play Again or Close Button */}
            {isHost ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isExiting}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '16px',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    cursor: isExiting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 8px 24px rgba(255, 65, 108, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  🔄 เล่นรอบใหม่ (ผู้เล่นเดิม)
                </button>
                <button
                  type="button"
                  onClick={handleExitGame}
                  disabled={isExiting}
                  style={{
                    width: '100%',
                    background: '#F1F5F9',
                    color: '#64748B',
                    border: '1px solid #E2E8F0',
                    borderRadius: '16px',
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: isExiting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  🚪 ออกจากเกม
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ textAlign: 'center', color: '#64748B', fontSize: '0.85rem' }}>
                  กำลังรอ Host เริ่มเล่นรอบใหม่...
                </div>
                <button
                  type="button"
                  onClick={handleExitGame}
                  disabled={isExiting}
                  style={{
                    width: '100%',
                    background: '#F1F5F9',
                    color: '#64748B',
                    border: '1px solid #E2E8F0',
                    borderRadius: '16px',
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: isExiting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  🚪 ออกจากเกม
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: ชวนเพื่อนเข้าห้องเกม (QR CODE ONLY - NO COPY/SHARE BUTTONS) */}
      {/* ------------------------------------------------------------- */}
      {showQrModal && (
        <div
          onClick={() => setShowQrModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
            animation: 'fadeInDialog 0.2s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: '28px',
              padding: '28px 24px',
              width: '100%',
              maxWidth: '340px',
              textAlign: 'center',
              boxShadow: '0 25px 60px rgba(15, 23, 42, 0.25)',
              border: '1px solid #F1F5F9',
              animation: 'scaleUpDialog 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📲</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1E293B', margin: '0 0 4px 0' }}>
              ชวนเพื่อนเข้าห้องเกม
            </h3>
            {room?.roomName && (
              <p style={{ color: '#FF416C', fontSize: '0.85rem', fontWeight: 700, margin: '0 0 12px 0' }}>
                🌸 ห้อง "{room.roomName}"
              </p>
            )}

            <div
              style={{
                background: '#FFF1F4',
                border: '1.5px dashed #FECDD3',
                borderRadius: '16px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'inline-block',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>รหัสเข้าห้อง 6 หลัก</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#E11D48', letterSpacing: '3px' }}>
                {roomId}
              </div>
            </div>

            {qrDataUrl ? (
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '12px',
                  borderRadius: '20px',
                  border: '2px solid #F1F5F9',
                  display: 'inline-block',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
                  marginBottom: '16px',
                }}
              >
                <img
                  src={qrDataUrl}
                  alt="Scan QR to join room"
                  style={{ width: '220px', height: '220px', display: 'block', borderRadius: '12px' }}
                />
              </div>
            ) : (
              <div style={{ padding: '40px 0', color: '#94A3B8' }}>กำลังสร้าง QR Code...</div>
            )}

            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '0 0 20px 0' }}>
              เปิดกล้องมือถือหรือ LINE สแกน QR เพื่อเข้าห้องได้ทันที
            </p>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              style={{
                width: '100%',
                background: '#F1F5F9',
                color: '#475569',
                border: 'none',
                borderRadius: '16px',
                padding: '13px',
                fontSize: '0.95rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              ✕ ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: AI ช่วยคิดคำใบ้ (FOR NON-SPY CITIZEN ONLY) */}
      {/* ------------------------------------------------------------- */}
      {showHintModal && (
        <div
          onClick={() => setShowHintModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
            animation: 'fadeInDialog 0.2s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: '26px',
              padding: '24px 20px',
              width: '100%',
              maxWidth: '380px',
              boxShadow: '0 25px 60px rgba(15, 23, 42, 0.25)',
              border: '1px solid #F1F5F9',
              animation: 'scaleUpDialog 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>✨</span>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#1E293B' }}>
                    AI ช่วยคิดคำใบ้
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6366F1', fontWeight: 700 }}>
                    สำหรับคำว่า "{myPlayer?.word}"
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowHintModal(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              AI วิเคราะห์คำของคุณและสร้างคำใบ้ที่มีชั้นเชิง ช่วยให้คุณพูดได้เนียนโดยที่สายลับเดาคำตรงๆ ไม่ออก:
            </p>

            {loadingAiHint ? (
              <div style={{ padding: '36px 0', textAlign: 'center' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: '3px solid #F1F5F9',
                    borderTopColor: '#6366F1',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 14px auto',
                  }}
                />
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#475569' }}>
                  กำลังให้ AI ช่วยคิดคำใบ้เด็ดๆ...
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {aiHints.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#F8FAFC',
                      border: '1.5px solid #E2E8F0',
                      borderRadius: '16px',
                      padding: '14px',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: '#6366F1',
                          background: '#EEF2FF',
                          padding: '2px 8px',
                          borderRadius: '8px',
                        }}
                      >
                        {item.style}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.hint);
                          setCopiedHintIndex(idx);
                          setTimeout(() => setCopiedHintIndex(null), 2000);
                        }}
                        style={{
                          background: copiedHintIndex === idx ? '#10B981' : '#FFFFFF',
                          color: copiedHintIndex === idx ? '#FFFFFF' : '#64748B',
                          border: '1px solid #CBD5E1',
                          borderRadius: '12px',
                          padding: '3px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {copiedHintIndex === idx ? '✓ ก๊อปแล้ว' : '📋 คัดลอก'}
                      </button>
                    </div>
                    <div
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        color: '#1E293B',
                        lineHeight: 1.45,
                        marginBottom: item.explanation ? '4px' : '0',
                      }}
                    >
                      "{item.hint}"
                    </div>
                    {item.explanation && (
                      <div style={{ fontSize: '0.75rem', color: '#64748B', lineHeight: 1.4 }}>
                        💡 {item.explanation}
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={async () => {
                    if (!myPlayer?.word) return;
                    setLoadingAiHint(true);
                    try {
                      const hints = await generateSpyAiHints(myPlayer.word, room?.category || 'food');
                      setAiHints(hints);
                    } finally {
                      setLoadingAiHint(false);
                    }
                  }}
                  style={{
                    marginTop: '6px',
                    background: '#FFFFFF',
                    color: '#6366F1',
                    border: '1.5px dashed #C7D2FE',
                    borderRadius: '16px',
                    padding: '11px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  🔄 สุ่มคำใบ้ AI ชุดใหม่
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* FitJourney Themed Modal / Alert Pop-up */}
      {/* ------------------------------------------------------------- */}
      {dialog.isOpen && renderDialog()}
    </div>
  );

  function renderDialog() {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000,
          animation: 'fadeInDialog 0.2s ease-out',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '24px',
            padding: '28px 24px',
            width: '100%',
            maxWidth: '340px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(15, 23, 42, 0.22)',
            boxSizing: 'border-box',
            animation: 'scaleUpDialog 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Modal Icon Badge */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: dialog.type === 'danger' ? '#FEF2F2' : '#FFF1F4',
              border: dialog.type === 'danger' ? '1px solid #FECACA' : '1px solid #FECDD3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 16px auto',
              boxShadow:
                dialog.type === 'danger'
                  ? '0 6px 20px rgba(239, 68, 68, 0.15)'
                  : '0 6px 20px rgba(255, 65, 108, 0.15)',
            }}
          >
            {dialog.icon || (dialog.type === 'danger' ? '⚠️' : '🌸')}
          </div>

          {/* Modal Title */}
          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#1E293B',
              margin: '0 0 8px 0',
              letterSpacing: '-0.2px',
            }}
          >
            {dialog.title}
          </h3>

          {/* Modal Message */}
          <p
            style={{
              fontSize: '0.9rem',
              color: '#64748B',
              lineHeight: 1.6,
              margin: '0 0 24px 0',
              whiteSpace: 'pre-line',
            }}
          >
            {dialog.message}
          </p>

          {/* Modal Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'center',
            }}
          >
            {dialog.type !== 'alert' && (
              <button
                type="button"
                onClick={dialog.onCancel}
                style={{
                  flex: 1,
                  background: '#F1F5F9',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '13px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {dialog.cancelText || 'ยกเลิก'}
              </button>
            )}

            <button
              type="button"
              onClick={dialog.onConfirm}
              style={{
                flex: 1,
                background:
                  dialog.type === 'danger'
                    ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                    : 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '14px',
                padding: '13px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow:
                  dialog.type === 'danger'
                    ? '0 6px 18px rgba(239, 68, 68, 0.3)'
                    : '0 6px 18px rgba(255, 65, 108, 0.3)',
                transition: 'all 0.2s',
              }}
            >
              {dialog.confirmText || 'ตกลง'}
            </button>
          </div>
        </div>
        <style>{`
          @keyframes fadeInDialog {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes scaleUpDialog {
            from { opacity: 0; transform: scale(0.92); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }
}

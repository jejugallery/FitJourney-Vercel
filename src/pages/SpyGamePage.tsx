import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLiff } from '../context/LiffContext';
import {
  type SpyPlayer,
  type SpyRoom,
  joinSpyGameRoom,
  subscribeToSpyRoom,
  subscribeToSpyPlayers,
  updateSpyRoomCategory,
  startSpyGame,
  markSpyCardViewed,
  revealSpyGame,
  resetSpyGame,
} from '../services/spyGameService';

export default function SpyGamePage() {
  const params = useParams<{ roomId?: string }>();
  const [searchParams] = useSearchParams();
  const rawRoomId = params.roomId || searchParams.get('roomId') || '';
  const roomId = rawRoomId.trim().toLowerCase();

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
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');

  // Active user identity
  const activeUserId = profile?.userId || guestId;
  const activeDisplayName = profile?.displayName || guestName;
  const activePictureUrl = profile?.pictureUrl || '';

  // Room State
  const [room, setRoom] = useState<SpyRoom | null>(null);
  const [players, setPlayers] = useState<SpyPlayer[]>([]);
  const [myPlayer, setMyPlayer] = useState<SpyPlayer | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [startingGame, setStartingGame] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Card Flip State
  const [isFlipped, setIsFlipped] = useState(false);

  const prevStatusRef = useRef<string>('waiting');

  // Trigger name prompt if not logged in LINE and no guest name
  useEffect(() => {
    if (!liffLoading && !profile && !guestName) {
      setShowNameModal(true);
    }
  }, [liffLoading, profile, guestName]);

  // Realtime Firebase Firestore subscriptions
  useEffect(() => {
    if (!roomId || liffLoading || !activeDisplayName) return;

    let unsubRoom: (() => void) | null = null;
    let unsubPlayers: (() => void) | null = null;
    let isMounted = true;

    const initRoom = async () => {
      try {
        await joinSpyGameRoom(roomId, {
          userId: activeUserId,
          displayName: activeDisplayName,
          pictureUrl: activePictureUrl,
        });

        if (!isMounted) return;

        unsubRoom = subscribeToSpyRoom(roomId, (roomData) => {
          if (!isMounted) return;
          if (roomData) {
            setRoom(roomData);
            setIsHost(roomData.hostId === activeUserId);
            if (prevStatusRef.current !== 'playing' && roomData.status === 'playing') {
              setIsFlipped(false);
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
  }, [roomId, activeUserId, activeDisplayName, liffLoading, activePictureUrl]);

  const handleSaveGuestName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) return;
    const trimmed = tempName.trim();
    setGuestName(trimmed);
    localStorage.setItem('spy_guest_name', trimmed);
    setShowNameModal(false);
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleSelectCategory = async (category: 'food' | 'daily') => {
    if (!isHost || !roomId) return;
    try {
      await updateSpyRoomCategory(roomId, category);
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนหมวดหมู่');
    }
  };

  const handleStartGame = async () => {
    if (!isHost || !roomId) return;
    if (players.length < 2) {
      alert('ต้องการผู้เล่นอย่างน้อย 2 คนขึ้นไปเพื่อเริ่มเกม (แนะนำ 3 คนขึ้นไป)');
      return;
    }
    setStartingGame(true);
    try {
      await startSpyGame(roomId, room?.category || 'food', players);
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถเริ่มเกมได้');
    } finally {
      setStartingGame(false);
    }
  };

  const handleReveal = async () => {
    if (!isHost || !roomId) return;
    if (!window.confirm('คุณต้องการเฉลยสายลับและจบเกมรอบนี้ใช่หรือไม่?')) return;
    try {
      await revealSpyGame(roomId);
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถเฉลยผลได้');
    }
  };

  const handleReset = async () => {
    if (!isHost || !roomId) return;
    try {
      await resetSpyGame(roomId, players);
      setIsFlipped(false);
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถเริ่มรอบใหม่ได้');
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

  // If no room ID is provided in URL
  if (!roomId) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#090D16',
        color: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🕵️‍♂️</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px', color: '#38BDF8' }}>
          เกมจับสายลับ
        </h1>
        <p style={{ color: '#94A3B8', fontSize: '0.95rem', maxWidth: '320px', lineHeight: 1.6, marginBottom: '24px' }}>
          กรุณาเข้าห้องเกมผ่านลิงก์ในไลน์ หรือพิมพ์คำว่า <strong>"จับสายลับ"</strong> ในแชทไลน์กลุ่มเพื่อรับลิงก์เข้าห้อง
        </p>
      </div>
    );
  }

  // Loading Screen
  if (liffLoading || loadingRoom) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#090D16',
        color: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          border: '4px solid #1E293B',
          borderTopColor: '#E11D48',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }} />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38BDF8' }}>กำลังโหลดห้องเกม...</h2>
        <p style={{ color: '#64748B', fontSize: '0.85rem', marginTop: '6px' }}>ห้อง #{roomId.toUpperCase()}</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#090D16',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, #1e1b4b 0%, #090D16 75%)',
      color: '#F8FAFC',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      paddingBottom: '40px',
      boxSizing: 'border-box'
    }}>
      {/* Top Header */}
      <header style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(9, 13, 22, 0.85)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.5rem' }}>🕵️‍♂️</span>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1px', color: '#38BDF8' }}>
              UNDERCOVER
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF' }}>
              ห้อง #{roomId.toUpperCase()}
            </div>
          </div>
        </div>

        <button
          onClick={handleCopyLink}
          style={{
            background: copiedLink ? '#10B981' : 'rgba(255,255,255,0.08)',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {copiedLink ? '✓ คัดลอกแล้ว' : '🔗 ชวนเพื่อน'}
        </button>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 16px' }}>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: 'rgba(225, 29, 72, 0.2)',
            border: '1px solid #E11D48',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#FDA4AF',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>⚠️ {errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              style={{ background: 'none', border: 'none', color: '#FDA4AF', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ----------------- STATE 1: WAITING LOBBY ----------------- */}
        {room?.status === 'waiting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Host Banner */}
            {isHost ? (
              <div style={{
                background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.2) 0%, rgba(244, 63, 94, 0.05) 100%)',
                border: '1px solid rgba(225, 29, 72, 0.4)',
                borderRadius: '16px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>👑</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FDA4AF' }}>
                  คุณคือ Host ของห้องนี้
                </div>
                <div style={{ fontSize: '0.8rem', color: '#CBD5E1', marginTop: '4px' }}>
                  เลือกหมวดหมู่คำศัพท์ด้านล่าง แล้วกดเริ่มเกมเมื่อเพื่อนพร้อม
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ fontSize: '1.8rem' }}>👑</div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>ผู้สร้างห้อง (Host)</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#F8FAFC' }}>
                    {room?.hostName || 'กำลังรอ...'}
                  </div>
                </div>
              </div>
            )}

            {/* Category Selector */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '20px',
              padding: '18px',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#94A3B8',
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>หมวดหมู่คำศัพท์ (Category)</span>
                {isHost && <span style={{ fontSize: '0.75rem', color: '#E11D48', fontWeight: 600 }}>แตะเพื่อเลือก</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Food Category */}
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleSelectCategory('food')}
                  style={{
                    background: room?.category === 'food'
                      ? 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)'
                      : 'rgba(255,255,255,0.05)',
                    border: room?.category === 'food'
                      ? '2px solid #FDA4AF'
                      : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    padding: '16px 12px',
                    color: '#FFFFFF',
                    cursor: isHost ? 'pointer' : 'default',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    boxShadow: room?.category === 'food' ? '0 8px 20px rgba(225, 29, 72, 0.35)' : 'none',
                    transform: room?.category === 'food' ? 'scale(1.02)' : 'scale(1)'
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🍲</div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>อาหาร</div>
                  <div style={{ fontSize: '0.7rem', color: room?.category === 'food' ? '#FFE4E6' : '#64748B', marginTop: '4px' }}>
                    ข้าวมันไก่, ชาบู, ส้มตำ ฯลฯ
                  </div>
                </button>

                {/* Daily Essentials Category */}
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleSelectCategory('daily')}
                  style={{
                    background: room?.category === 'daily'
                      ? 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)'
                      : 'rgba(255,255,255,0.05)',
                    border: room?.category === 'daily'
                      ? '2px solid #A5B4FC'
                      : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    padding: '16px 12px',
                    color: '#FFFFFF',
                    cursor: isHost ? 'pointer' : 'default',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    boxShadow: room?.category === 'daily' ? '0 8px 20px rgba(79, 70, 229, 0.35)' : 'none',
                    transform: room?.category === 'daily' ? 'scale(1.02)' : 'scale(1)'
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🧴</div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>ของใช้ในชีวิต</div>
                  <div style={{ fontSize: '0.7rem', color: room?.category === 'daily' ? '#E0E7FF' : '#64748B', marginTop: '4px' }}>
                    แปรงสีฟัน, สบู่, ช้อนส้อม ฯลฯ
                  </div>
                </button>
              </div>
            </div>

            {/* Players in Lobby */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '20px',
              padding: '18px',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#94A3B8',
                marginBottom: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>ผู้เล่นที่เข้าร่วมแล้ว ({players.length} คน)</span>
                <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>● ออนไลน์</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                {players.map((p) => {
                  const isMe = p.user_id === activeUserId;
                  return (
                    <div
                      key={p.user_id}
                      style={{
                        background: isMe ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.04)',
                        border: isMe ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        backgroundColor: '#1E293B',
                        backgroundImage: p.picture_url ? `url(${p.picture_url})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: '#94A3B8',
                        flexShrink: 0
                      }}>
                        {!p.picture_url && p.display_name.charAt(0)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: isMe ? '#38BDF8' : '#F8FAFC',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {p.display_name} {isMe ? '(คุณ)' : ''}
                        </div>
                        {p.is_host && (
                          <div style={{ fontSize: '0.65rem', color: '#F59E0B', fontWeight: 600 }}>👑 Host</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Section */}
            {isHost ? (
              <button
                type="button"
                onClick={handleStartGame}
                disabled={startingGame || players.length < 2}
                style={{
                  background: players.length < 2
                    ? 'rgba(255,255,255,0.1)'
                    : 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)',
                  color: players.length < 2 ? '#64748B' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '16px',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  cursor: players.length < 2 || startingGame ? 'not-allowed' : 'pointer',
                  width: '100%',
                  boxShadow: players.length >= 2 ? '0 10px 25px rgba(225, 29, 72, 0.4)' : 'none',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {startingGame ? (
                  <>🤖 AI กำลังคิดคำศัพท์ลับและแจกการ์ด...</>
                ) : (
                  <>🚀 เริ่มเกมจับสายลับ ({players.length} คน)</>
                )}
              </button>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'center',
                border: '1px dashed rgba(255,255,255,0.15)'
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '8px', animation: 'bounce 2s infinite' }}>⏳</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38BDF8' }}>
                  กำลังรอ Host เริ่มเกม...
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>
                  เมื่อ Host กดเริ่ม AI จะสุ่มคำศัพท์ส่งให้ทุกคน
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- STATE 2: PLAYING (3D CARD FLIP) ----------------- */}
        {room?.status === 'playing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>

            {/* Category Banner */}
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#38BDF8',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>{room?.category === 'daily' ? '🧴 หมวดของใช้ในชีวิตประจำวัน' : '🍲 หมวดอาหาร'}</span>
              <span>•</span>
              <span>ผู้เล่น {players.length} คน (มี 1 สายลับ)</span>
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
                userSelect: 'none'
              }}
            >
              <div style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                textAlign: 'center',
                transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}>

                {/* --- CARD BACK (คว่ำการ์ด) --- */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  borderRadius: '24px',
                  background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
                  border: '2px solid rgba(56, 189, 248, 0.4)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 0 20px rgba(56, 189, 248, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '24px 20px',
                  boxSizing: 'border-box'
                }}>
                  {/* Card Corner Accents */}
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#38BDF8', opacity: 0.7 }}>
                    <span>♠</span>
                    <span>UNDERCOVER</span>
                    <span>♠</span>
                  </div>

                  {/* Card Center Emblem */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, rgba(15, 23, 42, 0.8) 100%)',
                      border: '2px dashed rgba(56, 189, 248, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '3rem',
                      marginBottom: '16px',
                      boxShadow: '0 0 25px rgba(56, 189, 248, 0.2)'
                    }}>
                      🕵️‍♂️
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F8FAFC', letterSpacing: '0.5px' }}>
                      การ์ดคำศัพท์ลับ
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '6px' }}>
                      แตะการ์ดเพื่อเปิดดูคำของคุณ
                    </div>
                  </div>

                  {/* Card Footer Warning */}
                  <div style={{
                    background: 'rgba(225, 29, 72, 0.15)',
                    border: '1px solid rgba(225, 29, 72, 0.3)',
                    borderRadius: '12px',
                    padding: '8px 14px',
                    fontSize: '0.75rem',
                    color: '#FDA4AF',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>🤫</span>
                    <span>ระวังคนข้างๆ แอบดูนะ!</span>
                  </div>
                </div>

                {/* --- CARD FRONT (หงายการ์ด) --- */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  borderRadius: '24px',
                  background: 'linear-gradient(145deg, #1e1b4b 0%, #0f172a 60%, #1e1b4b 100%)',
                  border: '2px solid #F59E0B',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 0 30px rgba(245, 158, 11, 0.15)',
                  transform: 'rotateY(180deg)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '24px 20px',
                  boxSizing: 'border-box'
                }}>
                  {/* Card Front Top */}
                  <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
                    paddingBottom: '10px'
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#F59E0B' }}>
                      {room?.category === 'daily' ? '🧴 ของใช้' : '🍲 อาหาร'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                      คำของคุณ
                    </span>
                  </div>

                  {/* Card Front Word Display */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: '12px' }}>
                      คำศัพท์ของคุณคือ
                    </div>

                    <div style={{
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(225, 29, 72, 0.2) 100%)',
                      border: '2px solid #F59E0B',
                      borderRadius: '16px',
                      padding: '20px 16px',
                      width: '100%',
                      boxSizing: 'border-box',
                      boxShadow: '0 0 25px rgba(245, 158, 11, 0.25)'
                    }}>
                      <div style={{
                        fontSize: '1.75rem',
                        fontWeight: 900,
                        color: '#FFFFFF',
                        letterSpacing: '1px',
                        textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                        wordBreak: 'break-word'
                      }}>
                        {myPlayer?.word || 'กำลังรอคำศัพท์...'}
                      </div>
                    </div>

                    <div style={{
                      fontSize: '0.75rem',
                      color: '#CBD5E1',
                      marginTop: '16px',
                      lineHeight: 1.5,
                      maxWidth: '240px'
                    }}>
                      🎯 จำคำนี้ไว้ให้ดี!<br/>
                      ห้ามพูดคำนี้ตรงๆ แต่ให้ใบ้สั้นๆ 1 ประโยค
                    </div>
                  </div>

                  {/* Card Front Button to Flip Back */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFlip();
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#FFFFFF',
                      borderRadius: '20px',
                      padding: '8px 16px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
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

            {/* Game Rules Accordion Box */}
            <div style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '16px',
              padding: '16px',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38BDF8', marginBottom: '8px' }}>
                📋 วิธีการเล่น:
              </div>
              <ol style={{
                margin: 0,
                paddingLeft: '20px',
                fontSize: '0.8rem',
                color: '#CBD5E1',
                lineHeight: 1.6
              }}>
                <li>ผู้เล่นทุกคนได้คำที่คล้ายกัน แต่มี <strong>1 คนเป็นสายลับ</strong> ที่ได้คำต่างออกไป</li>
                <li>ผลัดกันพูดใบ้คำของตัวเองคนละ 1 ประโยค (ห้ามพูดคำตรงๆ)</li>
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
                    borderRadius: '14px',
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
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
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(225, 29, 72, 0.2) 100%)',
              border: '2px solid #F59E0B',
              borderRadius: '20px',
              padding: '24px 16px',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(245, 158, 11, 0.2)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF', margin: '0 0 8px 0' }}>
                เฉลยผลเกมจับสายลับ!
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#CBD5E1' }}>
                ใครกันนะที่เนียนที่สุดในกลุ่ม?
              </div>
            </div>

            {/* Word Comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Citizens Word */}
              <div style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid #38BDF8',
                borderRadius: '16px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8', marginBottom: '6px' }}>
                  👥 คำของพลเมือง
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                  {room?.commonWord}
                </div>
              </div>

              {/* Spy Word */}
              <div style={{
                background: 'rgba(225, 29, 72, 0.15)',
                border: '1px solid #E11D48',
                borderRadius: '16px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FDA4AF', marginBottom: '6px' }}>
                  🕵️‍♂️ คำของสายลับ
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                  {room?.spyWord}
                </div>
              </div>
            </div>

            {/* Players and Roles list */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '20px',
              padding: '18px',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94A3B8', marginBottom: '14px' }}>
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
                        background: isSpy ? 'rgba(225, 29, 72, 0.15)' : 'rgba(255,255,255,0.04)',
                        border: isSpy ? '1px solid #E11D48' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: '#1E293B',
                          backgroundImage: p.picture_url ? `url(${p.picture_url})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: '#94A3B8'
                        }}>
                          {!p.picture_url && p.display_name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F8FAFC' }}>
                            {p.display_name} {isMe ? '(คุณ)' : ''}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: isSpy ? '#FDA4AF' : '#94A3B8' }}>
                            คำที่ได้: {p.word}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        backgroundColor: isSpy ? '#E11D48' : 'rgba(56, 189, 248, 0.15)',
                        color: isSpy ? '#FFFFFF' : '#38BDF8',
                        border: isSpy ? 'none' : '1px solid rgba(56, 189, 248, 0.3)'
                      }}>
                        {isSpy ? '🕵️‍♂️ สายลับ' : '👥 พลเมือง'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Host Play Again Button */}
            {isHost ? (
              <button
                type="button"
                onClick={handleReset}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '16px',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(225, 29, 72, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                🔄 เล่นรอบใหม่ (ผู้เล่นเดิม)
              </button>
            ) : (
              <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                กำลังรอ Host เริ่มเล่นรอบใหม่...
              </div>
            )}
          </div>
        )}

      </main>

      {/* Guest Name Modal (If opened outside LINE / without profile) */}
      {showNameModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 100
        }}>
          <form
            onSubmit={handleSaveGuestName}
            style={{
              background: '#0F172A',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '24px',
              padding: '24px',
              width: '100%',
              maxWidth: '340px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🕵️‍♂️</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38BDF8', margin: '0 0 6px 0' }}>
              ยินดีต้อนรับสู่เกมจับสายลับ
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: '0 0 16px 0' }}>
              กรุณากรอกชื่อเล่นของคุณเพื่อเข้าร่วมห้อง
            </p>

            <input
              type="text"
              required
              placeholder="เช่น มังกร, เจมส์, แพรว"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.2)',
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: '#FFFFFF',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: '16px'
              }}
            />

            <button
              type="submit"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              เข้าห้องเล่นเลย 🎮
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import EventDetailModal from './EventDetailModal';
import { isVideoUrl, getMediaFlexUrl, getMediaThumbnailUrl, getMediaVideoLoopUrl } from '../utils/mediaHelper';
import liff from '@line/liff';
import SuccessPopup from './SuccessPopup';
import { eventsApi, eventInvitationsApi, eventRsvpsApi } from '../utils/api';
import { LIFF_URLS } from '../constants/liff';

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

interface TraineeEventsSliderProps {
  userId: string;
}

export default function TraineeEventsSlider({ userId }: TraineeEventsSliderProps) {
  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [confirmInvId, setConfirmInvId] = useState<string | null>(null);
  const [creators, setCreators] = useState<Record<string, any>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  
  const events = useMemo(() => {
    const myEventIds = new Set(invitations.map(inv => inv.eventId));
    const now = new Date().getTime();
    
    const myEvents = rawEvents.filter(e => {
      if (!myEventIds.has(e.id)) return false;
      if (e.datetime) {
        let eventTime = 0;
        if (e.endDatetimeIso) {
          eventTime = new Date(e.endDatetimeIso).getTime();
        } else if (e.startDatetimeIso) {
          eventTime = new Date(e.startDatetimeIso).getTime();
        } else {
          eventTime = new Date(e.datetime).getTime();
        }
        
        if (!isNaN(eventTime)) {
          const diffHours = (now - eventTime) / (1000 * 60 * 60);
          if (diffHours > 2) return false;
        }
      }
      return true;
    });

    // sort by upcoming event date ascending (soonest first)
    myEvents.sort((a, b) => {
      const getTime = (e: any) => {
        if (e.startDatetimeIso) return new Date(e.startDatetimeIso).getTime();
        if (e.datetime) return new Date(e.datetime).getTime();
        return 0;
      };
      return getTime(a) - getTime(b);
    });

    return myEvents;
  }, [rawEvents, invitations]);
  
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

  const loadData = async () => {
    if (!userId) return;
    try {
      const [allEvents, userInvs] = await Promise.all([
        eventsApi.list(),
        eventInvitationsApi.listForUser(userId)
      ]);
      setRawEvents(allEvents);
      setInvitations(userInvs);
    } catch (err) {
      console.error("Error loading events/invitations:", err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  const handleAddToCalendar = (ev: any) => {
    const params = new URLSearchParams({
      name: ev.name || 'กิจกรรม',
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
      await eventInvitationsApi.update(invitationId, { status: 'accepted' });
      await loadData();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการตอบรับคำเชิญ');
    }
  };

  const handleShareToLine = async (ev: any) => {
    const shareLinkType = ev?.linkType || 'none';
    const shareLinkUrl = ev?.linkUrl || '';
    const shareLinkLabel = ev?.linkLabel || '';

    if (shareLinkType !== 'none' && shareLinkType !== 'rsvp' && shareLinkType !== 'calendar') {
      const trimmedUrl = shareLinkUrl.trim();
      if (!trimmedUrl) {
        alert('ลิงก์ปุ่มแชร์ไม่สมบูรณ์ (URL ว่างเปล่า)');
        return;
      }
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        alert('ลิงก์ปุ่มแชร์ไม่ถูกต้อง (ต้องเริ่มต้นด้วย http:// หรือ https://)');
        return;
      }
      if (shareLinkType === 'custom' && !shareLinkLabel.trim()) {
        alert('ข้อความบนปุ่มแชร์ไม่สมบูรณ์');
        return;
      }
    }

    try {
      if (!liff.isApiAvailable('shareTargetPicker')) {
        alert('อุปกรณ์นี้ไม่รองรับการแชร์ข้อความผ่าน LINE (shareTargetPicker)');
        return;
      }

      let datetimeString = '';
      if (ev.startDatetimeIso && ev.endDatetimeIso && ev.startDatetimeIso.substring(0, 10) !== ev.endDatetimeIso.substring(0, 10)) {
        // Multi-day event: no time and no day of week (e.g. 2 กรกฎาคม 2569 - 31 กรกฎาคม 2569)
        const d1 = new Date(ev.startDatetimeIso);
        const d2 = new Date(ev.endDatetimeIso);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
          const opt: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
          datetimeString = `${d1.toLocaleDateString('th-TH', opt)} - ${d2.toLocaleDateString('th-TH', opt)}`;
        } else {
          datetimeString = ev.datetime + (ev.endDatetimeDisplay ? ` - ${ev.endDatetimeDisplay}` : '');
        }
      } else {
        const isSameDay = ev.startDatetimeIso && ev.endDatetimeIso &&
          ev.startDatetimeIso.substring(0, 10) === ev.endDatetimeIso.substring(0, 10);
        const endPart = isSameDay
          ? ev.endDatetimeDisplay.split(',')[1] || ev.endDatetimeDisplay
          : ev.endDatetimeDisplay;
        datetimeString = ev.datetime + (ev.endDatetimeDisplay ? ` - ${endPart}` : '');
      }

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
                  text: ev.invitationText || '📅 เชิญเข้าร่วมกิจกรรม',
                  size: 'xs',
                  color: (ev.invitationColor?.trim().toUpperCase() === '#FFE600') ? '#334155' : '#ffffff',
                  weight: 'bold',
                  align: 'center'
                }
              ],
              backgroundColor: ev.invitationColor || '#6d28d9',
              paddingAll: '6px',
              paddingStart: '12px',
              paddingEnd: '12px',
              cornerRadius: '20px',
              flex: 0
            },
            ...((ev.linkType !== 'rsvp') ? [
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
                  uri: `${LIFF_URLS.SHARE_EVENT}?eventId=${ev.id}`
                }
              }
            ] : [])
          ]
        },
        {
          type: 'text',
          text: ev.name || 'กิจกรรมใหม่',
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
                  text: ev.location || '-',
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

      if (ev.description) {
        bodyContents.push(
          { type: 'separator', margin: 'lg' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            contents: [
              {
                type: 'text',
                text: ev.description,
                size: 'sm',
                color: '#334155',
                wrap: true
              }
            ]
          }
        );
      }

      // Fetch RSVPs
      let rsvpList: any[] = [];
      try {
        const rsvpsList = await eventRsvpsApi.list(ev.id);
        rsvpList = rsvpsList.map((r: any) => ({
          userId: r.user_id,
          displayName: r.display_name,
          pictureUrl: r.picture_url,
          joinedAt: r.joined_at,
          registeredBy: r.registered_by || ''
        }));
      } catch (rsvpErr) {
        console.error("Error fetching RSVPs for share:", rsvpErr);
      }

      if (rsvpList.length > 0) {
        const rsvpContents = rsvpList.map((r: any, index: number) => ({
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          alignItems: 'center',
          margin: index === 0 ? 'sm' : 'xs',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              width: '20px',
              flex: 0,
              contents: [
                { type: 'text', text: `${index + 1}.`, size: 'sm', color: '#94a3b8' }
              ]
            },
            {
              type: 'image',
              url: r.pictureUrl || 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
              size: '28px',
              aspectRatio: '1:1',
              aspectMode: 'cover',
              flex: 0
            },
            { type: 'text', text: r.displayName || 'ผู้เข้าร่วม', size: 'sm', color: '#1e293b', flex: 1, wrap: false }
          ]
        }));

        bodyContents.push(
          { type: 'separator', margin: 'lg' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            contents: [
              { type: 'text', text: `✍️ รายชื่อผู้ลงชื่อ (${rsvpList.length} คน)`, weight: 'bold', size: 'sm', color: '#6d28d9' },
              ...rsvpContents
            ]
          }
        );
      }

      let heroElement: any = null;
      if (ev.imageUrl) {
        if (isVideoUrl(ev.imageUrl)) {
          heroElement = {
            type: 'video',
            url: getMediaVideoLoopUrl(ev.imageUrl),
            previewUrl: ev.videoThumbnailUrl || getMediaThumbnailUrl(ev.imageUrl),
            altContent: {
              type: 'image',
              size: 'full',
              aspectRatio: '16:9',
              aspectMode: 'cover',
              url: ev.videoThumbnailUrl || getMediaThumbnailUrl(ev.imageUrl)
            },
            aspectRatio: '16:9'
          };
        } else {
          heroElement = {
            type: 'image',
            url: getMediaFlexUrl(ev.imageUrl),
            size: 'full',
            aspectRatio: '16:9',
            aspectMode: 'cover',
            ...((ev.linkUrl || ev.detailUrl) ? {
              action: {
                type: 'uri',
                label: 'detail',
                uri: ev.linkUrl || ev.detailUrl
              }
            } : {})
          };
        }
      }

      const bubble: any = {
        type: 'bubble',
        ...(heroElement ? { hero: heroElement } : {}),
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          contents: bodyContents
        }
      };

      if (shareLinkType !== 'none') {
        let buttonLabel = '';
        let buttonColor = ev.buttonColor || '#ef4444';
        let buttonAction: any = null;

        const formatExternalUrl = (url: string) => {
          const trimmed = url.trim();
          return trimmed.includes('?') ? `${trimmed}&openExternalBrowser=1` : `${trimmed}?openExternalBrowser=1`;
        };

        if (shareLinkType === 'zoom') {
          buttonLabel = 'เข้าผ่าน Zoom';
          if (!ev.buttonColor) buttonColor = '#2d8cff';
          buttonAction = {
            type: 'uri',
            label: buttonLabel,
            uri: formatExternalUrl(shareLinkUrl)
          };
        } else if (shareLinkType === 'register') {
          buttonLabel = 'ลงทะเบียน';
          if (!ev.buttonColor) buttonColor = '#22c55e';
          buttonAction = {
            type: 'uri',
            label: buttonLabel,
            uri: formatExternalUrl(shareLinkUrl)
          };
        } else if (shareLinkType === 'details') {
          buttonLabel = 'ดูรายละเอียด';
          if (!ev.buttonColor) buttonColor = '#FFE600';
          buttonAction = {
            type: 'uri',
            label: buttonLabel,
            uri: formatExternalUrl(shareLinkUrl)
          };
        } else if (shareLinkType === 'custom') {
          buttonLabel = shareLinkLabel.trim();
          if (!ev.buttonColor) buttonColor = '#FF416C';
          buttonAction = {
            type: 'uri',
            label: buttonLabel,
            uri: formatExternalUrl(shareLinkUrl)
          };
        } else if (shareLinkType === 'rsvp') {
          buttonLabel = 'ลงชื่อเข้าร่วม ✍️';
          if (!ev.buttonColor) buttonColor = '#6d28d9';
          buttonAction = {
            type: 'uri',
            label: 'ลงชื่อเข้าร่วม',
            uri: `${LIFF_URLS.SHARE_EVENT}?action=rsvp&eventId=${ev.id || ''}&v=${Date.now()}`
          };
        } else if (shareLinkType === 'calendar') {
          buttonLabel = 'เพิ่มลงบนปฏิทิน 📅';
          if (!ev.buttonColor) buttonColor = '#3b82f6';
          const calendarParams = new URLSearchParams({
            name: (ev.name || 'กิจกรรม').substring(0, 100),
            startDatetimeIso: ev.startDatetimeIso || '',
            endDatetimeIso: ev.endDatetimeIso || '',
            description: (ev.description || '').substring(0, 150),
            location: (ev.location || '').substring(0, 150),
            openExternalBrowser: '1',
          });
          buttonAction = {
            type: 'uri',
            label: buttonLabel,
            uri: `https://fitjourneythailand.web.app/download-ics?${calendarParams.toString()}`
          };
        }

        if (buttonLabel && buttonAction) {
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
                action: buttonAction,
                contents: [
                  {
                    type: 'text',
                    text: buttonLabel,
                    color: (buttonColor?.trim().toUpperCase() === '#FFE600') ? '#334155' : '#ffffff',
                    weight: 'bold',
                    size: 'sm',
                    align: 'center'
                  }
                ]
              }
            ],
            flex: 0
          };
        }
      }

      const flexMsg = {
        type: 'flex',
        altText: `${ev.invitationText || 'เชิญเข้าร่วมกิจกรรม'}: ${ev.name}`,
        contents: bubble
      };

      const res = await liff.shareTargetPicker([flexMsg as any]);
      if (res) {
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 2000);
      }
    } catch (error) {
      console.error('Error sharing event:', error);
      alert('เกิดข้อผิดพลาดในการแชร์กิจกรรม');
    }
  };

  if (events.length === 0) return null;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-main)', paddingLeft: '4px' }}>
        📅 กิจกรรม
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
        
        {events.map(ev => {
          const myInv = invitations.find(i => i.eventId === ev.id);
          
          return (
            <div 
              key={ev.id}
              onClick={() => setSelectedEventId(ev.id)}
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
                  📅
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
                      โดย {creators[ev.createdBy].name}
                    </span>
                  </div>
                )}

                <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                  🕒 {getEventDateText(ev)}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  📍 {ev.location}
                </div>
                
                <div style={{ marginTop: 'auto' }}>
                  {myInv && myInv.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmInvId(myInv.id); }}
                        style={{ flex: 1, padding: '8px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        🎯 ยืนยันเข้าร่วม
                      </button>
                    </div>
                  )}
                  
                  {myInv && myInv.status === 'accepted' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ padding: '6px 0', color: '#166534', fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                        <span style={{background: '#dcfce7', padding: '4px 8px', borderRadius: '12px'}}>✅ คุณเข้าร่วมกิจกรรมนี้</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        {ev.startDatetimeIso && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAddToCalendar(ev); }}
                            style={{ flex: 1, padding: '8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          >
                            📅 เพิ่มลงปฏิทิน
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleShareToLine(ev); }}
                          style={{ flex: 1, padding: '8px', background: '#06C755', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        >
                          💬 แชร์ไปยัง LINE
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedEventId && (
        <EventDetailModal 
          eventId={selectedEventId} 
          initialEventData={events.find(e => e.id === selectedEventId)}
          onClose={() => setSelectedEventId(null)} 
          userId={userId} 
          role="trainee"
          invitations={invitations.filter(i => i.eventId === selectedEventId)}
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
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#1e293b' }}>ยืนยันเข้าร่วมกิจกรรม</h3>
            <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '0.95rem' }}>ยืนยันเข้าร่วมกิจกรรมนี้ ?</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setConfirmInvId(null)}
                style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer' }}
              >
                ยกเลิก
              </button>
              <button
                onClick={async (e) => { await handleAccept(e as any, confirmInvId!); setConfirmInvId(null); }}
                style={{ flex: 1, padding: '12px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer' }}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <SuccessPopup show={showSuccessPopup} message="แชร์กิจกรรมเรียบร้อยแล้ว" />
    </div>
  );
}

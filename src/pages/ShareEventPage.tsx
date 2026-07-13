import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { eventsApi, eventRsvpsApi, appointmentsApi } from '../utils/api';
import { LIFF_URLS } from '../constants/liff';
import liff from '@line/liff';
import { isVideoUrl, getMediaFlexUrl, getMediaThumbnailUrl, getMediaVideoLoopUrl } from '../utils/mediaHelper';
import { useLiff } from '../context/LiffContext';

export default function ShareEventPage() {
  const [searchParams] = useSearchParams();
  const { profile, loading: liffLoading, error: liffError } = useLiff();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('กำลังเตรียมข้อมูลการแชร์...');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // RSVP mode popup states
  const [showModePopup, setShowModePopup] = useState(false);
  const [rsvpMode, setRsvpMode] = useState<'self' | 'friend' | null>(null);
  const [friendName, setFriendName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [eventDataCache, setEventDataCache] = useState<any>(null);
  const [alreadyRsvped, setAlreadyRsvped] = useState(false);
  const [rsvpList, setRsvpList] = useState<any[]>([]);
  const [showWithdrawMode, setShowWithdrawMode] = useState(false);
  const [selectedWithdrawIds, setSelectedWithdrawIds] = useState<string[]>([]);
  const [fadeOutActive, setFadeOutActive] = useState(false);
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [rsvpFriendEnabled, setRsvpFriendEnabled] = useState(true);
  const [updatingRsvpStatus, setUpdatingRsvpStatus] = useState(false);

  const getParamSafe = (name: string): string | null => {
    let val = searchParams.get(name);
    if (val) return val;

    const urlParams = new URLSearchParams(window.location.search);
    val = urlParams.get(name);
    if (val) return val;

    // Use regex to look up parameter in the full URL string to handle nested '?' characters
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

  const eventId = getParamSafe('eventId');
  const appointmentId = getParamSafe('appointmentId');
  const action = getParamSafe('action');

  const normalizeRsvp = (r: any) => ({
    id: r.userId || r.user_id || '',
    userId: r.userId || r.user_id || '',
    displayName: r.displayName || r.display_name || 'ผู้เข้าร่วม',
    pictureUrl: r.pictureUrl || r.picture_url || '',
    joinedAt: r.joinedAt || r.joined_at || '',
    registeredBy: r.registeredBy || r.registered_by || ''
  });

  useEffect(() => {
    if (liffLoading) return;
    if (liffError) {
      setError(liffError);
      setLoading(false);
      return;
    }
    if (!profile) return;

    if (action === 'rsvp' && eventId) {
      const loadRsvpData = async () => {
        try {
          setStatus('กำลังโหลดข้อมูลกิจกรรม...');
          const evData = await eventsApi.get(eventId);
          setEventDataCache(evData);
          setRsvpEnabled(evData.rsvpEnabled !== false);
          setRsvpFriendEnabled(evData.rsvpFriendEnabled !== false);
          
          // Check if user already RSVP'd
          const rsvpCheck = await eventRsvpsApi.check(eventId, profile.userId);
          setAlreadyRsvped(rsvpCheck.exists);

          // Fetch all RSVPs
          const rsvpsList = await eventRsvpsApi.list(eventId);
          const rsvps = rsvpsList.map(normalizeRsvp);
          setRsvpList(rsvps);

          setLoading(false);
          setShowModePopup(true);
        } catch (err: any) {
          console.error('[RSVP load error]', err);
          setError('เกิดข้อผิดพลาดในการโหลดข้อมูลกิจกรรม: ' + (err.message || err));
          setLoading(false);
        }
      };
      loadRsvpData();
      return;
    }

    if (!eventId && !appointmentId) {
      setError('ไม่พบรหัสกิจกรรมหรือการนัดหมายที่ต้องการแชร์');
      setLoading(false);
      return;
    }

    const fetchAndShare = async () => {
      try {
        let title = '';
        let bubble: any = null;
        let altText = '';

        if (eventId) {
          setStatus('กำลังดึงข้อมูลกิจกรรม...');
          const eventData = await eventsApi.get(eventId);
          if (!eventData) {
            throw new Error('ไม่พบข้อมูลกิจกรรมนี้ในระบบ');
          }
          title = eventData.name || 'กิจกรรม';
          altText = `${eventData.invitationText || 'เชิญเข้าร่วมกิจกรรม'}: ${eventData.name}`;

          let datetimeString = '';
          if (eventData.startDatetimeIso && eventData.endDatetimeIso && eventData.startDatetimeIso.substring(0, 10) !== eventData.endDatetimeIso.substring(0, 10)) {
            // Multi-day event: no time and no day of week (e.g. 2 กรกฎาคม 2569 - 31 กรกฎาคม 2569)
            const d1 = new Date(eventData.startDatetimeIso);
            const d2 = new Date(eventData.endDatetimeIso);
            if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
              const opt: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
              datetimeString = `${d1.toLocaleDateString('th-TH', opt)} - ${d2.toLocaleDateString('th-TH', opt)}`;
            } else {
              datetimeString = (eventData.datetime || '') + (eventData.endDatetimeDisplay ? ` - ${eventData.endDatetimeDisplay}` : '');
            }
          } else {
            const isSameDay = eventData.startDatetimeIso && eventData.endDatetimeIso &&
              eventData.startDatetimeIso.substring(0, 10) === eventData.endDatetimeIso.substring(0, 10);
            const endPart = isSameDay
              ? eventData.endDatetimeDisplay?.split(',')[1] || eventData.endDatetimeDisplay || ''
              : eventData.endDatetimeDisplay || '';
            datetimeString = (eventData.datetime || '') + (eventData.endDatetimeDisplay ? ` - ${endPart}` : '');
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
                      text: eventData.invitationText || '📅 เชิญเข้าร่วมกิจกรรม',
                      size: 'xs',
                      color: (eventData.invitationColor?.trim().toUpperCase() === '#FFE600') ? '#334155' : '#ffffff',
                      weight: 'bold',
                      align: 'center'
                    }
                  ],
                  backgroundColor: eventData.invitationColor || '#6d28d9',
                  paddingAll: '6px',
                  paddingStart: '12px',
                  paddingEnd: '12px',
                  cornerRadius: '20px',
                  flex: 0
                },
                ...((eventData.linkType !== 'rsvp') ? [
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
                      uri: `${LIFF_URLS.SHARE_EVENT}?eventId=${eventId}`
                    }
                  }
                ] : [])
              ]
            },
            {
              type: 'text',
              text: eventData.name || 'กิจกรรมใหม่',
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
                      text: eventData.location || '-',
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

          if (eventData.description) {
            bodyContents.push(
              { type: 'separator', margin: 'lg' },
              {
                type: 'box',
                layout: 'vertical',
                margin: 'lg',
                contents: [
                  {
                    type: 'text',
                    text: eventData.description,
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
          if (eventData.linkType === 'rsvp') {
            try {
              const rsvpsList = await eventRsvpsApi.list(eventId);
              rsvpList = rsvpsList.map(normalizeRsvp);
            } catch (rsvpErr) {
              console.error("Error fetching RSVPs for share:", rsvpErr);
            }
          }

          if (eventData.linkType === 'rsvp' && rsvpList.length > 0) {
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
          if (eventData.imageUrl) {
            if (isVideoUrl(eventData.imageUrl)) {
              heroElement = {
                type: 'video',
                url: getMediaVideoLoopUrl(eventData.imageUrl),
                previewUrl: eventData.videoThumbnailUrl || getMediaThumbnailUrl(eventData.imageUrl),
                altContent: {
                  type: 'image',
                  size: 'full',
                  aspectRatio: '16:9',
                  aspectMode: 'cover',
                  url: eventData.videoThumbnailUrl || getMediaThumbnailUrl(eventData.imageUrl)
                },
                aspectRatio: '16:9'
              };
            } else {
              heroElement = {
                type: 'image',
                url: getMediaFlexUrl(eventData.imageUrl),
                size: 'full',
                aspectRatio: '16:9',
                aspectMode: 'cover',
                ...((eventData.linkUrl || eventData.detailUrl) ? {
                  action: {
                    type: 'uri',
                    label: 'detail',
                    uri: eventData.linkUrl || eventData.detailUrl
                  }
                } : {})
              };
            }
          }

          bubble = {
            type: 'bubble',
            ...(heroElement ? { hero: heroElement } : {}),
            body: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '16px',
              contents: bodyContents
            }
          };

          const shareLinkType = eventData.linkType || 'none';
          const shareLinkUrl = eventData.linkUrl || '';
          const shareLinkLabel = eventData.linkLabel || '';

          if (shareLinkType !== 'none') {
            let buttonLabel = '';
            let buttonColor = eventData.buttonColor || '#ef4444';
            let buttonAction: any = null;

            const formatExternalUrl = (url: string) => {
              const trimmed = url.trim();
              return trimmed.includes('?') ? `${trimmed}&openExternalBrowser=1` : `${trimmed}?openExternalBrowser=1`;
            };

            if (shareLinkType === 'zoom') {
              buttonLabel = 'เข้าผ่าน Zoom';
              if (!eventData.buttonColor) buttonColor = '#2d8cff';
              buttonAction = {
                type: 'uri',
                label: buttonLabel,
                uri: formatExternalUrl(shareLinkUrl)
              };
            } else if (shareLinkType === 'register') {
              buttonLabel = 'ลงทะเบียน';
              if (!eventData.buttonColor) buttonColor = '#22c55e';
              buttonAction = {
                type: 'uri',
                label: buttonLabel,
                uri: formatExternalUrl(shareLinkUrl)
              };
            } else if (shareLinkType === 'details') {
              buttonLabel = 'ดูรายละเอียด';
              if (!eventData.buttonColor) buttonColor = '#FFE600';
              buttonAction = {
                type: 'uri',
                label: buttonLabel,
                uri: formatExternalUrl(shareLinkUrl)
              };
            } else if (shareLinkType === 'custom') {
              buttonLabel = shareLinkLabel.trim();
              if (!eventData.buttonColor) buttonColor = '#FF416C';
              buttonAction = {
                type: 'uri',
                label: buttonLabel,
                uri: formatExternalUrl(shareLinkUrl)
              };
            } else if (shareLinkType === 'rsvp') {
              buttonLabel = 'ลงชื่อเข้าร่วม ✍️';
              if (!eventData.buttonColor) buttonColor = '#6d28d9';
              buttonAction = {
                type: 'uri',
                label: 'ลงชื่อเข้าร่วม',
                uri: `${LIFF_URLS.SHARE_EVENT}?action=rsvp&eventId=${eventId || ''}&v=${Date.now()}`
              };
            } else if (shareLinkType === 'calendar') {
              buttonLabel = 'เพิ่มลงบนปฏิทิน 📅';
              if (!eventData.buttonColor) buttonColor = '#3b82f6';
              const calendarParams = new URLSearchParams({
                name: (eventData.name || 'กิจกรรม').substring(0, 100),
                startDatetimeIso: eventData.startDatetimeIso || '',
                endDatetimeIso: eventData.endDatetimeIso || '',
                description: (eventData.description || '').substring(0, 150),
                location: (eventData.location || '').substring(0, 150),
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
        } else if (appointmentId) {
          setStatus('กำลังดึงข้อมูลการนัดหมาย...');
          const appointmentData = await appointmentsApi.get(appointmentId);
          if (!appointmentData) {
            throw new Error('ไม่พบข้อมูลการนัดหมายนี้ในระบบ');
          }
          title = appointmentData.name || 'นัดหมาย';
          altText = `เรามีนัดกันนะ: ${title}`;

          const DEFAULT_EVENT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/fitjourneythailand.appspot.com/o/default-event.png?alt=media";
          const isSameDay = appointmentData.startDatetimeIso && appointmentData.endDatetimeIso &&
            appointmentData.startDatetimeIso.substring(0, 10) === appointmentData.endDatetimeIso.substring(0, 10);
          const endPart = isSameDay
            ? appointmentData.endDatetimeDisplay?.split(',')[1] || appointmentData.endDatetimeDisplay || ''
            : appointmentData.endDatetimeDisplay || '';
          const datetimeString = (appointmentData.datetime || '') + (appointmentData.endDatetimeDisplay ? ` - ${endPart}` : '');

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
                  backgroundColor: '#ef4444',
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
                    uri: `${LIFF_URLS.SHARE_EVENT}?appointmentId=${appointmentId}`
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

          bubble = {
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
        }

        if (!bubble) {
          throw new Error('ไม่สามารถสร้างเทมเพลตสำหรับแชร์ได้');
        }

        const flexMsg = {
          type: 'flex',
          altText: altText,
          contents: bubble
        };

        if (liff.isApiAvailable('shareTargetPicker')) {
          setStatus('กำลังเปิดรายชื่อเพื่อแชร์ข้อความ...');
          const res = await liff.shareTargetPicker([flexMsg as any]);
          if (res) {
            setStatus('แชร์ข้อความสำเร็จแล้ว!');
          } else {
            setStatus('ยกเลิกการแชร์');
          }
        } else {
          throw new Error('อุปกรณ์นี้ไม่รองรับการส่งข้อความหาเป้าหมาย (shareTargetPicker)');
        }

        // Close LIFF window after small delay
        setTimeout(() => {
          liff.closeWindow();
        }, 1500);

      } catch (err: any) {
        console.error('Share Error:', err);
        setError(err.message || 'เกิดข้อผิดพลาดขึ้นในการแชร์');
      } finally {
        setLoading(false);
      }
    };

    fetchAndShare();
  }, [profile, liffLoading, liffError, eventId, appointmentId]);

  const sendRsvpFlexMessage = async (currentList: any[]) => {
    if (!liff.isInClient()) return;
    const evData = eventDataCache;
    const eventName = evData?.name || 'กิจกรรม';
    const eventInvitationColor = evData?.invitationColor || '#6d28d9';
    const eventButtonColor = evData?.buttonColor || '#6d28d9';
    const badgeTextColor = eventInvitationColor.trim().toUpperCase() === '#FFE600' ? '#334155' : '#ffffff';

    let evDatetimeString = evData?.datetime || '';
    if (evData && evData.startDatetimeIso && evData.endDatetimeIso && evData.startDatetimeIso.substring(0, 10) !== evData.endDatetimeIso.substring(0, 10)) {
      const d1 = new Date(evData.startDatetimeIso);
      const d2 = new Date(evData.endDatetimeIso);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        const opt: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        evDatetimeString = `${d1.toLocaleDateString('th-TH', opt)} - ${d2.toLocaleDateString('th-TH', opt)}`;
      }
    } else if (evData) {
      const isSameDay = evData.startDatetimeIso && evData.endDatetimeIso &&
        evData.startDatetimeIso.substring(0, 10) === evData.endDatetimeIso.substring(0, 10);
      const endPart = isSameDay
        ? evData.endDatetimeDisplay?.split(',')[1] || evData.endDatetimeDisplay || ''
        : evData.endDatetimeDisplay || '';
      evDatetimeString = (evData.datetime || '') + (evData.endDatetimeDisplay ? ` - ${endPart}` : '');
    }

    const evImageUrl = evData?.imageUrl || '';
    let heroElement: any = null;
    if (evImageUrl) {
      if (isVideoUrl(evImageUrl)) {
        const videoCover = evData?.videoThumbnailUrl || getMediaThumbnailUrl(evImageUrl);
        heroElement = { type: "video", url: getMediaVideoLoopUrl(evImageUrl), previewUrl: videoCover, altContent: { type: "image", size: "full", aspectRatio: "16:9", aspectMode: "cover", url: videoCover }, aspectRatio: "16:9" };
      } else {
        heroElement = { type: "image", url: getMediaThumbnailUrl(evImageUrl), size: "full", aspectRatio: "16:9", aspectMode: "cover" };
      }
    }

    const rsvpContents = currentList.map((r: any, index: number) => ({
      type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', margin: index === 0 ? 'sm' : 'xs',
      contents: [
        { type: 'box', layout: 'vertical', width: '20px', flex: 0, contents: [{ type: 'text', text: `${index + 1}.`, size: 'sm', color: '#94a3b8' }] },
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

    const rsvpFlexMessage = {
      type: 'flex',
      altText: `✍️ รายชื่อผู้ลงชื่อ: ${eventName}`,
      contents: {
        type: 'bubble',
        ...(heroElement ? { hero: heroElement } : {}),
        body: {
          type: 'box', layout: 'vertical', paddingAll: '16px',
          contents: [
            { type: 'box', layout: 'horizontal', alignItems: 'center', contents: [{ type: 'box', layout: 'vertical', backgroundColor: eventInvitationColor, paddingAll: '6px', paddingStart: '12px', paddingEnd: '12px', cornerRadius: '20px', flex: 0, contents: [{ type: 'text', text: evData?.invitationText || '📅 เชิญเข้าร่วมกิจกรรม', size: 'xs', color: badgeTextColor, weight: 'bold', align: 'center' }] }] },
            { type: 'text', text: eventName, weight: 'bold', size: 'xl', color: '#1e293b', margin: 'md', wrap: true },
            ...(evDatetimeString || evData?.location ? [{ type: 'box', layout: 'vertical', margin: 'lg', spacing: 'sm', contents: [...(evDatetimeString ? [{ type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', contents: [{ type: 'text', text: '🕒', size: 'sm', flex: 0 }, { type: 'text', text: evDatetimeString, size: 'sm', color: '#475569', wrap: true, flex: 1 }] }] : []), ...(evData?.location ? [{ type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', contents: [{ type: 'text', text: '📍', size: 'sm', flex: 0 }, { type: 'text', text: evData.location, size: 'sm', color: '#475569', wrap: true, flex: 1 }] }] : [])] }] : []),
            ...(evData?.description ? [{ type: 'separator', margin: 'lg' }, { type: 'box', layout: 'vertical', margin: 'lg', contents: [{ type: 'text', text: evData.description, size: 'sm', color: '#334155', wrap: true }] }] : []),
            { type: 'separator', margin: 'lg' },
            { type: 'box', layout: 'vertical', margin: 'lg', contents: [{ type: 'text', text: `✍️ รายชื่อผู้ลงชื่อ (${currentList.length} คน)`, weight: 'bold', size: 'sm', color: '#6d28d9' }, ...rsvpContents] }
          ]
        },
        footer: {
          type: 'box', layout: 'vertical', spacing: 'sm', flex: 0,
          contents: [{ type: 'box', layout: 'vertical', backgroundColor: eventButtonColor, cornerRadius: '30px', paddingAll: '10px', action: { type: 'uri', label: 'ลงชื่อเข้าร่วม', uri: `${LIFF_URLS.SHARE_EVENT}?action=rsvp&eventId=${eventId}&v=${Date.now()}` }, contents: [{ type: 'text', text: 'ลงชื่อเข้าร่วม ✍️', color: '#ffffff', weight: 'bold', size: 'sm', align: 'center' }] }]
        }
      }
    };

    await liff.sendMessages([rsvpFlexMessage as any]);
  };

  // ─── performRsvp: saves RSVP entry and sends Flex Message ───
  const performRsvp = async (displayName: string, pictureUrl: string, rsvpDocId: string) => {
    if (!eventId || !profile) return;
    setSubmitting(true);
    try {
      // Save RSVP
      await eventRsvpsApi.join({
        eventId,
        userId: rsvpDocId,
        displayName,
        pictureUrl
      });

      // Fetch all RSVPs
      const rsvpsList = await eventRsvpsApi.list(eventId);
      const updatedRsvps = rsvpsList.map(normalizeRsvp);
      setRsvpList(updatedRsvps);
      if (rsvpDocId === profile.userId) {
        setAlreadyRsvped(true);
      }

      await sendRsvpFlexMessage(updatedRsvps);

      setSuccessMessage('ลงชื่อเข้าร่วมสำเร็จแล้วครับ! 🎉');
      setShowModePopup(false);
      setShowSuccess(true);
      setTimeout(() => {
        setFadeOutActive(true);
        if (liff.isInClient()) {
          setTimeout(() => { liff.closeWindow(); }, 500);
        }
      }, 1500);
    } catch (err: any) {
      console.error('[performRsvp error]', err);
      alert('เกิดข้อผิดพลาด: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const canWithdraw = (r: any) => {
    if (!profile) return false;
    if (r.id === profile.userId) return true;
    if (r.registeredBy === profile.userId) return true;
    if (String(r.id || '').startsWith('friend_') && String(r.displayName || '').endsWith(`(${profile.displayName})`)) return true;
    return false;
  };

  const handleWithdraw = async () => {
    if (!eventId || !profile || selectedWithdrawIds.length === 0) return;
    setSubmitting(true);
    try {
      for (const rsvpId of selectedWithdrawIds) {
        await eventRsvpsApi.withdraw(eventId, rsvpId);
      }
      
      const updatedRsvps = rsvpList.filter(r => !selectedWithdrawIds.includes(r.id));
      setRsvpList(updatedRsvps);
      
      if (selectedWithdrawIds.includes(profile.userId)) {
        setAlreadyRsvped(false);
      }
      
      await sendRsvpFlexMessage(updatedRsvps);

      setSelectedWithdrawIds([]);
      setShowWithdrawMode(false);
      
      setSuccessMessage('ถอนชื่อเรียบร้อยแล้วครับ! ❌');
      setShowModePopup(false);
      setShowSuccess(true);
      
      setTimeout(() => {
        setFadeOutActive(true);
        if (liff.isInClient()) {
          setTimeout(() => { liff.closeWindow(); }, 500);
        }
      }, 1500);
    } catch (err: any) {
      console.error('[Withdraw error]', err);
      alert('เกิดข้อผิดพลาดในการถอนชื่อ: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRsvpStatusChange = async () => {
    if (!eventId || !profile || eventDataCache?.createdBy !== profile.userId) return;
    const nextValue = !rsvpEnabled;
    setUpdatingRsvpStatus(true);
    try {
      const updatedEvent = await eventsApi.update(eventId, {
        rsvpEnabled: nextValue,
        requesterId: profile.userId
      });
      setRsvpEnabled(updatedEvent.rsvpEnabled !== false);
      setEventDataCache((current: any) => ({ ...current, rsvpEnabled: updatedEvent.rsvpEnabled }));
      setRsvpMode(null);
      setShowWithdrawMode(false);
    } catch (err: any) {
      alert('เปลี่ยนสถานะการรับลงชื่อไม่สำเร็จ: ' + (err.message || err));
    } finally {
      setUpdatingRsvpStatus(false);
    }
  };

  const handleRsvpFriendStatusChange = async () => {
    if (!eventId || !profile || eventDataCache?.createdBy !== profile.userId) return;
    const nextValue = !rsvpFriendEnabled;
    setUpdatingRsvpStatus(true);
    try {
      const updatedEvent = await eventsApi.update(eventId, {
        rsvpFriendEnabled: nextValue,
        requesterId: profile.userId
      });
      setRsvpFriendEnabled(updatedEvent.rsvpFriendEnabled !== false);
      setEventDataCache((current: any) => ({ ...current, rsvpFriendEnabled: updatedEvent.rsvpFriendEnabled }));
      if (!nextValue) {
        setRsvpMode(null);
        setFriendName('');
      }
    } catch (err: any) {
      alert('เปลี่ยนสถานะการลงชื่อให้เพื่อนไม่สำเร็จ: ' + (err.message || err));
    } finally {
      setUpdatingRsvpStatus(false);
    }
  };

  // ─── RSVP Mode Selection Popup ───
  if (showModePopup && profile && action === 'rsvp') {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '24px', fontFamily: 'sans-serif', boxSizing: 'border-box', overflowY: 'auto'
      }}>
        <div style={{
          background: '#fff', borderRadius: '28px', width: '100%', maxWidth: '380px',
          padding: '32px 28px', boxShadow: '0 20px 60px rgba(109,40,217,0.12), 0 4px 20px rgba(0,0,0,0.08)',
          boxSizing: 'border-box', textAlign: 'center', margin: 'auto'
        }}>

          {/* Event badge + name */}
          {eventDataCache?.name && (() => {
            let evDatetimeString = eventDataCache.datetime || '';
            if (eventDataCache.startDatetimeIso && eventDataCache.endDatetimeIso && eventDataCache.startDatetimeIso.substring(0, 10) !== eventDataCache.endDatetimeIso.substring(0, 10)) {
              const d1 = new Date(eventDataCache.startDatetimeIso);
              const d2 = new Date(eventDataCache.endDatetimeIso);
              if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                const opt: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
                evDatetimeString = `${d1.toLocaleDateString('th-TH', opt)} - ${d2.toLocaleDateString('th-TH', opt)}`;
              }
            } else {
              const isSameDay = eventDataCache.startDatetimeIso && eventDataCache.endDatetimeIso &&
                eventDataCache.startDatetimeIso.substring(0, 10) === eventDataCache.endDatetimeIso.substring(0, 10);
              const endPart = isSameDay
                ? eventDataCache.endDatetimeDisplay?.split(',')[1] || eventDataCache.endDatetimeDisplay || ''
                : eventDataCache.endDatetimeDisplay || '';
              evDatetimeString = (eventDataCache.datetime || '') + (eventDataCache.endDatetimeDisplay ? ` - ${endPart}` : '');
            }

            return (
              <div style={{ marginBottom: '20px' }}>
                <span style={{
                  background: eventDataCache?.invitationColor || '#6d28d9',
                  color: (eventDataCache?.invitationColor || '').trim().toUpperCase() === '#FFE600' ? '#334155' : '#fff',
                  borderRadius: '20px', padding: '4px 14px', fontSize: '0.75rem', fontWeight: 'bold'
                }}>
                  ลงชื่อเข้าร่วมกิจกรรม
                </span>
                <div style={{ marginTop: '10px', fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b' }}>
                  {eventDataCache.name}
                </div>
                {evDatetimeString && (
                  <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#64748b' }}>
                    🕒 {evDatetimeString}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Owner toggles */}
          {eventDataCache?.createdBy === profile.userId && (
            <div style={{
              marginBottom: '22px', padding: '14px', borderRadius: '20px',
              background: 'linear-gradient(145deg, #fafaff 0%, #f5f3ff 100%)',
              border: '1px solid #e9e5ff', boxShadow: '0 8px 24px rgba(109,40,217,0.07)',
              display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 2px 2px' }}>
                <span style={{ fontSize: '1rem' }}>⚙️</span>
                <div>
                  <div style={{ color: '#312e81', fontWeight: 800, fontSize: '0.82rem' }}>ตั้งค่าการลงชื่อ</div>
                  <div style={{ color: '#8b8aa3', fontSize: '0.68rem', marginTop: '1px' }}>เฉพาะผู้สร้างกิจกรรมเท่านั้น</div>
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                background: '#ffffff', borderRadius: '15px', padding: '12px 13px',
                border: `1.5px solid ${rsvpEnabled ? '#bbf7d0' : '#e2e8f0'}`,
                boxShadow: '0 2px 8px rgba(30,41,59,0.04)', transition: 'all 0.25s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '11px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', background: rsvpEnabled ? '#dcfce7' : '#f1f5f9' }}>✍️</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#1e293b' }}>เปิดรับลงชื่อ</div>
                    <div style={{ fontSize: '0.7rem', color: rsvpEnabled ? '#15803d' : '#64748b', marginTop: '2px', fontWeight: 600 }}>
                      {rsvpEnabled ? 'ผู้เข้าร่วมลงชื่อได้แล้ว' : 'หยุดรับรายชื่อชั่วคราว'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleRsvpStatusChange}
                  disabled={updatingRsvpStatus}
                  role="switch"
                  aria-checked={rsvpEnabled}
                  aria-label="เปิดหรือปิดการรับลงชื่อ"
                  style={{ width: '62px', height: '32px', borderRadius: '18px', border: 'none', padding: 0, cursor: updatingRsvpStatus ? 'wait' : 'pointer', overflow: 'hidden', background: rsvpEnabled ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#cbd5e1', position: 'relative', transition: 'all 0.25s ease', flexShrink: 0, opacity: updatingRsvpStatus ? 0.6 : 1, boxShadow: rsvpEnabled ? '0 4px 10px rgba(22,163,74,0.25)' : 'inset 0 1px 3px rgba(15,23,42,0.12)' }}
                >
                  <span style={{ position: 'absolute', left: rsvpEnabled ? '8px' : '29px', top: '9px', color: '#fff', fontSize: '0.58rem', fontWeight: 900, letterSpacing: '0.03em' }}>{rsvpEnabled ? 'ON' : 'OFF'}</span>
                  <span style={{ position: 'absolute', top: '4px', left: rsvpEnabled ? '34px' : '4px', width: '24px', height: '24px', borderRadius: '50%', background: '#fff', transition: 'left 0.25s ease', boxShadow: '0 2px 6px rgba(15,23,42,0.22)' }} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: rsvpEnabled ? '#ffffff' : '#f8fafc', borderRadius: '15px', padding: '12px 13px', border: `1.5px solid ${rsvpEnabled && rsvpFriendEnabled ? '#ddd6fe' : '#e2e8f0'}`, boxShadow: rsvpEnabled ? '0 2px 8px rgba(30,41,59,0.04)' : 'none', opacity: rsvpEnabled ? 1 : 0.68, transition: 'all 0.25s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '11px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', background: rsvpEnabled && rsvpFriendEnabled ? '#ede9fe' : '#e2e8f0' }}>👥</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#1e293b' }}>อนุญาตลงชื่อให้เพื่อน</div>
                    <div style={{ fontSize: '0.7rem', color: !rsvpEnabled ? '#64748b' : rsvpFriendEnabled ? '#6d28d9' : '#64748b', marginTop: '2px', fontWeight: 600 }}>
                      {!rsvpEnabled ? 'เปิดรับลงชื่อก่อนจึงจะตั้งค่าได้' : rsvpFriendEnabled ? 'เพิ่มรายชื่อแทนเพื่อนได้' : 'ลงชื่อได้เฉพาะตัวเอง'}
                    </div>
                  </div>
                </div>
                <button onClick={handleRsvpFriendStatusChange} disabled={!rsvpEnabled || updatingRsvpStatus} aria-label="เปิดหรือปิดการลงชื่อให้เพื่อน" role="switch" aria-checked={rsvpEnabled && rsvpFriendEnabled} style={{ width: '62px', height: '32px', borderRadius: '18px', border: 'none', padding: 0, cursor: !rsvpEnabled ? 'not-allowed' : updatingRsvpStatus ? 'wait' : 'pointer', overflow: 'hidden', background: rsvpEnabled && rsvpFriendEnabled ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : '#cbd5e1', position: 'relative', transition: 'all 0.25s ease', flexShrink: 0, opacity: (!rsvpEnabled || updatingRsvpStatus) ? 0.65 : 1, boxShadow: rsvpEnabled && rsvpFriendEnabled ? '0 4px 10px rgba(109,40,217,0.25)' : 'inset 0 1px 3px rgba(15,23,42,0.12)' }}>
                  <span style={{ position: 'absolute', left: rsvpEnabled && rsvpFriendEnabled ? '8px' : '29px', top: '9px', color: '#fff', fontSize: '0.58rem', fontWeight: 900, letterSpacing: '0.03em' }}>{rsvpEnabled && rsvpFriendEnabled ? 'ON' : 'OFF'}</span>
                  <span style={{ position: 'absolute', top: '4px', left: rsvpEnabled && rsvpFriendEnabled ? '34px' : '4px', width: '24px', height: '24px', borderRadius: '50%', background: '#fff', transition: 'left 0.25s ease', boxShadow: '0 2px 6px rgba(15,23,42,0.22)' }} />
                </button>
              </div>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: '1px', background: '#f1f5f9', margin: '0 0 24px 0' }} />

          {!rsvpEnabled ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '14px', padding: '16px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔒</div>
                <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#dc2626' }}>ปิดการรับลงชื่อแล้ว</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>ผู้สร้างกิจกรรมได้ปิดรับลงชื่อสำหรับกิจกรรมนี้แล้ว</div>
              </div>
              <button
                onClick={() => liff.isInClient() ? liff.closeWindow() : window.close()}
                style={{ width: '100%', padding: '13px', borderRadius: '14px', border: '1.5px solid #e2e8f0', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', background: '#f1f5f9', color: '#475569' }}
              >
                ← ออก
              </button>
            </div>
          ) : (
            <>

          {/* Profile */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
            {profile.pictureUrl ? (
              <img
                src={profile.pictureUrl}
                alt="profile"
                style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #ede9fe', boxShadow: '0 4px 12px rgba(109,40,217,0.15)' }}
              />
            ) : (
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, #6d28d9, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>👤</div>
            )}
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#1e293b' }}>{profile.displayName}</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>ลงชื่อเข้าร่วมกิจกรรมนี้ในฐานะใคร?</div>
              {alreadyRsvped && (
                <div style={{ marginTop: '8px', fontSize: '1.05rem', color: '#16a34a', fontWeight: 'bold' }}>
                  ✅ คุณลงชื่อเข้าร่วมแล้ว
                </div>
              )}
            </div>
          </div>

          {/* Mode: Withdraw registrations */}
          {showWithdrawMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b', marginBottom: '8px' }}>
                เลือกรายชื่อที่ต้องการถอนออก:
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rsvpList.filter(canWithdraw).map(r => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={selectedWithdrawIds.includes(r.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedWithdrawIds(prev => [...prev, r.id]);
                        } else {
                          setSelectedWithdrawIds(prev => prev.filter(id => id !== r.id));
                        }
                      }}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    {r.displayName}
                  </label>
                ))}
              </div>
              
              <button
                onClick={handleWithdraw}
                disabled={selectedWithdrawIds.length === 0 || submitting}
                style={{
                  width: '100%', padding: '12px', borderRadius: '14px', border: 'none', fontWeight: 'bold', fontSize: '0.95rem',
                  cursor: selectedWithdrawIds.length > 0 ? 'pointer' : 'not-allowed',
                  background: selectedWithdrawIds.length > 0 ? '#ef4444' : '#e2e8f0',
                  color: selectedWithdrawIds.length > 0 ? '#fff' : '#94a3b8',
                  boxShadow: selectedWithdrawIds.length > 0 ? '0 4px 12px rgba(239,68,68,0.25)' : 'none',
                  marginTop: '6px'
                }}
              >
                {submitting ? 'กำลังถอนชื่อ...' : `❌ ยืนยันถอนชื่อ (${selectedWithdrawIds.length})`}
              </button>
              
              <button
                onClick={() => { setShowWithdrawMode(false); setSelectedWithdrawIds([]); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', cursor: 'pointer', padding: '4px', textAlign: 'center' }}
              >
                ยกเลิก
              </button>
            </div>
          ) : rsvpMode === 'friend' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  👥 ชื่อเพื่อนที่ต้องการลงชื่อให้
                </label>
                <input
                  autoFocus
                  type="text"
                  value={friendName}
                  onChange={e => setFriendName(e.target.value)}
                  placeholder="กรอกชื่อเพื่อน..."
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '0.95rem', fontFamily: 'inherit', color: '#1e293b', boxSizing: 'border-box', outline: 'none' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && friendName.trim()) {
                      performRsvp(`${friendName.trim()} (${profile.displayName})`, '', `friend_${Date.now()}`);
                    }
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
                  รายชื่อจะแสดงเป็น: <strong style={{ color: '#6d28d9' }}>{friendName.trim() || '...'} ({profile.displayName})</strong>
                </div>
              </div>
              <button
                onClick={() => {
                  if (friendName.trim()) {
                    performRsvp(`${friendName.trim()} (${profile.displayName})`, '', `friend_${Date.now()}`);
                  }
                }}
                disabled={!friendName.trim() || submitting}
                style={{
                  width: '100%', padding: '14px', borderRadius: '16px', border: 'none', fontWeight: 'bold', fontSize: '1rem',
                  cursor: friendName.trim() ? 'pointer' : 'not-allowed',
                  background: friendName.trim() ? 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)' : '#e2e8f0',
                  color: friendName.trim() ? '#fff' : '#94a3b8',
                  boxShadow: friendName.trim() ? '0 4px 14px rgba(109,40,217,0.35)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                {submitting ? 'กำลังลงชื่อ...' : '✅ ยืนยันลงชื่อให้เพื่อน'}
              </button>
              <button
                onClick={() => { setRsvpMode(null); setFriendName(''); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', cursor: 'pointer', padding: '4px' }}
              >
                ← ย้อนกลับ
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {!alreadyRsvped && (
                <button
                  onClick={() => performRsvp(profile.displayName, profile.pictureUrl || '', profile.userId)}
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '15px', borderRadius: '16px', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)',
                    color: '#fff', boxShadow: '0 4px 14px rgba(109,40,217,0.35)', transition: 'all 0.2s', marginBottom: '4px'
                  }}
                >
                  {submitting ? 'กำลังลงชื่อ...' : '✍️ ลงชื่อด้วยตัวเอง'}
                </button>
              )}
              
              {rsvpFriendEnabled && (
                <button
                  onClick={() => setRsvpMode('friend')}
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '11px', borderRadius: '14px', border: '1.5px solid #e2e8f0', fontWeight: 'bold', fontSize: '0.88rem', cursor: 'pointer',
                    background: '#f8fafc', color: '#475569', transition: 'all 0.2s'
                  }}
                >
                  👥 ลงชื่อให้เพื่อน
                </button>
              )}

              {rsvpList.filter(canWithdraw).length > 0 && (
                <button
                  onClick={() => setShowWithdrawMode(true)}
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '11px', borderRadius: '14px', border: '1.5px solid #fecaca', fontWeight: 'bold', fontSize: '0.88rem', cursor: 'pointer',
                    background: '#fff5f5', color: '#dc2626', transition: 'all 0.2s', marginTop: '4px'
                  }}
                >
                  ❌ ถอนรายชื่อ
                </button>
              )}
            </div>
          )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (showSuccess) {
    const isWithdraw = successMessage.includes('ถอนชื่อ');
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', padding: '20px', fontFamily: 'sans-serif',
        opacity: fadeOutActive ? 0 : 1,
        transition: 'opacity 0.5s ease-out'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
            {isWithdraw ? (
              <path className="checkmark__check" fill="none" d="M16 16 L36 36 M36 16 L16 36"/>
            ) : (
              <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            )}
          </svg>
        </div>
        <h2 style={{ marginTop: '24px', color: isWithdraw ? '#ef4444' : '#16a34a', fontWeight: 'bold', fontSize: '1.3rem', textAlign: 'center', padding: '0 20px', lineHeight: '1.6' }}>
          {successMessage}
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
            stroke: ${isWithdraw ? '#ef4444' : '#22c55e'};
            stroke-miterlimit: 10;
            box-shadow: inset 0px 0px 0px ${isWithdraw ? '#ef4444' : '#22c55e'};
            animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both;
          }
          .checkmark__circle {
            stroke-dasharray: 166;
            stroke-dashoffset: 166;
            stroke-width: 4;
            stroke-miterlimit: 10;
            stroke: ${isWithdraw ? '#ef4444' : '#22c55e'};
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
            100% { box-shadow: inset 0px 0px 0px 40px ${isWithdraw ? '#ef4444' : '#22c55e'}; }
          }
          @keyframes scale {
            0%, 100% { transform: none; }
            50% { transform: scale3d(1.1, 1.1, 1); }
          }
        `}} />
      </div>
    );
  }

  if (liffLoading || loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #6d28d9', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '20px', fontSize: '1.1rem', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>{status}</p>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <span style={{ fontSize: '3rem' }}>❌</span>
        <h2 style={{ margin: '15px 0 10px 0', color: '#e11d48' }}>การแชร์ไม่สำเร็จ</h2>
        <p style={{ color: '#64748b', marginBottom: '20px', maxWidth: '400px' }}>{error}</p>
        <button 
          onClick={() => liff.closeWindow()} 
          style={{ padding: '10px 24px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ปิดหน้านี้
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <span style={{ fontSize: '3rem' }}>✅</span>
      <h2 style={{ margin: '15px 0 10px 0', color: '#16a34a' }}>ทำรายการเรียบร้อย</h2>
      <p style={{ color: '#64748b' }}>กำลังปิดหน้านี้...</p>
    </div>
  );
}

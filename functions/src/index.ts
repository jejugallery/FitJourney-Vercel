import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import axios from "axios";
import * as crypto from "crypto";

admin.initializeApp();

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const isVideoUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  if (url.includes('/video/upload/')) return true;
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.avi', '.mkv', '.quicktime'];
  const urlLower = url.toLowerCase();
  return videoExtensions.some(ext => 
    urlLower.endsWith(ext) || 
    urlLower.includes(ext + '?') || 
    urlLower.includes(ext + '&')
  );
};

const getMediaThumbnailUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (isVideoUrl(url)) {
    if (url.includes('/video/upload/')) {
      const lastDotIndex = url.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        return url.substring(0, lastDotIndex).replace('/video/upload/', '/video/upload/so_0/') + '.jpg';
      }
    }
    return 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=600&auto=format&fit=crop';
  }
  return url;
};

const getMediaVideoLoopUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.includes('/video/upload/')) {
    return url.replace('/video/upload/', '/video/upload/e_loop:5/');
  }
  return url;
};

// IG variables disabled
// const IG_PAGE_ACCESS_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN;
// const IG_VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN || 'fitjourney_ig_token_123';

// sendLineFlex Cloud Function has been removed as it is now handled via LIFF client-side

// notifyTrainerFoodUpload Cloud Function has been removed as LINE push messages are disabled and notifications are handled client-side via LIFF

// Instagram Webhook - Disabled
// export const igWebhook = ...

// remindFoodUpload Cloud Function has been removed as it is now handled via LIFF client-side

// notifyEventInvitation Cloud Function has been removed as it is now handled via LIFF client-side

// generateICS Cloud Function has been removed as it is now generated client-side

// analyzeFood, analyzePaymentSlip, and analyzeBodyMetrics Cloud Functions have been removed as Gemini API is now called directly client-side

export const lineWebhook = functions.region('asia-southeast1').https.onRequest(async (req, res) => {
  const host = (req.headers.host && !req.headers.host.includes('cloudfunctions.net')) ? req.headers.host : 'fitjourneythailand.web.app';
  const origin = host.startsWith('localhost') ? `http://${host}` : `https://${host}`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method === 'GET') {
    res.status(200).send('FitJourney LINE Webhook is running.');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Verification from LINE Developers Console
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const lineSignature = req.headers['x-line-signature'] as string;

  if (channelSecret && lineSignature) {
    const rawBody = (req as any).rawBody;
    if (rawBody) {
      const hash = crypto
        .createHmac('sha256', channelSecret)
        .update(rawBody)
        .digest('base64');
      if (hash !== lineSignature) {
        console.warn('LINE Signature verification failed.');
        res.status(401).send('Invalid Signature');
        return;
      }
    }
  }

  const events = req.body.events;
  if (!events || !Array.isArray(events)) {
    res.status(200).send('OK');
    return;
  }

  const db = admin.firestore();

  for (const event of events) {
    const replyToken = event.replyToken;
    const userId = event.source?.userId;
    let eventId = '';
    let isRsvpAction = false;

    if (event.type === 'postback') {
      const data: string = event.postback?.data || '';
      if (data.startsWith('action=rsvp')) {
        const params = new URLSearchParams(data);
        eventId = params.get('eventId') || '';
        isRsvpAction = true;
      }
    } else if (event.type === 'message' && event.message?.type === 'text') {
      const text = event.message.text || '';
      if (text.startsWith('✍️ ลงชื่อเข้าร่วมกิจกรรม ')) {
        eventId = text.replace('✍️ ลงชื่อเข้าร่วมกิจกรรม ', '').trim();
        isRsvpAction = true;
      } else if (text.trim().includes('ส่งอาหาร')) {
        const foodFlexMessage = {
          type: 'flex',
          altText: '🍽️ วันนี้ส่งอาหารหรือยังน้าาาา ? 🥗🍳',
          contents: {
            type: 'bubble',
            hero: {
              type: 'image',
              url: 'https://i.postimg.cc/ZntzdHMG/image.png',
              size: 'full',
              aspectRatio: '16:9',
              aspectMode: 'cover'
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              backgroundColor: '#bcd78d',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: '#fd9b06',
                  cornerRadius: '30px',
                  paddingAll: '10px',
                  action: {
                    type: 'uri',
                    label: 'ลงทะเบียนเลย',
                    uri: 'https://liff.line.me/2010284484-jvUDlx0u?action=upload-food'
                  },
                  contents: [
                    {
                      type: 'text',
                      text: 'ส่งเลยตอนนี้',
                      color: '#ffffff',
                      weight: 'bold',
                      size: 'sm',
                      align: 'center'
                    }
                  ]
                }
              ],
              flex: 0
            }
          }
        };

        if (replyToken && LINE_CHANNEL_ACCESS_TOKEN) {
          try {
            await axios.post('https://api.line.me/v2/bot/message/reply',
              { replyToken, messages: [foodFlexMessage] },
              { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
            );
          } catch (err: any) {
            console.error('[Webhook] Remind food upload reply error:', err.response?.data || err.message);
          }
        }
        continue;
      } else if (text.trim().includes('เข้าสู่ระบบ')) {
        const loginFlexMessage = {
          type: 'flex',
          altText: 'FitJourney: เข้าสู่ระบบ 🔑',
          contents: {
            type: 'bubble',
            hero: {
              type: 'image',
              url: 'https://i.postimg.cc/QMzCQFzk/login.png',
              size: 'full',
              aspectRatio: '1000:618',
              aspectMode: 'cover',
              action: {
                type: 'uri',
                label: 'เข้าสู่ระบบ',
                uri: 'https://liff.line.me/2010284484-jvUDlx0u'
              }
            }
          }
        };

        if (replyToken && LINE_CHANNEL_ACCESS_TOKEN) {
          try {
            await axios.post('https://api.line.me/v2/bot/message/reply',
              { replyToken, messages: [loginFlexMessage] },
              { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
            );
          } catch (err: any) {
            console.error('[Webhook] Login reply error:', err.response?.data || err.message);
          }
        }
        continue;
      }
    }

    // RSVP Handler
    if (isRsvpAction && eventId && userId && replyToken && LINE_CHANNEL_ACCESS_TOKEN) {

      const rsvpRef = db.collection('events').doc(eventId).collection('rsvps').doc(userId);
      const rsvpSnap = await rsvpRef.get();

      if (rsvpSnap.exists) {
        // Already signed up — reply "คุณลงชื่อแล้วครับ ✅"
        try {
          await axios.post('https://api.line.me/v2/bot/message/reply', 
            { replyToken, messages: [{ type: 'text', text: 'คุณลงชื่อแล้วครับ ✅' }] },
            { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
          );
        } catch (err: any) {
          console.error('[RSVP] Already signed up reply error:', err.response?.data || err.message);
        }
        continue;
      }

      // Get LINE profile
      let displayName = 'ผู้เข้าร่วม';
      let pictureUrl = '';
      try {
        const profileRes = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, {
          headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` }
        });
        displayName = profileRes.data.displayName || displayName;
        pictureUrl = profileRes.data.pictureUrl || '';
      } catch (e: any) {
        console.warn('[RSVP] profile fetch failed:', e.response?.data || e.message);
      }

      // Save RSVP
      await rsvpRef.set({
        userId,
        displayName,
        pictureUrl,
        joinedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Get all RSVPs ordered by joinedAt (No limit - show all)
      const allRsvpsSnap = await db.collection('events').doc(eventId).collection('rsvps').orderBy('joinedAt').get();
      const rsvpList = allRsvpsSnap.docs.map(d => d.data());

      // Get event data
      const eventSnap = await db.collection('events').doc(eventId).get();
      const evData = eventSnap.data();
      let evDatetimeString = evData?.datetime || '';
      if (evData) {
        if (evData.startDatetimeIso && evData.endDatetimeIso && evData.startDatetimeIso.substring(0, 10) !== evData.endDatetimeIso.substring(0, 10)) {
          const d1 = new Date(evData.startDatetimeIso);
          const d2 = new Date(evData.endDatetimeIso);
          if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
            const opt = { year: 'numeric', month: 'long', day: 'numeric' } as const;
            evDatetimeString = `${d1.toLocaleDateString('th-TH', opt)} - ${d2.toLocaleDateString('th-TH', opt)}`;
          }
        } else {
          const isSameDay = evData.startDatetimeIso && evData.endDatetimeIso &&
            evData.startDatetimeIso.substring(0, 10) === evData.endDatetimeIso.substring(0, 10);
          const endPart = isSameDay
            ? evData.endDatetimeDisplay?.split(',')[1] || evData.endDatetimeDisplay || ''
            : evData.endDatetimeDisplay || '';
          evDatetimeString = (evData.datetime || '') + (evData.endDatetimeDisplay ? ` - ${endPart}` : '');
        }
      }
      const eventName = evData?.name || 'กิจกรรม';
      const eventInvitationColor = evData?.invitationColor || '#6d28d9';
      const badgeTextColor = eventInvitationColor.trim().toUpperCase() === '#FFE600' ? '#334155' : '#ffffff';

      // Build Hero Element (Image or Video)
      let heroElement: any = null;
      const evImageUrl = evData?.imageUrl || '';
      
      if (evImageUrl) {
        if (isVideoUrl(evImageUrl)) {
          const videoCover = evData?.videoThumbnailUrl || getMediaThumbnailUrl(evImageUrl);
          heroElement = {
            type: "video",
            url: getMediaVideoLoopUrl(evImageUrl),
            previewUrl: videoCover,
            altContent: {
              type: "image",
              size: "full",
              aspectRatio: "16:9",
              aspectMode: "cover",
              url: videoCover
            },
            aspectRatio: "16:9"
          };
        } else {
          heroElement = {
            type: "image",
            url: getMediaThumbnailUrl(evImageUrl),
            size: "full",
            aspectRatio: "16:9",
            aspectMode: "cover"
          };
        }
      }

      // Build RSVP list contents
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

      // Construct the dynamic footer button based on linkType
      const shareLinkType = evData?.linkType || 'none';
      const shareLinkUrl = evData?.linkUrl || '';
      const shareLinkLabel = evData?.linkLabel || '';

      let footerElement: any = null;

      if (shareLinkType !== 'none') {
        let buttonLabel = '';
        let buttonColor = evData?.buttonColor || '#ef4444';
        let buttonAction: any = null;

        const formatExternalUrl = (url: string) => {
          const trimmed = url.trim();
          return trimmed.includes('?') ? `${trimmed}&openExternalBrowser=1` : `${trimmed}?openExternalBrowser=1`;
        };

        if (shareLinkType === 'zoom') {
          buttonLabel = 'เข้าผ่าน Zoom';
          if (!evData?.buttonColor) buttonColor = '#2d8cff';
          buttonAction = {
            type: 'uri',
            label: buttonLabel,
            uri: formatExternalUrl(shareLinkUrl)
          };
        } else if (shareLinkType === 'register') {
          buttonLabel = 'ลงทะเบียน';
          if (!evData?.buttonColor) buttonColor = '#22c55e';
          buttonAction = {
            type: 'uri',
            label: buttonLabel,
            uri: formatExternalUrl(shareLinkUrl)
          };
        } else if (shareLinkType === 'details') {
          buttonLabel = 'ดูรายละเอียด';
          if (!evData?.buttonColor) buttonColor = '#FFE600';
          buttonAction = {
            type: 'uri',
            label: buttonLabel,
            uri: formatExternalUrl(shareLinkUrl)
          };
        } else if (shareLinkType === 'custom') {
          buttonLabel = shareLinkLabel.trim();
          if (!evData?.buttonColor) buttonColor = '#FF416C';
          buttonAction = {
            type: 'uri',
            label: buttonLabel,
            uri: formatExternalUrl(shareLinkUrl)
          };
        } else if (shareLinkType === 'rsvp') {
          buttonLabel = 'ลงชื่อเข้าร่วม ✍️';
          if (!evData?.buttonColor) buttonColor = '#6d28d9';
          buttonAction = {
            type: 'uri',
            label: 'ลงชื่อเข้าร่วม',
            uri: `https://liff.line.me/2010284484-JPGd3KXg?action=rsvp&eventId=${eventId}&v=${Date.now()}`
          };
        } else if (shareLinkType === 'calendar') {
          buttonLabel = 'เพิ่มลงบนปฏิทิน 📅';
          if (!evData?.buttonColor) buttonColor = '#3b82f6';
          buttonAction = {
            type: 'uri',
            label: buttonLabel,
            uri: `${origin}/download-ics?eventId=${eventId}&openExternalBrowser=1`
          };
        }

        if (buttonLabel && buttonAction) {
          const isYellow = buttonColor.trim().toUpperCase() === '#FFE600';
          footerElement = {
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
                    color: isYellow ? '#334155' : '#ffffff',
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

      // Build Flex Message (same structure as event invitation + RSVP list section)
      const rsvpFlexMessage = {
        type: 'flex',
        altText: `✍️ รายชื่อผู้ลงชื่อ: ${eventName}`,
        contents: {
          type: 'bubble',
          ...(heroElement ? { hero: heroElement } : {}),
          body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '16px',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                alignItems: 'center',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: eventInvitationColor,
                    paddingAll: '6px',
                    paddingStart: '12px',
                    paddingEnd: '12px',
                    cornerRadius: '20px',
                    flex: 0,
                    contents: [
                      {
                        type: 'text',
                        text: evData?.invitationText || '📅 เชิญเข้าร่วมกิจกรรม',
                        size: 'xs',
                        color: badgeTextColor,
                        weight: 'bold',
                        align: 'center'
                      }
                    ]
                  }
                ]
              },
              { type: 'text', text: eventName, weight: 'bold', size: 'xl', color: '#1e293b', margin: 'md', wrap: true },
              ...(evDatetimeString || evData?.location ? [
                {
                  type: 'box',
                  layout: 'vertical',
                  margin: 'lg',
                  spacing: 'sm',
                  contents: [
                    ...(evDatetimeString ? [{ type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', contents: [{ type: 'text', text: '🕒', size: 'sm', flex: 0 }, { type: 'text', text: evDatetimeString, size: 'sm', color: '#475569', wrap: true, flex: 1 }] }] : []),
                    ...(evData?.location ? [{ type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', contents: [{ type: 'text', text: '📍', size: 'sm', flex: 0 }, { type: 'text', text: evData.location, size: 'sm', color: '#475569', wrap: true, flex: 1 }] }] : [])
                  ]
                }
              ] : []),
              ...(evData?.description ? [
                { type: 'separator', margin: 'lg' },
                {
                  type: 'box',
                  layout: 'vertical',
                  margin: 'lg',
                  contents: [
                    { type: 'text', text: evData.description, size: 'sm', color: '#334155', wrap: true }
                  ]
                }
              ] : []),
              ...(evData?.linkType === 'rsvp' && rsvpList.length > 0 ? [
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
              ] : [])
            ]
          },
          ...(footerElement ? { footer: footerElement } : {})
        }
      };

      try {
        await axios.post('https://api.line.me/v2/bot/message/reply',
          { replyToken, messages: [rsvpFlexMessage] },
          { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
        );
      } catch (err: any) {
        console.error('[RSVP] Send reply Flex message error:', err.response?.data || err.message);
      }
      continue;
    }

    // Other postback handlers
    if (event.type === 'postback') {
      const data: string = event.postback?.data || '';
      let responseText = 'ขอบคุณที่กดปุ่มครับ 👍';
      if (data === 'action=check_status') responseText = 'กำลังตรวจสอบสถานะให้ครับ...';
      else if (data === 'action=get_help') responseText = 'นี่คือเมนูช่วยเหลือจาก FitJourney ครับ 🙏';

      if (replyToken && LINE_CHANNEL_ACCESS_TOKEN) {
        try {
          await axios.post('https://api.line.me/v2/bot/message/reply',
            { replyToken, messages: [{ type: 'text', text: responseText }] },
            { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
          );
        } catch (err: any) {
          console.error('Error replying postback to LINE:', err.response?.data || err.message);
        }
      }
    }
  }

  res.status(200).send('OK');
});

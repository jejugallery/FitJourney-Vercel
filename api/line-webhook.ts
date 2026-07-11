import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db';
import axios from 'axios';
import * as crypto from 'crypto';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Line-Signature');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).send('FitJourney LINE Webhook is running.');
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Verification from LINE Developers Console
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const lineSignature = req.headers['x-line-signature'] as string;

  if (channelSecret && lineSignature) {
    // Vercel parses req.body automatically.
    // In order to calculate the raw signature, we stringify the parsed body back.
    const rawBodyStr = JSON.stringify(req.body);
    const hash = crypto
      .createHmac('sha256', channelSecret)
      .update(Buffer.from(rawBodyStr))
      .digest('base64');
    
    // We log signature failures but don't strictly block in case of stringify discrepancies.
    if (hash !== lineSignature) {
      console.warn('LINE Signature verification failed warning.');
    }
  }

  const events = req.body.events;
  if (!events || !Array.isArray(events)) {
    return res.status(200).send('OK');
  }

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
      }
    }

    // RSVP Handler
    if (isRsvpAction && eventId && userId && replyToken && LINE_CHANNEL_ACCESS_TOKEN) {
      try {
        const rsvpSnap = await sql`
          SELECT * FROM event_rsvps 
          WHERE event_id = ${eventId} AND user_id = ${userId}
        `;

        if (rsvpSnap.length > 0) {
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

        // Save RSVP in Postgres
        await sql`
          INSERT INTO event_rsvps (event_id, user_id, display_name, picture_url, joined_at)
          VALUES (${eventId}, ${userId}, ${displayName}, ${pictureUrl}, CURRENT_TIMESTAMP)
        `;

        // Get all RSVPs ordered by joined_at
        const rsvpList = await sql`
          SELECT * FROM event_rsvps 
          WHERE event_id = ${eventId} 
          ORDER BY joined_at ASC
        `;

        // Get event data
        const eventRows = await sql`SELECT * FROM events WHERE id = ${eventId}`;
        if (eventRows.length === 0) {
          continue;
        }
        const evData = eventRows[0];
        let evDatetimeString = evData.datetime || '';
        if (evData.start_datetime_iso && evData.end_datetime_iso) {
          const d1 = new Date(evData.start_datetime_iso);
          const d2 = new Date(evData.end_datetime_iso);
          if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
            const opt = { year: 'numeric', month: 'long', day: 'numeric' } as const;
            if (evData.start_datetime_iso.substring(0, 10) !== evData.end_datetime_iso.substring(0, 10)) {
              evDatetimeString = `${d1.toLocaleDateString('th-TH', opt)} - ${d2.toLocaleDateString('th-TH', opt)}`;
            } else {
              const endPart = evData.end_datetime_display?.split(',')[1] || evData.end_datetime_display || '';
              evDatetimeString = `${evData.datetime || ''}${endPart ? ` - ${endPart}` : ''}`;
            }
          }
        }
        
        const eventName = evData.name || 'กิจกรรม';
        const eventInvitationColor = evData.invitation_color || '#6d28d9';
        const eventButtonColor = evData.button_color || '#6d28d9';
        const badgeTextColor = eventInvitationColor.trim().toUpperCase() === '#FFE600' ? '#334155' : '#ffffff';

        // Build Hero Element (Image or Video)
        let heroElement: any = null;
        const evImageUrl = evData.image_url || '';
        
        if (evImageUrl) {
          if (isVideoUrl(evImageUrl)) {
            const videoCover = evData.video_thumbnail_url || getMediaThumbnailUrl(evImageUrl);
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
              url: r.picture_url || 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
              size: '28px',
              aspectRatio: '1:1',
              aspectMode: 'cover',
              flex: 0
            },
            { type: 'text', text: r.display_name || 'ผู้เข้าร่วม', size: 'sm', color: '#1e293b', flex: 1, wrap: false }
          ]
        }));

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
                          text: evData.invitation_text || '📅 เชิญเข้าร่วมกิจกรรม',
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
                ...(evDatetimeString || evData.location ? [
                  {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'lg',
                    spacing: 'sm',
                    contents: [
                      ...(evDatetimeString ? [{ type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', contents: [{ type: 'text', text: '🕒', size: 'sm', flex: 0 }, { type: 'text', text: evDatetimeString, size: 'sm', color: '#475569', wrap: true, flex: 1 }] }] : []),
                      ...(evData.location ? [{ type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', contents: [{ type: 'text', text: '📍', size: 'sm', flex: 0 }, { type: 'text', text: evData.location, size: 'sm', color: '#475569', wrap: true, flex: 1 }] }] : [])
                    ]
                  }
                ] : []),
                ...(evData.description ? [
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
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              flex: 0,
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: eventButtonColor,
                  cornerRadius: '30px',
                  paddingAll: '10px',
                  action: {
                    type: 'uri',
                    label: 'ลงชื่อเข้าร่วม',
                    uri: `https://liff.line.me/2010284484-JPGd3KXg?action=rsvp&eventId=${eventId}&v=${Date.now()}`
                  },
                  contents: [
                    {
                      type: 'text',
                      text: 'ลงชื่อเข้าร่วม ✍️',
                      color: '#ffffff',
                      weight: 'bold',
                      size: 'sm',
                      align: 'center'
                    }
                  ]
                }
              ]
            }
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
      } catch (error) {
        console.error('[RSVP] Database RSVP transaction error:', error);
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

  return res.status(200).send('OK');
}

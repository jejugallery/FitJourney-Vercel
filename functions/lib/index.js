"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lineWebhook = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
admin.initializeApp();
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const isVideoUrl = (url) => {
    if (!url)
        return false;
    if (url.includes('/video/upload/'))
        return true;
    const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.avi', '.mkv', '.quicktime'];
    const urlLower = url.toLowerCase();
    return videoExtensions.some(ext => urlLower.endsWith(ext) ||
        urlLower.includes(ext + '?') ||
        urlLower.includes(ext + '&'));
};
const getMediaThumbnailUrl = (url) => {
    if (!url)
        return '';
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
const getMediaVideoLoopUrl = (url) => {
    if (!url)
        return '';
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
exports.lineWebhook = functions.region('asia-southeast1').https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
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
    const lineSignature = req.headers['x-line-signature'];
    if (channelSecret && lineSignature) {
        const rawBody = req.rawBody;
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
        const userId = (_a = event.source) === null || _a === void 0 ? void 0 : _a.userId;
        let eventId = '';
        let isRsvpAction = false;
        if (event.type === 'postback') {
            const data = ((_b = event.postback) === null || _b === void 0 ? void 0 : _b.data) || '';
            if (data.startsWith('action=rsvp')) {
                const params = new URLSearchParams(data);
                eventId = params.get('eventId') || '';
                isRsvpAction = true;
            }
        }
        else if (event.type === 'message' && ((_c = event.message) === null || _c === void 0 ? void 0 : _c.type) === 'text') {
            const text = event.message.text || '';
            if (text.startsWith('✍️ ลงชื่อเข้าร่วมกิจกรรม ')) {
                eventId = text.replace('✍️ ลงชื่อเข้าร่วมกิจกรรม ', '').trim();
                isRsvpAction = true;
            }
        }
        // RSVP Handler
        if (isRsvpAction && eventId && userId && replyToken && LINE_CHANNEL_ACCESS_TOKEN) {
            const rsvpRef = db.collection('events').doc(eventId).collection('rsvps').doc(userId);
            const rsvpSnap = await rsvpRef.get();
            if (rsvpSnap.exists) {
                // Already signed up — reply "คุณลงชื่อแล้วครับ ✅"
                try {
                    await axios_1.default.post('https://api.line.me/v2/bot/message/reply', { replyToken, messages: [{ type: 'text', text: 'คุณลงชื่อแล้วครับ ✅' }] }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } });
                }
                catch (err) {
                    console.error('[RSVP] Already signed up reply error:', ((_d = err.response) === null || _d === void 0 ? void 0 : _d.data) || err.message);
                }
                continue;
            }
            // Get LINE profile
            let displayName = 'ผู้เข้าร่วม';
            let pictureUrl = '';
            try {
                const profileRes = await axios_1.default.get(`https://api.line.me/v2/bot/profile/${userId}`, {
                    headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` }
                });
                displayName = profileRes.data.displayName || displayName;
                pictureUrl = profileRes.data.pictureUrl || '';
            }
            catch (e) {
                console.warn('[RSVP] profile fetch failed:', ((_e = e.response) === null || _e === void 0 ? void 0 : _e.data) || e.message);
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
            let evDatetimeString = (evData === null || evData === void 0 ? void 0 : evData.datetime) || '';
            if (evData) {
                if (evData.startDatetimeIso && evData.endDatetimeIso && evData.startDatetimeIso.substring(0, 10) !== evData.endDatetimeIso.substring(0, 10)) {
                    const d1 = new Date(evData.startDatetimeIso);
                    const d2 = new Date(evData.endDatetimeIso);
                    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                        const opt = { year: 'numeric', month: 'long', day: 'numeric' };
                        evDatetimeString = `${d1.toLocaleDateString('th-TH', opt)} - ${d2.toLocaleDateString('th-TH', opt)}`;
                    }
                }
                else {
                    const isSameDay = evData.startDatetimeIso && evData.endDatetimeIso &&
                        evData.startDatetimeIso.substring(0, 10) === evData.endDatetimeIso.substring(0, 10);
                    const endPart = isSameDay
                        ? ((_f = evData.endDatetimeDisplay) === null || _f === void 0 ? void 0 : _f.split(',')[1]) || evData.endDatetimeDisplay || ''
                        : evData.endDatetimeDisplay || '';
                    evDatetimeString = (evData.datetime || '') + (evData.endDatetimeDisplay ? ` - ${endPart}` : '');
                }
            }
            const eventName = (evData === null || evData === void 0 ? void 0 : evData.name) || 'กิจกรรม';
            const eventInvitationColor = (evData === null || evData === void 0 ? void 0 : evData.invitationColor) || '#6d28d9';
            const eventButtonColor = (evData === null || evData === void 0 ? void 0 : evData.buttonColor) || '#6d28d9';
            const badgeTextColor = eventInvitationColor.trim().toUpperCase() === '#FFE600' ? '#334155' : '#ffffff';
            // Build Hero Element (Image or Video)
            let heroElement = null;
            const evImageUrl = (evData === null || evData === void 0 ? void 0 : evData.imageUrl) || '';
            if (evImageUrl) {
                if (isVideoUrl(evImageUrl)) {
                    const videoCover = (evData === null || evData === void 0 ? void 0 : evData.videoThumbnailUrl) || getMediaThumbnailUrl(evImageUrl);
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
                }
                else {
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
            const rsvpContents = rsvpList.map((r, index) => ({
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
            // Build Flex Message (same structure as event invitation + RSVP list section)
            const rsvpFlexMessage = {
                type: 'flex',
                altText: `✍️ รายชื่อผู้ลงชื่อ: ${eventName}`,
                contents: Object.assign(Object.assign({ type: 'bubble' }, (heroElement ? { hero: heroElement } : {})), { body: {
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
                                                text: (evData === null || evData === void 0 ? void 0 : evData.invitationText) || '📅 เชิญเข้าร่วมกิจกรรม',
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
                            ...(evDatetimeString || (evData === null || evData === void 0 ? void 0 : evData.location) ? [
                                {
                                    type: 'box',
                                    layout: 'vertical',
                                    margin: 'lg',
                                    spacing: 'sm',
                                    contents: [
                                        ...(evDatetimeString ? [{ type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', contents: [{ type: 'text', text: '🕒', size: 'sm', flex: 0 }, { type: 'text', text: evDatetimeString, size: 'sm', color: '#475569', wrap: true, flex: 1 }] }] : []),
                                        ...((evData === null || evData === void 0 ? void 0 : evData.location) ? [{ type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', contents: [{ type: 'text', text: '📍', size: 'sm', flex: 0 }, { type: 'text', text: evData.location, size: 'sm', color: '#475569', wrap: true, flex: 1 }] }] : [])
                                    ]
                                }
                            ] : []),
                            ...((evData === null || evData === void 0 ? void 0 : evData.description) ? [
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
                    }, footer: {
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
                    } })
            };
            try {
                await axios_1.default.post('https://api.line.me/v2/bot/message/reply', { replyToken, messages: [rsvpFlexMessage] }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } });
            }
            catch (err) {
                console.error('[RSVP] Send reply Flex message error:', ((_g = err.response) === null || _g === void 0 ? void 0 : _g.data) || err.message);
            }
            continue;
        }
        // Other postback handlers
        if (event.type === 'postback') {
            const data = ((_h = event.postback) === null || _h === void 0 ? void 0 : _h.data) || '';
            let responseText = 'ขอบคุณที่กดปุ่มครับ 👍';
            if (data === 'action=check_status')
                responseText = 'กำลังตรวจสอบสถานะให้ครับ...';
            else if (data === 'action=get_help')
                responseText = 'นี่คือเมนูช่วยเหลือจาก FitJourney ครับ 🙏';
            if (replyToken && LINE_CHANNEL_ACCESS_TOKEN) {
                try {
                    await axios_1.default.post('https://api.line.me/v2/bot/message/reply', { replyToken, messages: [{ type: 'text', text: responseText }] }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } });
                }
                catch (err) {
                    console.error('Error replying postback to LINE:', ((_j = err.response) === null || _j === void 0 ? void 0 : _j.data) || err.message);
                }
            }
        }
    }
    res.status(200).send('OK');
});
//# sourceMappingURL=index.js.map
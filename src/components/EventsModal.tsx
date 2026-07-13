import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { eventsApi, eventInvitationsApi, eventRsvpsApi, billingsApi, billingPaymentsApi } from '../utils/api';
import { LIFF_URLS } from '../constants/liff';
import CreateEventModal from './CreateEventModal';
import EventDetailModal from './EventDetailModal';
import CreateBillingModal from './CreateBillingModal';
import EditBillingModal from './EditBillingModal';
import { isVideoUrl, getMediaFlexUrl, getMediaThumbnailUrl, getMediaVideoLoopUrl } from '../utils/mediaHelper';
import { getEventLinkLabel } from '../utils/eventLinkLabel';
import liff from '@line/liff';
import SuccessPopup from './SuccessPopup';

const getValidHttpsUrl = (url: any): string | null => {
  if (typeof url === 'string' && url.trim().startsWith('https://')) {
    return url.trim();
  }
  return null;
};

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

interface EventsModalProps {
  onClose: () => void;
  userId: string;
  role: string; // 'superadmin' | 'trainer' | 'trainee'
  initialMode?: 'events' | 'billing';
  billingOnly?: boolean;
  onSwitchAppointments?: () => void;
}

interface BillingItemProps {
  billing: any;
  role: string;
  creators: Record<string, any>;
  onNavigatePay: (billingId: string) => void;
  onUpdateStatus: (billingId: string, status: 'pending' | 'completed') => Promise<void>;
}

function BillingItem({ billing, role, creators, onNavigatePay, onUpdateStatus }: BillingItemProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [showPayments, setShowPayments] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [reopening, setReopening] = useState(false);

  const handleMarkComplete = async () => {
    setShowCompleteConfirm(false);
    setCompleting(true);
    try {
      await onUpdateStatus(billing.id, 'completed');
    } catch (err) {
      console.error("Error marking billing complete:", err);
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ ระบบคืนสถานะเดิมแล้ว");
    } finally {
      setCompleting(false);
    }
  };

  const handleReopen = async () => {
    setShowReopenConfirm(false);
    setReopening(true);
    try {
      await onUpdateStatus(billing.id, 'pending');
    } catch (err) {
      console.error("Error reopening billing:", err);
      alert("เกิดข้อผิดพลาดในการเปิดรายการอีกครั้ง ระบบคืนสถานะเดิมแล้ว");
    } finally {
      setReopening(false);
    }
  };

  const loadPayments = async () => {
    try {
      const pList = await billingPaymentsApi.list(billing.id);
      pList.sort((a: any, b: any) => {
        const tA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const tB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
        return tB - tA;
      });

      // Expand friends array into individual entries
      const expanded: any[] = [];
      pList.forEach((p: any, pIdx: number) => {
        const payerSlipUrl = p.slips && p.slips.length > 0 ? p.slips[0].slipUrl : (p.slipUrl || p.slip_url);
        const payerSlipId = p.slips && p.slips.length > 0 ? p.slips[0].slipId : (p.slipId || p.slip_id);

        expanded.push({
          ...p,
          slipUrl: payerSlipUrl,
          slipId: payerSlipId,
          uniqueKey: (p.userId || p.user_id) ? `${p.userId || p.user_id}-payer-${pIdx}` : `payer-${pIdx}`,
          isFriend: false
        });
        if (p.friends && Array.isArray(p.friends)) {
          p.friends.forEach((friendName: any, fIdx: number) => {
            const friendSlip = p.slips && Array.isArray(p.slips)
              ? p.slips.find((s: any) => s.friends && s.friends.includes(friendName))
              : null;
            const friendSlipUrl = friendSlip ? friendSlip.slipUrl : (p.slipUrl || p.slip_url);
            const friendSlipId = friendSlip ? friendSlip.slipId : (p.slipId || p.slip_id);

            expanded.push({
              ...p,
              slipUrl: friendSlipUrl,
              slipId: friendSlipId,
              uniqueKey: (p.userId || p.user_id) ? `${p.userId || p.user_id}-friend-${fIdx}-${pIdx}` : `friend-${fIdx}-${pIdx}`,
              displayName: `${friendName} (${p.displayName || p.display_name})`,
              pictureUrl: '', // Friend doesn't have profile pic
              isFriend: true
            });
          });
        }
      });

      setPayments(expanded);
    } catch (err) {
      console.error("payments error:", err);
    }
  };

  useEffect(() => {
    if (role !== 'superadmin' && role !== 'trainer') return;
    loadPayments();
    // Poll payments list every 10 seconds
    const interval = setInterval(loadPayments, 10000);
    return () => clearInterval(interval);
  }, [billing.id, role]);

  const handleShareToLine = async () => {
    try {
      if (!liff.isApiAvailable('shareTargetPicker')) {
        alert('อุปกรณ์นี้ไม่รองรับการแชร์ข้อความผ่าน LINE (shareTargetPicker)');
        return;
      }

      // Fetch latest payments
      const paymentsList = await billingPaymentsApi.list(billing.id);

      // Sort payments ascending by submitted_at (oldest first)
      paymentsList.sort((a: any, b: any) => {
        const timeA = a.submitted_at ? new Date(a.submitted_at).getTime() : Date.now();
        const timeB = b.submitted_at ? new Date(b.submitted_at).getTime() : Date.now();
        return timeA - timeB;
      });

      // Expand friends array
      const expandedList: any[] = [];
      for (const p of paymentsList) {
        expandedList.push({
          displayName: p.display_name,
          pictureUrl: p.picture_url,
          isFriend: false
        });
        if (p.friends && Array.isArray(p.friends)) {
          for (const friendName of p.friends) {
            expandedList.push({
              displayName: `${friendName} (${p.display_name})`,
              pictureUrl: '',
              isFriend: true
            });
          }
        }
      }

      const paidContents: any[] = [];
      if (expandedList.length > 0) {
        paidContents.push(
          { type: 'separator', margin: 'lg' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: `รายชื่อผู้ชำระเงินแล้ว (${expandedList.length} คน) 👤`,
                weight: 'bold',
                size: 'sm',
                color: '#1e293b'
              },
              ...expandedList.map((p, idx) => {
                const validUrl = getValidHttpsUrl(p.pictureUrl) || 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';
                return {
                  type: 'box',
                  layout: 'horizontal',
                  spacing: 'sm',
                  alignItems: 'center',
                  margin: idx === 0 ? 'sm' : 'xs',
                  contents: [
                    {
                      type: 'box',
                      layout: 'vertical',
                      width: '20px',
                      flex: 0,
                      contents: [
                        { type: 'text', text: `${idx + 1}.`, size: 'sm', color: '#94a3b8' }
                      ]
                    },
                    {
                      type: 'image',
                      url: validUrl,
                      size: '28px',
                      aspectRatio: '1:1',
                      aspectMode: 'cover',
                      flex: 0
                    },
                    {
                      type: 'text',
                      text: p.displayName || 'ผู้ชำระเงิน',
                      size: 'sm',
                      color: '#1e293b',
                      flex: 1,
                      wrap: false
                    }
                  ]
                };
              })
            ]
          }
        );
      }

      const invitationText = billing.invitationText || '💸 รายการเรียกเก็บเงิน';
      const invitationColor = billing.invitationColor || '#ef4444';
      const buttonColor = billing.buttonColor || '#6d28d9';
      const badgeTextColor = invitationColor.trim().toUpperCase() === '#FFE600' ? '#334155' : '#ffffff';

      const bubble: any = {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: 'md',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: invitationColor,
                  paddingAll: 'sm',
                  paddingStart: 'md',
                  paddingEnd: 'md',
                  cornerRadius: 'xxl',
                  contents: [
                    {
                      type: 'text',
                      text: invitationText,
                      size: 'xs',
                      color: badgeTextColor,
                      weight: 'bold',
                      align: 'center'
                    }
                  ]
                }
              ]
            },
            {
              type: 'text',
              text: billing.name || 'รายการเรียกเก็บเงินใหม่',
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
                  contents: [
                    { type: 'text', text: '💰', size: 'sm', flex: 0, gravity: 'center' },
                    { type: 'text', text: `จำนวนเงิน: ${billing.amount} บาท`, size: 'sm', color: '#475569', wrap: true, flex: 1, weight: 'bold', gravity: 'center' }
                  ]
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  spacing: 'sm',
                  contents: [
                    { type: 'text', text: '🏦', size: 'sm', flex: 0, gravity: 'center' },
                    { type: 'text', text: `ธนาคาร: ${billing.bankName}`, size: 'sm', color: '#475569', wrap: true, flex: 1, gravity: 'center' }
                  ]
                },
                ...(billing.accountName ? [
                  {
                    type: 'box',
                    layout: 'horizontal',
                    spacing: 'sm',
                    contents: [
                      { type: 'text', text: '👤', size: 'sm', flex: 0, gravity: 'center' },
                      { type: 'text', text: `ชื่อบัญชี: ${billing.accountName}`, size: 'sm', color: '#475569', wrap: true, flex: 1, gravity: 'center' }
                    ]
                  }
                ] : []),
                {
                  type: 'box',
                  layout: 'horizontal',
                  spacing: 'sm',
                  contents: [
                    { type: 'text', text: '💳', size: 'sm', flex: 0, gravity: 'center' },
                    { type: 'text', text: `เลขบัญชี: ${billing.accountNumber}`, size: 'sm', color: '#475569', wrap: true, flex: 1, gravity: 'center' }
                  ]
                }
              ]
            },
            ...(billing.description ? [
              { type: 'separator', margin: 'lg' },
              {
                type: 'box',
                layout: 'vertical',
                margin: 'lg',
                contents: [
                  { type: 'text', text: billing.description, size: 'sm', color: '#334155', wrap: true }
                ]
              }
            ] : []),
            ...paidContents
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: buttonColor,
              cornerRadius: 'xxl',
              paddingAll: 'md',
              action: {
                type: 'uri',
                uri: `${LIFF_URLS.DEFAULT}/payment/${billing.id}`
              },
              contents: [
                {
                  type: 'text',
                  text: 'ชำระเงิน / แนบหลักฐาน 💳',
                  color: (buttonColor?.trim().toUpperCase() === '#FFE600') ? '#334155' : '#ffffff',
                  weight: 'bold',
                  size: 'sm',
                  align: 'center'
                }
              ]
            }
          ]
        }
      };

      const flexMsg = {
        type: 'flex',
        altText: `💸 รายการเรียกเก็บเงิน: ${billing.name}`,
        contents: bubble
      };

      const res = await liff.shareTargetPicker([flexMsg as any]);
      if (res) {
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 2000);
      }
    } catch (error: any) {
      console.error('Error sharing billing request:', error);
      alert('เกิดข้อผิดพลาดในการแชร์: ' + (error?.message || error));
    }
  };

  const isTrainee = role === 'trainee';
  const isTrainerOrAdmin = role === 'superadmin' || role === 'trainer';

  return (
    <div 
      style={{
        border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px',
        background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
        display: 'flex', flexDirection: 'column', gap: '12px'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Status badge — above the name */}
        <div style={{ display: 'inline-flex' }}>
          <div style={{
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 'bold',
            alignSelf: 'flex-start',
            background: billing.status === 'completed' ? '#dcfce7' : '#fef9c3',
            color: billing.status === 'completed' ? '#15803d' : '#854d0e'
          }}>
            {billing.status === 'completed' ? '✅ เสร็จสิ้น' : '⏳ กำลังเรียกเก็บ'}
          </div>
        </div>
        {/* Name + creator row */}
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '4px' }}>
            {billing.name}
          </div>
          {billing.createdBy && creators[billing.createdBy] && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {creators[billing.createdBy].photo ? (
                <img src={creators[billing.createdBy].photo} alt="creator" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '9px' }}>👤</div>
              )}
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                โดย {creators[billing.createdBy].name}
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: '#475569' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>💰 จำนวนเงิน:</span>
          <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{billing.amount} บาท</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>🏦 ธนาคาร:</span>
          <span>{billing.bankName}</span>
        </div>
        {billing.accountName && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>👤 ชื่อบัญชี:</span>
            <span>{billing.accountName}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>💳 เลขบัญชี:</span>
          <span style={{ fontWeight: 'bold' }}>{billing.accountNumber}</span>
        </div>
      </div>

      {billing.description && (
        <div style={{ fontSize: '0.85rem', color: '#64748b', background: '#fff', border: '1px solid #f1f5f9', padding: '8px 12px', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
          {billing.description}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        {isTrainee && (
          <>
            <button
              onClick={() => onNavigatePay(billing.id)}
              style={{ flex: 1, padding: '8px 16px', background: billing.buttonColor || '#6d28d9', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              ชำระเงิน / แนบหลักฐาน 💳
            </button>
            {billing.status !== 'completed' && (
              <button
                onClick={handleShareToLine}
                style={{ flex: 0.7, padding: '8px 16px', background: '#06C755', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                💬 แชร์ไปยัง LINE
              </button>
            )}
          </>
        )}

        {isTrainerOrAdmin && billing.status !== 'completed' && (
          <>
            <button
              type="button"
              onClick={() => setShowCompleteConfirm(true)}
              style={{ flex: 0.6, padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              ✅ เสร็จสิ้น
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              style={{ flex: 0.5, padding: '8px 16px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              ✏️ แก้ไข
            </button>
            <button
              onClick={handleShareToLine}
              style={{ flex: 1, padding: '8px 16px', background: '#06C755', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              💬 แชร์ไปยัง LINE
            </button>
          </>
        )}

        {isTrainerOrAdmin && billing.status === 'completed' && (
          <button
            type="button"
            onClick={() => setShowReopenConfirm(true)}
            style={{ flex: 1, padding: '8px 16px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            🔄 ย้อนคืนสถานะ
          </button>
        )}
      </div>

      {isTrainerOrAdmin && (
        <div style={{ marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
          <button 
            type="button"
            onClick={() => setShowPayments(!showPayments)}
            style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
          >
            {showPayments ? '▲' : '▼'} รายการผู้ชำระเงิน ({payments.length} คน)
          </button>

          {showPayments && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              {payments.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                  ยังไม่มีผู้ชำระเงินในขณะนี้
                </div>
              ) : (
                payments.map((p, idx) => (
                  <div 
                    key={p.uniqueKey || idx} 
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', 
                      background: '#f8fafc', padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' 
                    }}
                  >
                    {p.pictureUrl ? (
                      <img src={p.pictureUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px' }}>👤</div>
                    )}
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1e293b' }}>{p.displayName || 'ผู้ใช้'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {p.submittedAt ? (p.submittedAt.toMillis ? new Date(p.submittedAt.toMillis()).toLocaleString('th-TH') : new Date(p.submittedAt).toLocaleString('th-TH')) : '-'}
                      </div>
                    </div>

                    {p.slipUrl && (
                      <img 
                        src={p.slipUrl} 
                        alt="Slip" 
                        onClick={() => setFullscreenImage(p.slipUrl)}
                        style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid #cbd5e1' }} 
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {fullscreenImage && (
        <div 
          onClick={() => setFullscreenImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}
        >
          <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#fff', fontSize: '2.5rem', cursor: 'pointer' }} onClick={() => setFullscreenImage(null)}>&times;</button>
          <img src={fullscreenImage} alt="Fullscreen Slip" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} />
        </div>
      )}

      <SuccessPopup show={showSuccessPopup} message="แชร์รายการเรียกเก็บเงินสำเร็จ" />

      {showEditModal && (
        <EditBillingModal billing={billing} onClose={() => setShowEditModal(false)} />
      )}

      {showCompleteConfirm && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          zIndex: 110000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '380px',
            padding: '28px 24px', textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>💸</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.35rem', fontWeight: 'bold' }}>
              การเรียกเก็บเงินเสร็จสิ้น?
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '0.95rem' }}>
              "{billing.name}"
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowCompleteConfirm(false)}
                disabled={completing}
                style={{
                  flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569',
                  border: 'none', borderRadius: '14px', fontWeight: 'bold', fontSize: '0.95rem',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleMarkComplete}
                disabled={completing}
                style={{
                  flex: 1, padding: '12px', background: '#22c55e', color: '#fff',
                  border: 'none', borderRadius: '14px', fontWeight: 'bold', fontSize: '0.95rem',
                  cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)'
                }}
              >
                {completing ? 'กำลังบันทึก...' : 'ตกลง'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {showReopenConfirm && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)',
          zIndex: 110000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
            borderRadius: '28px', width: '100%', maxWidth: '380px',
            padding: '32px 28px', textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(99,102,241,0.08)',
            boxSizing: 'border-box'
          }}>
            {/* Icon with gradient ring */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: '2.2rem',
              boxShadow: '0 8px 24px rgba(99,102,241,0.2)'
            }}>
              🔄
            </div>

            <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.3rem', fontWeight: '800', letterSpacing: '-0.3px' }}>
              ย้อนคืนสถานะ?
            </h3>
            <p style={{ margin: '0 0 6px 0', color: '#475569', fontSize: '0.9rem', lineHeight: '1.5' }}>
              รายการนี้จะกลับไปสู่สถานะ “กำลังเรียกเก็บ”
            </p>
            <p style={{ margin: '0 0 28px 0', color: '#1e293b', fontSize: '1rem', fontWeight: '700' }}>
              “{billing.name}”
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowReopenConfirm(false)}
                disabled={reopening}
                style={{
                  flex: 1, padding: '13px', background: '#f1f5f9', color: '#64748b',
                  border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.95rem',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleReopen}
                disabled={reopening}
                style={{
                  flex: 1, padding: '13px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#fff',
                  border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.95rem',
                  cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.4)'
                }}
              >
                {reopening ? 'กำลังเปิด...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function EventsModal({ onClose, userId, role, initialMode = 'events', billingOnly = false, onSwitchAppointments }: EventsModalProps) {
  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmInvId, setConfirmInvId] = useState<string | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [creators, setCreators] = useState<Record<string, any>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // New billing states
  const [mode] = useState<'events' | 'billing'>(initialMode);
  const [rawBillings, setRawBillings] = useState<any[]>([]);
  const pendingBillingStatusesRef = useRef(new Map<string, 'pending' | 'completed'>());
  const [billingStatus, setBillingStatus] = useState<'pending' | 'completed' | 'all'>('pending');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const activeBillings = useMemo(() => {
    return rawBillings.filter(b => {
      // 1. Creator filter (only show billings created by themselves)
      if (b.createdBy !== userId) return false;

      // 2. Status filter
      if (billingStatus === 'pending') {
        if (b.status === 'completed') return false;
      } else if (billingStatus === 'completed') {
        if (b.status !== 'completed') return false;
      }

      // 3. Date range filter
      if (startDate || endDate) {
        const billingDate = b.createdAt
          ? (b.createdAt.toDate 
              ? b.createdAt.toDate() 
              : (b.createdAt.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt)))
          : null;
        if (billingDate) {
          const year = billingDate.getFullYear();
          const month = String(billingDate.getMonth() + 1).padStart(2, '0');
          const day = String(billingDate.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          if (startDate && dateStr < startDate) return false;
          if (endDate && dateStr > endDate) return false;
        }
      }

      return true;
    });
  }, [rawBillings, userId, billingStatus, startDate, endDate]);

  const [showCreateBillingModal, setShowCreateBillingModal] = useState(false);
  const navigate = useNavigate();

  const events = useMemo(() => {
    // Filter out events older than 2 hours
    const now = new Date().getTime();
    let validEvents = rawEvents.filter(e => {
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

    // Sort by upcoming event date ascending (soonest first)
    validEvents.sort((a, b) => {
      const getTime = (e: any) => {
        if (e.startDatetimeIso) return new Date(e.startDatetimeIso).getTime();
        if (e.datetime) return new Date(e.datetime).getTime();
        return 0;
      };
      return getTime(a) - getTime(b);
    });

    if (role === 'superadmin') {
      return validEvents;
    } else {
      const myEventIds = new Set(invitations.map(inv => inv.eventId));
      return validEvents.filter(e => myEventIds.has(e.id) || e.createdBy === userId);
    }
  }, [rawEvents, role, invitations, userId]);

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
  }, [showCreateModal, selectedEventId, showCreateBillingModal]);

  const loadData = async () => {
    try {
      const [allBillings, allEvents, allInvs] = await Promise.all([
        billingsApi.list(),
        eventsApi.list(),
        eventInvitationsApi.listForUser(userId)
      ]);
      
      allBillings.sort((a: any, b: any) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
      setRawBillings(allBillings.map((billing: any) => {
        const optimisticStatus = pendingBillingStatusesRef.current.get(billing.id);
        if (!optimisticStatus) return billing;

        if (billing.status === optimisticStatus) {
          pendingBillingStatusesRef.current.delete(billing.id);
        }
        return { ...billing, status: optimisticStatus };
      }));
      setRawEvents(allEvents);
      setInvitations(allInvs);
    } catch (err) {
      console.error("Error loading data in EventsModal:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [userId, showCreateModal, selectedEventId, showCreateBillingModal]);

  const updateBillingStatus = async (billingId: string, status: 'pending' | 'completed') => {
    const previousStatus = rawBillings.find((billing: any) => billing.id === billingId)?.status;
    if (!previousStatus) return;

    pendingBillingStatusesRef.current.set(billingId, status);
    setRawBillings(current => current.map((billing: any) =>
      billing.id === billingId ? { ...billing, status } : billing
    ));

    try {
      await billingsApi.update(billingId, { status });
    } catch (error) {
      if (pendingBillingStatusesRef.current.get(billingId) === status) {
        pendingBillingStatusesRef.current.delete(billingId);
        setRawBillings(current => current.map((billing: any) =>
          billing.id === billingId ? { ...billing, status: previousStatus } : billing
        ));
      }
      throw error;
    }
  };

  const handleAddToCalendar = (ev: any) => {
    const url = `${window.location.origin}/download-ics?eventId=${ev.id || ''}&openExternalBrowser=1`;
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
    try {
      ev = await eventsApi.get(ev.id);
    } catch (err) {
      console.error('Error refreshing event before share:', err);
      alert('ไม่สามารถโหลดข้อมูลกิจกรรมล่าสุดได้ กรุณาลองใหม่อีกครั้ง');
      return;
    }

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

      const datetimeString = getEventDateText(ev);

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
      if (ev.linkType === 'rsvp') {
        try {
          const rsvpsList = await eventRsvpsApi.list(ev.id);
          rsvpList = rsvpsList.map((r: any) => ({
            userId: r.userId || r.user_id || '',
            displayName: r.displayName || r.display_name || 'ผู้เข้าร่วม',
            pictureUrl: r.pictureUrl || r.picture_url || '',
            joinedAt: r.joinedAt || r.joined_at || '',
            registeredBy: r.registeredBy || r.registered_by || ''
          }));
        } catch (rsvpErr) {
          console.error("Error fetching RSVPs for share:", rsvpErr);
        }
      }

      if (ev.linkType === 'rsvp' && rsvpList.length > 0) {
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
          buttonAction = {
            type: 'uri',
            label: buttonLabel,
            uri: `https://fitjourneythailand.web.app/download-ics?eventId=${ev.id || ''}&openExternalBrowser=1`
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

  // No early returns to preserve scroll position of the list view

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
            {billingOnly ? (
              <>
                💵 รายการเรียกเก็บเงิน
              </>
            ) : mode === 'events' ? (
              <>
                📅 กิจกรรม | <span style={{ cursor: 'pointer', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} onClick={onSwitchAppointments}>🤝</span>
              </>
            ) : (
              <>
                รายการเรียกเก็บเงิน
              </>
            )}
          </h2>

          {(role === 'superadmin' || role === 'trainer') && (
            mode === 'events' ? (
              <button 
                onClick={() => setShowCreateModal(true)}
                style={{ width: '100%', padding: '12px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginBottom: '20px', transition: 'all 0.2s' }}
              >
                + สร้างกิจกรรมใหม่
              </button>
            ) : (
              <button 
                onClick={() => setShowCreateBillingModal(true)}
                style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginBottom: '20px', transition: 'all 0.2s' }}
              >
                + สร้างรายการเรียกเก็บเงิน
              </button>
            )
          )}

          {(role === 'superadmin' || role === 'trainer') && (
            <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }} />
          )}

          {mode === 'events' ? (
            loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>กำลังโหลด...</div>
            ) : events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                ยังไม่มีกิจกรรมในขณะนี้
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {events.map(ev => {
                  const myInv = invitations.find(i => i.eventId === ev.id);
                  
                  return (
                    <div 
                      key={ev.id}
                      onClick={() => setSelectedEventId(ev.id)}
                      style={{
                        border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer',
                        transition: 'all 0.2s', background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
                    >
                      {ev.imageUrl && (
                        <div style={{ position: 'relative' }}>
                          {isVideoUrl(ev.imageUrl) ? (
                            <video src={ev.imageUrl} muted loop playsInline autoPlay style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <img src={ev.imageUrl} alt={ev.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                          )}
                          {getEventLinkLabel(ev) && (
                            <div style={{ position: 'absolute', right: '10px', bottom: '10px', padding: '6px 12px', borderRadius: '999px', background: '#6d28d9', color: '#fff', fontSize: '0.78rem', fontWeight: 'bold', boxShadow: '0 3px 10px rgba(76,29,149,0.35)' }}>
                              {getEventLinkLabel(ev)}
                            </div>
                          )}
                        </div>
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
                          🕒 {getEventDateText(ev)}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          📍 {ev.location}
                        </div>

                        {myInv && myInv.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setConfirmInvId(myInv.id); }}
                              style={{ flex: 1, padding: '10px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                              🎯 ยืนยันเข้าร่วม
                            </button>
                          </div>
                        )}
                        
                        {myInv && myInv.status === 'accepted' && (
                          <div style={{ padding: '6px 12px', background: '#dcfce7', color: '#166534', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-block', marginBottom: '8px' }}>
                            ✅ คุณเข้าร่วมกิจกรรมนี้
                          </div>
                        )}

                        {((myInv && myInv.status === 'accepted') || ev.createdBy === userId || role === 'superadmin') && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', width: '100%' }}>
                            {ev.startDatetimeIso && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAddToCalendar(ev); }}
                                style={{ flex: 1, padding: '7px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                              >
                                📅 เพิ่มลงปฏิทิน
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleShareToLine(ev); }}
                              style={{ flex: 1, padding: '7px 14px', background: '#06C755', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              💬 แชร์ไปยัง LINE
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>กำลังโหลด...</div>
            ) : (
              <>
                {rawBillings.length > 0 && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '16px',
                    marginBottom: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.02)'
                  }}>
                    {/* Status Pills */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>สถานะรายการ:</label>
                      <div style={{ display: 'flex', gap: '8px', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
                        <button
                          id="btn-filter-status-pending"
                          type="button"
                          onClick={() => setBillingStatus('pending')}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 'bold',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            backgroundColor: billingStatus === 'pending' ? '#fff' : 'transparent',
                            color: billingStatus === 'pending' ? '#1e293b' : '#64748b',
                            boxShadow: billingStatus === 'pending' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          กำลังเรียกเก็บ ⏳
                        </button>
                        <button
                          id="btn-filter-status-completed"
                          type="button"
                          onClick={() => setBillingStatus('completed')}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 'bold',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            backgroundColor: billingStatus === 'completed' ? '#fff' : 'transparent',
                            color: billingStatus === 'completed' ? '#1e293b' : '#64748b',
                            boxShadow: billingStatus === 'completed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          เสร็จสิ้นแล้ว ✅
                        </button>
                        <button
                          id="btn-filter-status-all"
                          type="button"
                          onClick={() => setBillingStatus('all')}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 'bold',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            backgroundColor: billingStatus === 'all' ? '#fff' : 'transparent',
                            color: billingStatus === 'all' ? '#1e293b' : '#64748b',
                            boxShadow: billingStatus === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          ทั้งหมด 📁
                        </button>
                      </div>
                    </div>

                    {/* Date Inputs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>ช่วงวันที่สร้าง:</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8', width: '30px', flexShrink: 0 }}>จาก</span>
                          <input
                            id="input-filter-start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              borderRadius: '10px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.85rem',
                              fontFamily: 'inherit',
                              color: '#1e293b',
                              background: '#fff',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8', width: '30px', flexShrink: 0 }}>ถึง</span>
                          <input
                            id="input-filter-end-date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              borderRadius: '10px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.85rem',
                              fontFamily: 'inherit',
                              color: '#1e293b',
                              background: '#fff',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                        {(startDate || endDate) && (
                          <button
                            id="btn-filter-clear-dates"
                            type="button"
                            onClick={() => { setStartDate(''); setEndDate(''); }}
                            style={{
                              alignSelf: 'flex-end',
                              background: '#fef2f2',
                              border: '1px solid #fee2e2',
                              borderRadius: '10px',
                              padding: '6px 14px',
                              color: '#dc2626',
                              fontWeight: 'bold',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#fef2f2'}
                          >
                            ล้างวันที่
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {rawBillings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                    ยังไม่มีรายการเรียกเก็บเงินในขณะนี้
                  </div>
                ) : activeBillings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                    ไม่พบรายการเรียกเก็บเงินที่ตรงกับตัวกรอง
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {activeBillings.map(b => (
                      <BillingItem 
                        key={b.id} 
                        billing={b} 
                        role={role} 
                        creators={creators}
                        onUpdateStatus={updateBillingStatus}
                        onNavigatePay={(id) => {
                          onClose();
                          navigate(`/payment/${id}`);
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )
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

      {showCreateModal && (
        <CreateEventModal onClose={() => setShowCreateModal(false)} userId={userId} />
      )}

      {showCreateBillingModal && (
        <CreateBillingModal onClose={() => setShowCreateBillingModal(false)} userId={userId} />
      )}

      {selectedEventId && (
        <EventDetailModal 
          eventId={selectedEventId} 
          initialEventData={events.find(e => e.id === selectedEventId)}
          onClose={() => setSelectedEventId(null)} 
          userId={userId} 
          role={role}
          invitations={invitations.filter(i => i.eventId === selectedEventId)}
        />
      )}
      <SuccessPopup show={showSuccessPopup} message="แชร์กิจกรรมเรียบร้อยแล้ว" />
    </>
  );
}

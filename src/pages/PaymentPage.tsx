import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { billingsApi, billingPaymentsApi, usedSlipsApi } from '../utils/api';
import { LIFF_URLS } from '../constants/liff';
import { uploadToImgBB } from '../utils/mediaHelper';
import { useLiff } from '../context/LiffContext';
import { fetchGeminiWithFallback } from '../utils/geminiHelper';
import liff from '@line/liff';
import SuccessPopup from '../components/SuccessPopup';

const getValidHttpsUrl = (url: any): string | null => {
  if (typeof url === 'string' && url.trim().startsWith('https://')) {
    return url.trim();
  }
  return null;
};

export default function PaymentPage() {
  const { billingId } = useParams<{ billingId: string }>();
  const navigate = useNavigate();
  const { profile, loading: liffLoading, error: liffError } = useLiff();
  
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [existingPayment, setExistingPayment] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showOverpaymentPopup, setShowOverpaymentPopup] = useState(false);
  const [showFriendsInputForm, setShowFriendsInputForm] = useState(false);
  const [friendNames, setFriendNames] = useState<string[]>([]);
  const [pendingPaymentData, setPendingPaymentData] = useState<any>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [payForFriendsMode, setPayForFriendsMode] = useState(false);
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [duplicateSlipId, setDuplicateSlipId] = useState<string>('');

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      try {
        const tempInput = document.createElement('input');
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        alert('ไม่สามารถคัดลอกอัตโนมัติได้: ' + text);
      }
    });
  };

  useEffect(() => {
    const fetchBilling = async () => {
      if (!billingId) return;
      try {
        const data = await billingsApi.get(billingId);
        if (data) {
          if (data.status === 'completed') {
            setError('รายการเรียกเก็บเงินนี้เสร็จสิ้นแล้ว ไม่สามารถชำระเงินหรือส่งหลักฐานได้อีก');
          } else {
            setBilling({
              id: data.id,
              name: data.name,
              amount: data.amount,
              bankName: data.bankName || data.bank_name,
              accountName: data.accountName || data.account_name,
              accountNumber: data.accountNumber || data.account_number,
              description: data.description,
              invitationText: data.invitationText || data.invitation_text,
              invitationColor: data.invitationColor || data.invitation_color,
              buttonColor: data.buttonColor || data.button_color,
              status: data.status,
              createdBy: data.createdBy || data.created_by,
              createdAt: data.createdAt || data.created_at
            });
          }
        } else {
          setError('ไม่พบข้อมูลรายการเรียกเก็บเงินนี้ในระบบ');
        }
      } catch (err: any) {
        console.error(err);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchBilling();
  }, [billingId]);

  useEffect(() => {
    const fetchExistingPayment = async () => {
      if (!billingId || !profile?.userId) return;
      try {
        const data = await billingPaymentsApi.get(billingId, profile.userId);
        if (data) {
          const mappedPayment = {
            userId: data.userId || data.user_id,
            slipUrl: data.slipUrl || data.slip_url,
            amount: data.amount,
            transDate: data.transDate || data.trans_date,
            transTime: data.transTime || data.trans_time,
            status: data.status,
            slipData: data.slipData || data.slip_data,
            verifiedAt: data.verifiedAt || data.verified_at,
            errorMessage: data.errorMessage || data.error_message,
            senderName: data.senderName || data.sender_name,
            receiverName: data.receiverName || data.receiver_name,
            submittedAt: data.submittedAt || data.submitted_at
          };
          setExistingPayment(mappedPayment);
          if (mappedPayment.slipUrl) {
            setImagePreview(mappedPayment.slipUrl);
          }
        }
      } catch (err) {
        console.error("Error fetching existing payment:", err);
      }
    };
    fetchExistingPayment();
  }, [billingId, profile?.userId]);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!profile?.userId) return;
      try {
        const q = query(collection(db, 'trainers'), where('trainerId', '==', profile.userId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          if (data.status === 'superadmin') {
            setIsSuperadmin(true);
          }
        }
      } catch (err) {
        console.error("Error fetching user role:", err);
      }
    };
    fetchUserRole();
  }, [profile?.userId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const MAX_SIZE = 960;
          let width = img.width;
          let height = img.height;

          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            } else {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setImagePreview(dataUrl);
            
            canvas.toBlob((blob) => {
              if (blob) {
                const resizedFile = new File([blob], file.name, { type: 'image/jpeg' });
                setImageFile(resizedFile);
              }
            }, 'image/jpeg', 0.85);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const completePayment = async (slipUrl: string, friendsToSave: string[], slipId: string | null = null) => {
    if (!profile || !billingId) return;
    setUploading(true);
    setUploadingStatus('กำลังบันทึกข้อมูลหลักฐาน...');
    try {
      const currentSlips = existingPayment?.slips || (existingPayment?.slipUrl ? [{
        slipUrl: existingPayment.slipUrl,
        friends: existingPayment.friends || [],
        slipId: existingPayment.slipId || null,
        submittedAt: existingPayment.submittedAt || new Date().toISOString()
      }] : []);

      const newSlipObj = {
        slipUrl,
        friends: friendsToSave,
        slipId,
        submittedAt: new Date().toISOString()
      };

      const updatedSlips = [...currentSlips, newSlipObj];

      const accumulatedFriends = [
        ...(existingPayment?.friends || []),
        ...friendsToSave
      ];

      const dataToSave: any = {
        billingId,
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl || '',
        slipUrl,
        slipId,
        friends: accumulatedFriends,
        slips: updatedSlips
      };

      await billingPaymentsApi.submit(dataToSave);
      
      // Save to global used_slips collection to prevent cross-billing usage
      if (slipId) {
        const normalizedInputId = normalizeSlipId(slipId);
        await usedSlipsApi.register({
          slipId: normalizedInputId,
          billingId,
          userId: profile.userId,
          slipUrl
        });
      }
      
      // Reset modes and temp values
      setExistingPayment({
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl || '',
        slipUrl,
        slipId,
        submittedAt: new Date().toISOString(),
        friends: accumulatedFriends,
        slips: updatedSlips
      });
      setImagePreview(slipUrl);
      setImageFile(null);
      setPayForFriendsMode(false);

      // Send Flex Message back to chat thread
      try {
        const paymentsListRaw = await billingPaymentsApi.list(billingId);
        let paymentsList = paymentsListRaw.map((p: any) => ({
          userId: p.user_id,
          displayName: p.display_name,
          pictureUrl: p.picture_url,
          slipUrl: p.slip_url,
          submittedAt: p.submitted_at,
          friends: p.friends || [],
          slips: p.slips || []
        }));

        // Force override current user's latest data to ensure immediate consistency
        paymentsList = paymentsList.filter(p => p.userId !== profile.userId);
        paymentsList.push({
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl || '',
          slipUrl,
          submittedAt: null,
          friends: accumulatedFriends,
          slips: updatedSlips
        });

        // Sort payments ascending by submittedAt (oldest first)
        paymentsList.sort((a, b) => {
          const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : Date.now();
          const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : Date.now();
          return timeA - timeB;
        });

        // Expand payments to include friends
        const expandedList: any[] = [];
        for (const p of paymentsList) {
          expandedList.push({
            displayName: p.displayName,
            pictureUrl: p.pictureUrl,
            isFriend: false
          });
          if (p.friends && Array.isArray(p.friends)) {
            for (const friendName of p.friends) {
              expandedList.push({
                displayName: `${friendName} (${p.displayName})`,
                pictureUrl: '',
                isFriend: true
              });
            }
          }
        }

        // Formulate paid contents box
        const paidContents: any[] = [
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
        ];

        if (liff.isInClient()) {
          const invitationText = billing.invitationText || 'อย่าลืมโอนกันนะ 💸';
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
                  text: billing.name || 'รายการเรียกเก็บเงิน',
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
            altText: `💸 อัปเดตรายการเรียกเก็บเงิน: ${billing.name}`,
            contents: bubble
          };

          try {
            await liff.sendMessages([flexMsg as any]);
          } catch (sendErr: any) {
            console.error("Failed to send LIFF Flex message:", sendErr);
            alert("ไม่สามารถส่งข้อความกลับห้องแชทได้: " + (sendErr.message || JSON.stringify(sendErr)));
          }
        }
      } catch (sendErr: any) {
        console.error("Failed to compile or send LIFF Flex message:", sendErr);
        alert("เกิดข้อผิดพลาดในการประมวลผล Flex Message: " + (sendErr.message || JSON.stringify(sendErr)));
      }

      setShowSuccess(true);
      if (liff.isInClient()) {
        setTimeout(() => {
          liff.closeWindow();
        }, 2000);
      } else {
        setTimeout(() => {
          setShowSuccess(false);
          navigate('/');
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลหลักฐาน: ' + err.message);
    } finally {
      setUploading(false);
      setUploadingStatus('');
    }
  };

  const normalizeSlipId = (id: string | null | undefined): string => {
    if (!id) return '';
    return id
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/O/g, '0')
      .replace(/[IL]/g, '1');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile || !billing || !profile || !billingId) {
      alert('ข้อมูลไม่ครบถ้วน กรุณาอัปโหลดรูปภาพสลิป');
      return;
    }

    setUploading(true);
    setUploadingStatus('กำลังตรวจสอบสลิป...');
    try {

      const [meta, base64Data] = imagePreview.split(',');
      const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';

      const expectedName = billing?.accountName || '';
      const prompt = `คุณเป็น AI ผู้ช่วยตรวจสอบสลิปการโอนเงินของธนาคารไทย 
หน้าที่ของคุณคืออ่านข้อมูลสลิปนี้และดึงข้อมูลต่อไปนี้ออกมา:
1. "จำนวนเงินที่โอนสำเร็จ" (transferred amount):
   - ค้นหายอดเงินโอนสำเร็จ (เช่น "จำนวนเงิน", "ยอดเงิน", "ยอดเงินโอน", "Amount", "Total", "Grand Total", "ยอดโอน")
   - ดึงเฉพาะจำนวนเงินที่โอนออกไปจริงๆ เป็นหน่วยบาท (เช่น 100.00, 2500, 450.50) ห้ามสับสนกับเลขวันที่ เวลา เลขที่บัญชี หรือค่าธรรมเนียม (Fee) 0.00 บาท
2. "ชื่อผู้รับโอน" (recipient name) จากสลิปโอนเงิน เพื่อตรวจสอบความถูกต้อง
   ${expectedName ? `- ตรวจสอบว่าชื่อผู้รับโอนบนสลิป ตรงกับชื่อบัญชีผู้รับโอนคือ "${expectedName}" หรือไม่ (กรุณาพิจารณาชื่อภาษาไทย/ภาษาอังกฤษ ตัวเขียนย่อ/เต็ม หรือกรณีสะกดใกล้เคียงกันแบบสมเหตุสมผล)` : ''}
3. "รหัสธุรกรรม / รหัสอ้างอิง" (transaction/slip ID):
   - ค้นหารหัสทำรายการ รหัสธุรกรรม เลขที่รายการ หรือรหัสอ้างอิงของสลิป (เช่น "เลขที่รายการ", "รหัสธุรกรรม", "Ref. No.", "Transaction ID", "รหัสอ้างอิง") มักเป็นตัวเลขยาวๆ หรือผสมตัวอักษม

ผลลัพธ์ต้องส่งกลับเป็นรูปแบบ JSON เท่านั้น ห้ามมีข้อความเกริ่นนำหรือคำอธิบายใดๆ นอกเหนือจาก JSON:
{
  "amount": 0.0, // ใส่ตัวเลขทศนิยมหรือจำนวนเต็มของยอดเงินโอน หรือใส่ null หากหาไม่พบ
  "recipientName": "...", // ใส่ชื่อผู้รับโอนที่อ่านได้จากสลิป (ถ้าพบ) หรือใส่ null หากหาไม่พบ
  "isRecipientMatch": true, // ${expectedName ? `คืนค่า true หากชื่อผู้รับโอนในสลิปตรงหรือสอดคล้องกับ "&quot;${expectedName}&quot;" (ยอมรับการสะกดใกล้เคียงและแปลไทย/อังกฤษ) และคืนค่า false หากชื่อไม่ตรงกัน` : 'คืนค่า true เป็นค่าเริ่มต้น'}
  "slipId": "..." // ใส่รหัสธุรกรรม/เลขที่รายการที่ดึงได้จากสลิป (ถ้าพบ) หรือใส่ null หากหาไม่พบ
}`;

      let rawText = '';
      let modelUsed = '';

      const res = await fetchGeminiWithFallback(['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemma-4-26b-a4b-it'], [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ]);
      rawText = res.rawText;
      modelUsed = res.modelUsed;

      if (isSuperadmin) {
        alert(`ระบบตรวจสอบสลิปสำเร็จโดยใช้โมเดล: ${modelUsed}`);
      }
      console.log('Gemini client-side raw response:', rawText);
      
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      
      const slipAmount = parsed.amount;
      const recipientName = parsed.recipientName;
      const isRecipientMatch = parsed.isRecipientMatch;
      const slipId = parsed.slipId || null;
      const billingAmount = Number(billing.amount);
      
      if (slipAmount === null || slipAmount === undefined) {
        alert('ไม่สามารถอ่านจำนวนเงินจากรูปภาพสลิปนี้ได้ หรือรูปภาพไม่ใช่สลิปโอนเงินที่ถูกต้อง กรุณาอัปโหลดรูปภาพใหม่อีกครั้ง');
        setUploading(false);
        setUploadingStatus('');
        return;
      }

      if (expectedName && isRecipientMatch === false) {
        alert(`ชื่อผู้รับโอนในสลิปไม่ตรงกับชื่อบัญชีของระบบ\n\nชื่อบัญชีที่ระบบกำหนด: ${expectedName}\nชื่อผู้รับโอนบนสลิป: ${recipientName || 'ไม่พบชื่อผู้รับโอนบนสลิป'}\n\nกรุณาใช้สลิปโอนเงินที่ถูกต้อง`);
        setUploading(false);
        setUploadingStatus('');
        return;
      }

      // Check for duplicate slipId globally and locally in this billing
      if (slipId) {
        setUploadingStatus('กำลังตรวจสอบความซ้ำซ้อนของสลิป...');
        const normalizedInputId = normalizeSlipId(slipId);
        
        // Global duplicate check via usedSlips REST API
        const checkResult = await usedSlipsApi.check(normalizedInputId);
        let isDuplicate = checkResult.exists;

        if (isDuplicate) {
          setDuplicateSlipId(slipId);
          setShowDuplicatePopup(true);
          setUploading(false);
          setUploadingStatus('');
          return;
        }
      }

      const multiplier = Math.round(Number(slipAmount) / billingAmount);
      const isValidAmount = Math.abs(Number(slipAmount) - billingAmount * multiplier) < 0.05;

      if (!isValidAmount || multiplier < 1) {
        alert(`ยอดเงินในสลิปไม่ตรงกับยอดที่เรียกเก็บเงิน (หรือทวีคูณ)\n\nยอดเงินในสลิป: ${slipAmount} บาท\nยอดที่ต้องชำระ: ${billingAmount} บาท\n\nกรุณาแนบหลักฐานสลิปโอนเงินที่ถูกต้อง`);
        setUploading(false);
        setUploadingStatus('');
        return;
      }

      // All verification checks passed. Now upload image to ImgBB.
      setUploadingStatus('กำลังบันทึกรูปภาพสลิป...');
      const slipUrl = await uploadToImgBB(imageFile);

      if (payForFriendsMode) {
        setPendingPaymentData({
          slipUrl,
          slipAmount,
          recipientName,
          isRecipientMatch,
          billingAmount,
          multiplier,
          slipId
        });
        setFriendNames(Array(multiplier).fill(''));
        setUploading(false);
        setUploadingStatus('');
        setShowFriendsInputForm(true);
        return;
      }

      // Normal flow (first payment)
      const isMultiple = multiplier >= 2;
      if (isMultiple) {
        setPendingPaymentData({
          slipUrl,
          slipAmount,
          recipientName,
          isRecipientMatch,
          billingAmount,
          multiplier,
          slipId
        });
        setFriendNames(Array(multiplier - 1).fill(''));
        setUploading(false);
        setUploadingStatus('');
        setShowOverpaymentPopup(true);
        return;
      }

      // 1x in normal flow (first payment for self)
      await completePayment(slipUrl, [], slipId);
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการอัปโหลดหลักฐาน: ' + err.message);
      setUploading(false);
    }
  };

  if (liffLoading || loading) {
    return (
      <div className="form-container" style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2 style={{ color: 'var(--text-main)' }}>กำลังโหลด...</h2>
        <p className="subtitle" style={{ color: 'var(--text-muted)' }}>กรุณารอสักครู่ ระบบกำลังตรวจสอบข้อมูล</p>
      </div>
    );
  }

  if (liffError || error) {
    const handleClose = () => {
      if (liff.isInClient()) {
        liff.closeWindow();
      } else {
        window.close();
        setTimeout(() => {
          navigate('/');
        }, 100);
      }
    };

    return (
      <div style={{ padding: '1rem', minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="form-container" style={{ textAlign: 'center', width: '100%', maxWidth: '480px', background: '#fff', padding: '2rem', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>
          <h2 style={{ color: '#ef4444', fontSize: '1.5rem', marginBottom: '1rem' }}>ไม่สามารถชำระเงินได้แล้ว</h2>
          <p className="subtitle" style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>{liffError || error}</p>
          <button className="btn-secondary" onClick={handleClose} style={{ width: '100%', padding: '12px', borderRadius: '12px', fontWeight: 'bold' }}>
            ปิด
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="form-container animate-fade-in-up" style={{ margin: '20px auto', width: '100%', maxWidth: '480px', background: '#fff', padding: '2rem', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>
        
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.6rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          💵 แนบหลักฐานชำระเงิน
        </h2>

        {billing && (
          <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
              {billing.name}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.95rem', color: '#475569' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '500' }}>💰 ยอดชำระเงิน:</span>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.1rem' }}>{billing.amount} บาท</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '500' }}>🏦 ธนาคาร:</span>
                <span style={{ color: '#1e293b', fontWeight: '500' }}>{billing.bankName}</span>
              </div>
              {billing.accountName && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '500' }}>👤 ชื่อบัญชี:</span>
                  <span style={{ color: '#1e293b', fontWeight: '500' }}>{billing.accountName}</span>
                </div>
              )}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '500' }}>💳 เลขบัญชี:</span>
                  <span style={{ color: '#1e293b', fontWeight: 'bold', letterSpacing: '0.5px' }}>{billing.accountNumber}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleCopy(billing.accountNumber)}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '0.75rem',
                      color: '#475569',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      transition: 'all 0.15s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                  >
                    {copied ? '✓ คัดลอกเลขบัญชีแล้ว' : '📋 คัดลอกเลขบัญชี'}
                  </button>
                </div>
              </div>
              {billing.description && (
                <div style={{ marginTop: '8px', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '0.9rem', color: '#64748b', whiteSpace: 'pre-wrap' }}>
                  {billing.description}
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {existingPayment && !imageFile && (
            <div style={{ 
              background: '#dcfce7', 
              border: '1px solid #bbf7d0', 
              padding: '14px', 
              borderRadius: '16px', 
              color: '#15803d', 
              fontWeight: 'bold', 
              textAlign: 'center', 
              marginBottom: '5px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              fontSize: '1.05rem',
              boxShadow: '0 4px 10px rgba(22, 101, 52, 0.05)'
            }}>
              <div>✅ คุณจ่ายแล้ว</div>
              {existingPayment.friends && Array.isArray(existingPayment.friends) && existingPayment.friends.length > 0 && (
                <div style={{ fontSize: '0.85rem', color: '#166534', marginTop: '2px' }}>
                  (จ่ายเผื่อ: {existingPayment.friends.join(', ')})
                </div>
              )}
            </div>
          )}

          {existingPayment && !imageFile && !payForFriendsMode && (
            <button
              type="button"
              onClick={() => {
                setPayForFriendsMode(true);
                setImageFile(null);
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: '#fff7ed',
                color: '#ea580c',
                border: '1px dashed #fdba74',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                marginTop: '-10px'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#ffedd5'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#fff7ed'; }}
            >
              👥 โอนแทนเพื่อน
            </button>
          )}

          {payForFriendsMode && !imageFile && (
            <button
              type="button"
              onClick={() => {
                setPayForFriendsMode(false);
                setImageFile(null);
                if (existingPayment?.slipUrl) {
                  setImagePreview(existingPayment.slipUrl);
                } else {
                  setImagePreview('');
                }
              }}
              style={{
                width: '100%',
                padding: '10px',
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                marginTop: '-10px'
              }}
            >
              ✕ ยกเลิกการโอนเผื่อเพื่อน
            </button>
          )}

          <div>
            {!payForFriendsMode && (
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>
                {existingPayment ? 'หลักฐานการโอน' : 'อัปโหลดสลิปการโอนเงิน *'}
              </label>
            )}

            {existingPayment && !payForFriendsMode && !imageFile && (
              <div>
                {existingPayment.slips && existingPayment.slips.length > 1 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', padding: '8px 0' }}>
                    {existingPayment.slips.map((s: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <img 
                          src={s.slipUrl} 
                          alt={`Slip ${idx + 1}`} 
                          onClick={() => setActiveLightboxImg(s.slipUrl)}
                          style={{ 
                            width: '100px', 
                            height: '100px', 
                            objectFit: 'contain', 
                            borderRadius: '12px', 
                            border: '1px solid #cbd5e1', 
                            background: '#fff',
                            padding: '4px',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                            cursor: 'zoom-in'
                          }} 
                        />
                        <span style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.friends && s.friends.length > 0 ? `จ่ายเผื่อ: ${s.friends.join(', ')}` : 'จ่ายให้ตนเอง'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div 
                    style={{ 
                      border: '1px solid #cbd5e1', 
                      borderRadius: '16px', 
                      height: '240px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      overflow: 'hidden',
                      background: '#f8fafc',
                      position: 'relative'
                    }}
                  >
                    <img 
                      src={imagePreview} 
                      alt="Slip Preview" 
                      onClick={() => setActiveLightboxImg(imagePreview)}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'zoom-in' }} 
                    />
                  </div>
                )}
              </div>
            )}

            {existingPayment && payForFriendsMode && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>
                  อัปโหลดสลิปเพิ่ม *
                </label>
                <div 
                  style={{ 
                    border: '2px dashed #cbd5e1', 
                    borderRadius: '16px', 
                    height: '200px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: imageFile ? 'zoom-in' : 'pointer',
                    overflow: 'hidden',
                    background: '#f8fafc',
                    position: 'relative',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { if (!imageFile) e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onMouseOut={(e) => { if (!imageFile) e.currentTarget.style.borderColor = '#cbd5e1'; }}
                >
                  {imageFile ? (
                    <div style={{ width: '100%', height: '100%' }} onClick={() => setActiveLightboxImg(imagePreview)}>
                      <img src={imagePreview} alt="New Slip Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ color: '#64748b', textAlign: 'center', padding: '1rem', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>➕</div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#334155' }}>แตะที่นี่เพื่อแนบสลิปเพิ่ม</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>เพื่อชำระเงินโอนแทนเพื่อน</div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageChange}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }}
                        required
                      />
                    </div>
                  )}
                </div>
                {imageFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview('');
                    }}
                    style={{
                      marginTop: '12px',
                      width: '100%',
                      padding: '10px',
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    ✕ ยกเลิกการแนบสลิปเพิ่ม
                  </button>
                )}

                {/* Display all existing slips under the upload box */}
                {(() => {
                  const slips = existingPayment.slips || (existingPayment.slipUrl ? [{
                    slipUrl: existingPayment.slipUrl,
                    friends: existingPayment.friends || []
                  }] : []);

                  if (slips.length === 0) return null;

                  return (
                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>หลักฐานการโอน</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
                        {slips.map((s: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            <img 
                              src={s.slipUrl} 
                              alt={`Slip ${idx + 1}`} 
                              onClick={() => setActiveLightboxImg(s.slipUrl)}
                              style={{ 
                                width: '100px', 
                                height: '100px', 
                                objectFit: 'contain', 
                                borderRadius: '12px', 
                                border: '1px solid #cbd5e1', 
                                background: '#fff',
                                padding: '4px',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                cursor: 'zoom-in'
                              }} 
                            />
                            <span style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.friends && s.friends.length > 0 ? `จ่ายเผื่อ: ${s.friends.join(', ')}` : 'จ่ายให้ตนเอง'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {(!existingPayment || (existingPayment && imageFile && !payForFriendsMode)) && (
              <div>
                <div 
                  style={{ 
                    border: '2px dashed #cbd5e1', 
                    borderRadius: '16px', 
                    height: '240px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: imagePreview ? 'zoom-in' : 'pointer',
                    overflow: 'hidden',
                    background: '#f8fafc',
                    position: 'relative',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { if (!imagePreview) e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onMouseOut={(e) => { if (!imagePreview) e.currentTarget.style.borderColor = '#cbd5e1'; }}
                >
                  {imagePreview ? (
                    <div style={{ width: '100%', height: '100%' }} onClick={() => setActiveLightboxImg(imagePreview)}>
                      <img src={imagePreview} alt="Slip Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ color: '#64748b', textAlign: 'center', padding: '1rem', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📸</div>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#334155' }}>แตะที่นี่เพื่อเลือกรูปภาพสลิป</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>รองรับไฟล์รูปภาพ PNG, JPG, JPEG</div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageChange}
                        ref={fileInputRef}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }}
                        required={!existingPayment}
                      />
                    </div>
                  )}
                </div>
                {existingPayment && imageFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(existingPayment.slipUrl);
                    }}
                    style={{
                      marginTop: '12px',
                      width: '100%',
                      padding: '10px',
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    ✕ ยกเลิกการแก้ไข
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '6px', 
            color: 'var(--text-muted)', 
            fontSize: '0.85rem' 
          }}>
            <span>ส่งหลักฐานในชื่อ LINE:</span>
            {profile?.pictureUrl && (
              <img 
                src={profile.pictureUrl} 
                alt="profile" 
                style={{ 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '50%', 
                  objectFit: 'cover' 
                }} 
              />
            )}
            <strong>{profile?.displayName}</strong>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={uploading || !imageFile || showSuccess}
            style={{ 
              width: '100%', 
              padding: '14px', 
              fontSize: '1.05rem', 
              borderRadius: '14px',
              boxShadow: (!imageFile || uploading) ? 'none' : '0 4px 15px rgba(255, 65, 108, 0.2)'
            }}
          >
            {uploading ? (uploadingStatus || 'กำลังส่งหลักฐาน...') : 'ยืนยันการส่งหลักฐานชำระเงิน'}
          </button>
        </form>
      </div>

      <SuccessPopup show={showSuccess} message="ส่งหลักฐานชำระเงินสำเร็จ!" />

      {showOverpaymentPopup && pendingPaymentData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="success-popup-anim" style={{ background: '#fff', padding: '2rem', borderRadius: '24px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', boxSizing: 'border-box' }}>
            <div style={{ alignSelf: 'center', width: '60px', height: '60px', borderRadius: '50%', background: '#eff6ff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2rem' }}>
              💸
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.25rem', fontWeight: 'bold' }}>ตรวจพบยอดโอนเกินจำนวน</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem', lineHeight: '1.5' }}>
                ดูเหมือนคุณจะโอนเกินจำนวน<br />โอนเผื่อใครหรือเปล่า ?
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowOverpaymentPopup(false);
                  setShowFriendsInputForm(true);
                }}
                style={{
                  flex: '1 1 0%',
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  border: '1px solid transparent',
                  background: 'var(--gradient)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                  boxSizing: 'border-box'
                }}
              >
                ใช่
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOverpaymentPopup(false);
                  // Trigger standard amount mismatch warning
                  alert(`ยอดเงินในสลิปไม่ตรงกับยอดที่เรียกเก็บเงิน\n\nยอดเงินในสลิป: ${pendingPaymentData.slipAmount} บาท\nยอดที่ต้องชำระ: ${pendingPaymentData.billingAmount} บาท\n\nกรุณาแนบหลักฐานสลิปโอนเงินที่ถูกต้อง`);
                  setPendingPaymentData(null);
                }}
                style={{
                  flex: '1 1 0%',
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                  boxSizing: 'border-box'
                }}
              >
                ไม่ใช่
              </button>
            </div>
          </div>
        </div>
      )}

            {showFriendsInputForm && pendingPaymentData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="success-popup-anim" style={{ background: '#fff', padding: '2rem', borderRadius: '24px', width: '90%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' }}>
            <div>
              <h3 style={{ margin: '0 0 6px 0', color: '#1e293b', fontSize: '1.25rem', fontWeight: 'bold', textAlign: 'center' }}>กรอกชื่อเพื่อนที่ชำระเงินเผื่อ</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', textAlign: 'center' }}>
                คุณชำระเงินเผื่อเพื่อนเพิ่มเติม {payForFriendsMode ? pendingPaymentData.multiplier : pendingPaymentData.multiplier - 1} คน กรุณาระบุชื่อเพื่อนให้ครบถ้วน
              </p>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (friendNames.some(name => !name.trim())) {
                alert('กรุณากรอกชื่อเพื่อนให้ครบทุกช่อง');
                return;
              }
              setShowFriendsInputForm(false);
              completePayment(pendingPaymentData.slipUrl, friendNames, pendingPaymentData.slipId);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ maxHeight: '280px', overflowY: 'auto', paddingLeft: '4px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px' }}>
                {friendNames.map((name, i) => (
                  <div key={i} style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#475569', fontWeight: 'bold', marginBottom: '6px' }}>ชื่อเพื่อนคนที่ {i + 1} *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        const updated = [...friendNames];
                        updated[i] = e.target.value;
                        setFriendNames(updated);
                      }}
                      placeholder="ระบุชื่อเพื่อน..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.95rem',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="submit"
                  style={{
                    flex: '1 1 0%',
                    padding: '12px',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    border: '1px solid transparent',
                    background: 'var(--gradient)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontFamily: 'Outfit, sans-serif',
                    boxSizing: 'border-box'
                  }}
                >
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFriendsInputForm(false);
                    setPendingPaymentData(null);
                    setPayForFriendsMode(false);
                    setImageFile(null);
                    if (existingPayment?.slipUrl) {
                      setImagePreview(existingPayment.slipUrl);
                    } else {
                      setImagePreview('');
                    }
                  }}
                  style={{
                    flex: '1 1 0%',
                    padding: '12px',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    cursor: 'pointer',
                    fontFamily: 'Outfit, sans-serif',
                    boxSizing: 'border-box'
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {activeLightboxImg && (
        <div 
          onClick={() => setActiveLightboxImg(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            zIndex: 999999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'zoom-out',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div style={{ position: 'absolute', top: '20px', right: '20px', color: '#fff', fontSize: '2rem', fontWeight: 'bold', cursor: 'pointer' }}>
            ✕
          </div>
          <img 
            src={activeLightboxImg} 
            alt="Enlarged Slip" 
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '95%',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }} 
          />
        </div>
      )}

      {showDuplicatePopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="success-popup-anim" style={{ background: '#fff', padding: '2.25rem 2rem', borderRadius: '28px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', boxSizing: 'border-box', textAlign: 'center' }}>
            <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#fff1f2', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.5rem', border: '2px solid #fda4af' }}>
              ⚠️
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px 0', color: '#e11d48', fontSize: '1.4rem', fontWeight: 'bold', fontFamily: 'Outfit, sans-serif' }}>สลิปนี้ถูกใช้งานแล้ว</h3>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.92rem', lineHeight: '1.5', fontFamily: 'Outfit, sans-serif' }}>
                สลิปโอนเงินรายการนี้เคยถูกอัปโหลดเข้ามาในระบบแล้ว ไม่สามารถส่งข้อมูลการโอนเงินซ้ำได้
              </p>
            </div>
            {duplicateSlipId && (
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '10px 14px', width: '100%', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold', marginBottom: '2px' }}>เลขที่อ้างอิงธุรกรรม (Slip ID)</span>
                <code style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 'bold', fontFamily: 'monospace', wordBreak: 'break-all' }}>{duplicateSlipId}</code>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setImageFile(null);
                if (existingPayment?.slipUrl && !payForFriendsMode) {
                  setImagePreview(existingPayment.slipUrl);
                } else {
                  setImagePreview('');
                }
                setShowDuplicatePopup(false);
                setDuplicateSlipId('');
              }}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '16px',
                fontSize: '1rem',
                fontWeight: 'bold',
                border: 'none',
                background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)',
                transition: 'transform 0.1s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              รับทราบ / เปลี่ยนสลิปใหม่
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { AutoResizeTextarea } from './AutoResizeTextarea';

const INVITATION_COLORS = [
  { name: 'red', value: '#ef4444', label: 'แดง' },
  { name: 'purple', value: '#6d28d9', label: 'ม่วง' },
  { name: 'blue', value: '#2563eb', label: 'น้ำเงิน' },
  { name: 'green', value: '#16a34a', label: 'เขียว' },
  { name: 'orange', value: '#ea580c', label: 'ส้ม' },
  { name: 'yellow', value: '#FFE600', label: 'เหลือง' },
  { name: 'pink', value: '#FF416C', label: 'ชมพู' },
];

const BUTTON_COLORS = [
  { name: 'purple', value: '#6d28d9', label: 'ม่วง' },
  { name: 'red', value: '#ef4444', label: 'แดง' },
  { name: 'blue', value: '#2563eb', label: 'น้ำเงิน' },
  { name: 'green', value: '#16a34a', label: 'เขียว' },
  { name: 'orange', value: '#ea580c', label: 'ส้ม' },
  { name: 'yellow', value: '#FFE600', label: 'เหลือง' },
  { name: 'pink', value: '#FF416C', label: 'ชมพู' },
];

interface SavedAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
}

interface CreateBillingModalProps {
  onClose: () => void;
  userId: string;
}

export default function CreateBillingModal({ onClose, userId }: CreateBillingModalProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [description, setDescription] = useState('');
  const [invitationText, setInvitationText] = useState('อย่าลืมโอนกันนะ 💸');
  const [invitationColor, setInvitationColor] = useState('#ef4444');
  const [buttonColor, setButtonColor] = useState('#6d28d9');
  const [saveAccount, setSaveAccount] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedSavedAccountId, setSelectedSavedAccountId] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  // Load saved accounts for this user
  useEffect(() => {
    const fetchSavedAccounts = async () => {
      try {
        const snap = await getDocs(collection(db, 'users', userId, 'savedAccounts'));
        const accounts: SavedAccount[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedAccount));
        setSavedAccounts(accounts);
      } catch (err) {
        console.error('Failed to load saved accounts', err);
      }
    };
    fetchSavedAccounts();
  }, [userId]);

  const handleSelectSavedAccount = (id: string) => {
    setSelectedSavedAccountId(id);
    if (!id) return;
    const found = savedAccounts.find(a => a.id === id);
    if (found) {
      setAccountName(found.accountName);
      setBankName(found.bankName);
      setAccountNumber(found.accountNumber);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount.trim() || !bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('กรุณากรอกจำนวนเงินเป็นตัวเลขที่ถูกต้อง');
      return;
    }

    setSaving(true);
    try {
      // Optionally save account info
      if (saveAccount && accountName.trim() && bankName.trim() && accountNumber.trim()) {
        const accountId = `${accountName.trim()}_${accountNumber.trim()}`.replace(/\s+/g, '_');
        await setDoc(doc(db, 'users', userId, 'savedAccounts', accountId), {
          accountName: accountName.trim(),
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          updatedAt: serverTimestamp(),
        });
      }

      await addDoc(collection(db, 'billings'), {
        name: name.trim(),
        amount: numAmount,
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        description: description.trim(),
        invitationText: invitationText.trim(),
        invitationColor,
        buttonColor,
        createdBy: userId,
        createdAt: serverTimestamp()
      });

      onClose();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการสร้างรายการเรียกเก็บเงิน');
    } finally {
      setSaving(false);
    }
  };

  const dividerStyle: React.CSSProperties = {
    border: 'none',
    borderTop: '1px solid #e2e8f0',
    margin: '4px 0',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold',
    color: '#475569',
    fontSize: '0.9rem',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '1rem',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 20000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '500px',
        padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto'
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '15px', right: '15px', background: '#fef2f2', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: '1.4rem', fontWeight: 'bold' }}
        >
          ✕
        </button>

        <h2 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '1.5rem' }}>
          สร้างรายการเรียกเก็บเงิน
        </h2>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

          {/* ชื่อรายการเรียกเก็บเงิน */}
          <div>
            <label style={labelStyle}>ชื่อรายการเรียกเก็บเงิน *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
              placeholder="เช่น ค่าสมาชิกรายเดือน มิ.ย. 2569"
              required
            />
          </div>

          {/* จำนวนเงิน */}
          <div>
            <label style={labelStyle}>จำนวนเงิน (บาท) *</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={inputStyle}
              placeholder="เช่น 1500"
              min="0"
              step="0.01"
              required
            />
          </div>

          {/* Divider */}
          <hr style={dividerStyle} />

          {/* Dropdown เลือกบัญชีที่บันทึกไว้ */}
          {savedAccounts.length > 0 && (
            <div>
              <label style={labelStyle}>เลือกบัญชีที่บันทึกไว้</label>
              <select
                value={selectedSavedAccountId}
                onChange={e => handleSelectSavedAccount(e.target.value)}
                style={{ ...inputStyle, color: selectedSavedAccountId ? '#1e293b' : '#94a3b8', appearance: 'auto' }}
              >
                <option value="">— กรอกข้อมูลบัญชีใหม่ —</option>
                {savedAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountName}  ·  {acc.bankName}  ·  {acc.accountNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ชื่อบัญชี */}
          <div>
            <label style={labelStyle}>ชื่อบัญชี *</label>
            <input
              type="text"
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              style={inputStyle}
              placeholder="เช่น นายสมศักดิ์ รักดี"
              required
            />
          </div>

          {/* ธนาคาร */}
          <div>
            <label style={labelStyle}>ธนาคาร *</label>
            <input
              type="text"
              value={bankName}
              onChange={e => setBankName(e.target.value)}
              style={inputStyle}
              placeholder="เช่น กสิกรไทย (KBANK)"
              required
            />
          </div>

          {/* เลขบัญชี */}
          <div>
            <label style={labelStyle}>เลขบัญชี *</label>
            <input
              type="text"
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value)}
              style={inputStyle}
              placeholder="เช่น 123-4-56789-0"
              required
            />
          </div>

          {/* Checkbox บันทึกบัญชีรับเงิน */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', fontSize: '0.9rem', color: '#475569', fontWeight: '500' }}>
            <input
              type="checkbox"
              checked={saveAccount}
              onChange={e => setSaveAccount(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            บันทึกบัญชีรับเงินนี้ไว้ใช้ภายหลัง
          </label>

          {/* Divider */}
          <hr style={dividerStyle} />

          {/* รายละเอียด */}
          <div>
            <label style={labelStyle}>รายละเอียด</label>
            <AutoResizeTextarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ ...inputStyle, minHeight: '80px' }}
              placeholder="คำอธิบายเพิ่มเติม เช่น กรุณาโอนภายในวันที่ 5 ของเดือน..."
            />
          </div>

          {/* Flex Message Section */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #cbd5e1',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              💬 ปรับแต่ง Flex Message
            </h3>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.85rem' }}>คำทวงเงิน</label>
              <input
                type="text"
                value={invitationText}
                onChange={e => setInvitationText(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box' }}
                placeholder="เช่น 💸 แจ้งเตือนยอดชำระเงิน"
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', alignItems: 'center' }}>
                {INVITATION_COLORS.map(color => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setInvitationColor(color.value)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: color.value,
                      border: invitationColor === color.value ? '2px solid #0f172a' : '2px solid transparent',
                      boxShadow: invitationColor === color.value ? '0 0 0 2px #fff, 0 0 0 4px #0f172a' : '0 1px 3px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                      transform: invitationColor === color.value ? 'scale(1.1)' : 'none',
                      padding: 0,
                    }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569', fontSize: '0.85rem' }}>
                สีปุ่มกดชำระเงิน:
              </label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '5px', alignItems: 'center' }}>
                {BUTTON_COLORS.map(color => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setButtonColor(color.value)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: color.value,
                      border: buttonColor === color.value ? '2px solid #0f172a' : '2px solid transparent',
                      boxShadow: buttonColor === color.value ? '0 0 0 2px #fff, 0 0 0 4px #0f172a' : '0 1px 3px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                      transform: buttonColor === color.value ? 'scale(1.1)' : 'none',
                      padding: 0,
                    }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{ width: '100%', padding: '14px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: saving ? 'not-allowed' : 'pointer', marginTop: '10px', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'กำลังสร้าง...' : 'สร้างรายการเรียกเก็บเงิน'}
          </button>
        </form>
      </div>
    </div>
  );
}

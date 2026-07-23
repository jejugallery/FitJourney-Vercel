import { useRef, useState } from 'react';
import { supplementsApi } from '../../utils/api';
import { uploadToImgBB } from '../../utils/mediaHelper';
import type { ContentUnit, Supplement } from './types';

interface Props { supplements: Supplement[]; onRefresh: () => Promise<void>; }
const emptyForm = { name: '', price: '', contentQuantity: '', contentUnit: 'เม็ด' as ContentUnit, imageUrl: '' };

export default function SupplementCatalogPanel({ supplements, onRefresh }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setForm(emptyForm); setEditing(null); setFile(null); if (fileRef.current) fileRef.current.value = ''; };
  const edit = (item: Supplement) => { setEditing(item); setForm({ name: item.name, price: String(item.price), contentQuantity: String(item.contentQuantity), contentUnit: item.contentUnit, imageUrl: item.imageUrl }); setFile(null); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || Number(form.price) <= 0 || !Number.isInteger(Number(form.contentQuantity)) || Number(form.contentQuantity) <= 0 || (!editing && !file)) return alert('กรุณากรอกข้อมูลและเลือกรูปภาพให้ครบ');
    setSaving(true);
    try {
      const imageUrl = file ? await uploadToImgBB(file) : form.imageUrl;
      const payload = { name: form.name.trim(), imageUrl, price: Number(form.price), contentQuantity: Number(form.contentQuantity), contentUnit: form.contentUnit };
      if (editing) await supplementsApi.update(editing.id, payload); else await supplementsApi.create(payload);
      reset(); await onRefresh();
    } catch (error: any) { alert(error.message || 'บันทึกอาหารเสริมไม่สำเร็จ'); } finally { setSaving(false); }
  };
  const archive = async (item: Supplement) => {
    if (!confirm(`ลบ ${item.name} ออกจากคลังสำหรับคอร์สใหม่ใช่หรือไม่?`)) return;
    try { await supplementsApi.archive(item.id); if (editing?.id === item.id) reset(); await onRefresh(); } catch (error: any) { alert(error.message || 'ลบรายการไม่สำเร็จ'); }
  };

  return <div>
    <form onSubmit={save} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{editing ? 'แก้ไขอาหารเสริม' : 'เพิ่มอาหารเสริม'}</h3>
      <div className="supplement-grid">
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="ชื่ออาหารเสริม" />
        <input type="number" min="0.01" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="ราคา (บาท)" />
        <input type="number" min="1" step="1" value={form.contentQuantity} onChange={e => setForm({ ...form, contentQuantity: e.target.value })} placeholder="จำนวนบรรจุ" />
        <select value={form.contentUnit} onChange={e => setForm({ ...form, contentUnit: e.target.value as ContentUnit })}><option>เม็ด</option><option>ช้อน</option><option>ซอง</option></select>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} style={{ marginTop: 10 }} />
      {form.imageUrl && !file && <img src={form.imageUrl} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, marginTop: 10 }} />}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button className="btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>{editing && <button type="button" onClick={reset}>ยกเลิก</button>}</div>
    </form>
    <div style={{ display: 'grid', gap: 10 }}>{supplements.map(item => <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'center', border: '1px solid #e2e8f0', padding: 10, borderRadius: 12, opacity: item.isActive ? 1 : .55 }}>
      <img src={item.imageUrl} alt="" style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 10 }} /><div style={{ flex: 1 }}><b>{item.name}</b><div style={{ color: '#64748b', fontSize: 13 }}>{item.contentQuantity} {item.contentUnit} · ฿{Number(item.price).toLocaleString('th-TH')}</div></div>
      {item.isActive && <><button type="button" onClick={() => edit(item)}>แก้ไข</button><button type="button" onClick={() => archive(item)} style={{ color: '#dc2626' }}>ลบ</button></>}
    </div>)}</div>
  </div>;
}

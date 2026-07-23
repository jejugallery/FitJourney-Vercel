import { useMemo, useRef, useState } from 'react';
import { supplementsApi } from '../../utils/api';
import { uploadToImgBB } from '../../utils/mediaHelper';
import type { ContentUnit, Supplement } from './types';
import { displayProductPrice } from './priceDisplay';

interface Props { supplements: Supplement[]; onRefresh: () => Promise<void>; }
const emptyForm = { name: '', price: '', contentQuantity: '', contentUnit: 'เม็ด' as ContentUnit, imageUrl: '' };

export default function SupplementCatalogPanel({ supplements, onRefresh }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [search, setSearch] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => { const query = search.trim().toLocaleLowerCase('th-TH'); return supplements.filter(item => !query || item.name.toLocaleLowerCase('th-TH').includes(query)); }, [supplements, search]);

  const reset = () => { setForm(emptyForm); setEditing(null); setFile(null); setPreview(''); setView('list'); if (fileRef.current) fileRef.current.value = ''; };
  const create = () => { setEditing(null); setForm(emptyForm); setFile(null); setPreview(''); setView('form'); };
  const edit = (item: Supplement) => { setEditing(item); setForm({ name: item.name, price: String(item.price), contentQuantity: String(item.contentQuantity), contentUnit: item.contentUnit, imageUrl: item.imageUrl }); setFile(null); setPreview(item.imageUrl); setView('form'); };
  const chooseFile = (nextFile: File | null) => { setFile(nextFile); if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview); setPreview(nextFile ? URL.createObjectURL(nextFile) : form.imageUrl); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0 || !Number.isInteger(Number(form.contentQuantity)) || Number(form.contentQuantity) <= 0 || (!editing && !file)) return alert('กรุณากรอกข้อมูลและเลือกรูปภาพให้ครบ');
    setSaving(true);
    try {
      const imageUrl = file ? await uploadToImgBB(file) : form.imageUrl;
      const payload = { name: form.name.trim(), imageUrl, price: Number(form.price), contentQuantity: Number(form.contentQuantity), contentUnit: form.contentUnit };
      if (editing) await supplementsApi.update(editing.id, payload); else await supplementsApi.create(payload);
      await onRefresh(); reset();
    } catch (error: any) { alert(error.message || 'บันทึกอาหารเสริมไม่สำเร็จ'); } finally { setSaving(false); }
  };
  const archive = async (item: Supplement) => {
    if (!confirm(`ลบ ${item.name} ออกจากคลังสำหรับคอร์สใหม่ใช่หรือไม่?`)) return;
    try { await supplementsApi.archive(item.id); await onRefresh(); } catch (error: any) { alert(error.message || 'ลบรายการไม่สำเร็จ'); }
  };

  if (view === 'form') return <section className="supplement-screen">
    <div className="supplement-screen-header"><button type="button" className="supplement-back" onClick={reset}>←</button><div><h3>{editing ? 'แก้ไขอาหารเสริม' : 'เพิ่มอาหารเสริม'}</h3><p>กรอกข้อมูลสำหรับใช้จัดคอร์ส</p></div></div>
    <form onSubmit={save} className="supplement-catalog-form">
      <label><span className="supplement-control-label">ชื่ออาหารเสริม *</span><input className="supplement-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น Protein Plus" /></label>
      <label><span className="supplement-control-label">ราคา (บาท) *</span><input className="supplement-field" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0 = ฟรี" /></label>
      <div className="supplement-form-pair"><label><span className="supplement-control-label">จำนวนบรรจุ *</span><input className="supplement-field" type="number" min="1" step="1" value={form.contentQuantity} onChange={e => setForm({ ...form, contentQuantity: e.target.value })} placeholder="30" /></label><label><span className="supplement-control-label">หน่วย *</span><select className="supplement-field" value={form.contentUnit} onChange={e => setForm({ ...form, contentUnit: e.target.value as ContentUnit })}><option>เม็ด</option><option>ช้อน</option><option>ซอง</option><option>ใบ</option></select></label></div>
      <label><span className="supplement-control-label">รูปภาพ *</span><input ref={fileRef} className="supplement-file" type="file" accept="image/*" onChange={e => chooseFile(e.target.files?.[0] || null)} /></label>
      {preview ? <div className="supplement-image-preview"><img src={preview} alt="ตัวอย่างอาหารเสริม" /><span>{file ? file.name : 'รูปปัจจุบัน'}</span></div> : <div className="supplement-state compact">ยังไม่ได้เลือกรูปภาพ</div>}
      <button className="supplement-action supplement-action-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มอาหารเสริม'}</button><button type="button" className="supplement-action supplement-action-secondary" onClick={reset} disabled={saving}>ยกเลิก</button>
    </form>
  </section>;

  return <div>
    <input className="supplement-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาอาหารเสริม..." />
    <button type="button" className="supplement-action supplement-action-primary supplement-catalog-create" onClick={create}>＋ เพิ่มอาหารเสริม</button>
    {!filtered.length ? <div className="supplement-state">{search ? 'ไม่พบอาหารเสริม' : 'ยังไม่มีอาหารเสริมในคลัง'}</div> : <div className="supplement-catalog-grid">{filtered.map(item => <article key={item.id} className={`supplement-catalog-card ${item.isActive ? '' : 'archived'}`}><div className="supplement-card-head"><img src={item.imageUrl} alt="" /><div className="supplement-card-copy"><div className="supplement-status-row"><b>{item.name}</b><span className={item.isActive ? 'active' : ''}>{item.isActive ? 'ใช้งาน' : 'เก็บถาวร'}</span></div><small>{item.contentQuantity} {item.contentUnit}</small><strong>{displayProductPrice(item.price)}</strong></div></div>{item.isActive && <div className="supplement-card-actions"><button type="button" className="supplement-action supplement-action-secondary" onClick={() => edit(item)}>แก้ไข</button><button type="button" className="supplement-action supplement-action-danger" onClick={() => archive(item)}>ลบ</button></div>}</article>)}</div>}
  </div>;
}

import { useMemo, useState } from 'react';
import { supplementCoursesApi } from '../../utils/api';
import { calculateCourseLine, calculateCourseTotals } from './pricing';
import type { CourseDraftLine, CourseTrainee, DiscountType, SavedSupplementCourse, Supplement } from './types';

interface Props { trainees: CourseTrainee[]; supplements: Supplement[]; onSaved: (course: SavedSupplementCourse) => Promise<void>; }
const discounts: Array<[DiscountType, string]> = [['none', 'ไม่ลด'], ['percent_10', '10%'], ['percent_15', '15%'], ['fixed_100', '100฿'], ['fixed_500', '500฿'], ['custom', 'กำหนดเอง']];
const money = (value: number) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SupplementCourseForm({ trainees, supplements, onSaved }: Props) {
  const [traineeId, setTraineeId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [lines, setLines] = useState<CourseDraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const totals = useMemo(() => calculateCourseTotals(lines), [lines]);

  const add = () => {
    const supplement = supplements.find(item => item.id === selectedProduct);
    if (!supplement || lines.some(line => line.supplementId === supplement.id)) return;
    setLines(current => [...current, { supplementId: supplement.id, supplement, packageQuantity: 1, discountType: 'none', discountValue: 0 }]);
    setSelectedProduct('');
  };
  const change = (id: string, patch: Partial<CourseDraftLine>) => setLines(current => current.map(line => line.supplementId === id ? { ...line, ...patch } : line));
  const save = async () => {
    if (!traineeId) return alert('กรุณาเลือกลูกเทรน');
    if (!lines.length) return alert('กรุณาเลือกอาหารเสริมอย่างน้อย 1 รายการ');
    if (lines.some(line => !Number.isInteger(line.packageQuantity) || line.packageQuantity <= 0 || line.discountValue < 0)) return alert('กรุณาตรวจสอบจำนวนและส่วนลด');
    setSaving(true);
    try {
      const course = await supplementCoursesApi.create({ traineeId, items: lines.map(line => ({ supplementId: line.supplementId, packageQuantity: line.packageQuantity, discountType: line.discountType, discountValue: line.discountValue })) });
      await onSaved(course);
      setLines([]); setTraineeId('');
    } catch (error: any) { alert(error.message || 'บันทึกคอร์สไม่สำเร็จ'); } finally { setSaving(false); }
  };

  return <div>
    <label className="supplement-label">เลือกลูกเทรน *</label>
    <select className="supplement-field" value={traineeId} onChange={e => setTraineeId(e.target.value)}><option value="">— เลือกลูกเทรน —</option>{trainees.map(t => <option key={t.userId} value={t.userId}>{t.nickname}</option>)}</select>
    <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}><select className="supplement-field" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} style={{ flex: 1 }}><option value="">— เลือกอาหารเสริม —</option>{supplements.filter(item => item.isActive && !lines.some(line => line.supplementId === item.id)).map(item => <option key={item.id} value={item.id}>{item.name} · ฿{Number(item.price).toLocaleString('th-TH')}</option>)}</select><button type="button" className="btn-primary" onClick={add} disabled={!selectedProduct}>+ เพิ่ม</button></div>
    {!lines.length && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 28, border: '1px dashed #cbd5e1', borderRadius: 12 }}>ยังไม่มีรายการอาหารเสริม</div>}
    <div style={{ display: 'grid', gap: 12 }}>{lines.map(line => { const price = calculateCourseLine(line.supplement.price, line.packageQuantity, line.discountType, line.discountValue); return <div key={line.supplementId} className="supplement-course-line">
      <img src={line.supplement.imageUrl} alt="" /><div className="supplement-line-main"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div><b>{line.supplement.name}</b><div className="supplement-muted">{line.supplement.contentQuantity} {line.supplement.contentUnit} · ฿{money(line.supplement.price)} / ชิ้น</div></div><button type="button" onClick={() => setLines(current => current.filter(item => item.supplementId !== line.supplementId))} className="supplement-remove">✕</button></div>
      <div className="supplement-line-controls"><label>จำนวน<input type="number" min="1" step="1" value={line.packageQuantity} onChange={e => change(line.supplementId, { packageQuantity: Number(e.target.value) })} /></label><label>ส่วนลด<select value={line.discountType} onChange={e => change(line.supplementId, { discountType: e.target.value as DiscountType, discountValue: 0 })}>{discounts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{line.discountType === 'custom' && <label>ลด (บาท)<input type="number" min="0" step="0.01" value={line.discountValue} onChange={e => change(line.supplementId, { discountValue: Number(e.target.value) })} /></label>}</div>
      <div style={{ textAlign: 'right', marginTop: 8 }}><span className="supplement-muted">฿{money(price.grossAmount)} - ฿{money(price.discountAmount)} = </span><b style={{ color: '#ff416c' }}>฿{money(price.netAmount)}</b></div></div>
    </div>; })}</div>
    {!!lines.length && <div className="supplement-total"><div><span>ยอดก่อนส่วนลด</span><b>฿{money(totals.subtotal)}</b></div><div><span>ส่วนลดรวม</span><b style={{ color: '#dc2626' }}>-฿{money(totals.discountTotal)}</b></div><div className="grand"><span>รวมสุทธิ</span><b>฿{money(totals.total)}</b></div><button type="button" className="btn-primary" onClick={save} disabled={saving} style={{ width: '100%', marginTop: 12 }}>{saving ? 'กำลังบันทึก...' : 'บันทึกและดาวน์โหลด PDF'}</button></div>}
  </div>;
}

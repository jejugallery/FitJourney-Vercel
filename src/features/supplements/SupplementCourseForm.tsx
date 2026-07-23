import { useMemo, useState } from 'react';
import { supplementCoursesApi } from '../../utils/api';
import { calculateCourseLine, calculateCourseTotals } from './pricing';
import type { CourseDraftLine, CourseTrainee, DiscountType, SavedSupplementCourse, Supplement } from './types';

interface Props { trainees: CourseTrainee[]; supplements: Supplement[]; onSaved: (course: SavedSupplementCourse) => Promise<void>; }
const discounts: Array<[DiscountType, string]> = [['none', 'ไม่ลด'], ['percent_10', '10%'], ['percent_15', '15%'], ['fixed_100', '100฿'], ['fixed_500', '500฿'], ['custom', 'กำหนดเอง']];
const money = (value: number) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SupplementCourseForm({ trainees, supplements, onSaved }: Props) {
  const [traineeId, setTraineeId] = useState('');
  const [lines, setLines] = useState<CourseDraftLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const totals = useMemo(() => calculateCourseTotals(lines), [lines]);
  const available = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase('th-TH');
    return supplements.filter(item => item.isActive && !lines.some(line => line.supplementId === item.id) && (!query || item.name.toLocaleLowerCase('th-TH').includes(query)));
  }, [supplements, lines, productSearch]);
  const remainingCount = supplements.filter(item => item.isActive && !lines.some(line => line.supplementId === item.id)).length;

  const add = (supplement: Supplement) => {
    setLines(current => [...current, { supplementId: supplement.id, supplement, packageQuantity: 1, discountType: 'none', discountValue: 0 }]);
    setProductSearch('');
    setPickerOpen(false);
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

  if (pickerOpen) return <section className="supplement-screen">
    <div className="supplement-screen-header"><button type="button" className="supplement-back" onClick={() => { setPickerOpen(false); setProductSearch(''); }}>←</button><div><h3>เลือกอาหารเสริม</h3><p>แตะสินค้าที่ต้องการเพิ่มในคอร์ส</p></div></div>
    <input className="supplement-search" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="ค้นหาชื่ออาหารเสริม..." autoFocus />
    {!remainingCount ? <div className="supplement-state">เพิ่มอาหารเสริมที่มีอยู่ครบแล้ว</div> : !available.length ? <div className="supplement-state">ไม่พบอาหารเสริม</div> : <div className="supplement-picker-grid">{available.map(item => <button type="button" key={item.id} className="supplement-product-card" onClick={() => add(item)}><img src={item.imageUrl} alt="" /><span className="supplement-card-copy"><b>{item.name}</b><small>{item.contentQuantity} {item.contentUnit}</small><strong>฿{money(item.price)}</strong></span><span className="supplement-card-add">＋</span></button>)}</div>}
  </section>;

  return <div className="supplement-course-form">
    <label className="supplement-label">เลือกลูกเทรน *</label>
    <select className="supplement-field" value={traineeId} onChange={e => setTraineeId(e.target.value)}><option value="">— เลือกลูกเทรน —</option>{trainees.map(t => <option key={t.userId} value={t.userId}>{t.nickname}</option>)}</select>
    <button type="button" className="supplement-action supplement-action-primary supplement-picker-trigger" onClick={() => setPickerOpen(true)} disabled={!remainingCount}>＋ {remainingCount ? 'เลือกอาหารเสริม' : 'เลือกอาหารเสริมครบแล้ว'}</button>
    {!lines.length && <div className="supplement-state">ยังไม่มีรายการอาหารเสริม<br /><small>แตะ “เลือกอาหารเสริม” เพื่อเริ่มจัดคอร์ส</small></div>}
    <div className="supplement-course-list">{lines.map(line => { const price = calculateCourseLine(line.supplement.price, line.packageQuantity, line.discountType, line.discountValue); return <article key={line.supplementId} className="supplement-course-card">
      <div className="supplement-card-head"><img src={line.supplement.imageUrl} alt="" /><div className="supplement-card-copy"><b>{line.supplement.name}</b><small>{line.supplement.contentQuantity} {line.supplement.contentUnit}</small><span>฿{money(line.supplement.price)} / ชิ้น</span></div><button type="button" onClick={() => setLines(current => current.filter(item => item.supplementId !== line.supplementId))} className="supplement-icon-danger" aria-label={`ลบ ${line.supplement.name}`}>✕</button></div>
      <div className="supplement-control-block"><span className="supplement-control-label">จำนวนสินค้า</span><div className="supplement-stepper"><button type="button" onClick={() => change(line.supplementId, { packageQuantity: Math.max(1, line.packageQuantity - 1) })} disabled={line.packageQuantity <= 1}>−</button><strong>{line.packageQuantity}</strong><button type="button" onClick={() => change(line.supplementId, { packageQuantity: line.packageQuantity + 1 })}>＋</button></div></div>
      <label className="supplement-control-block"><span className="supplement-control-label">ส่วนลดรายการนี้</span><select className="supplement-field" value={line.discountType} onChange={e => change(line.supplementId, { discountType: e.target.value as DiscountType, discountValue: 0 })}>{discounts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {line.discountType === 'custom' && <label className="supplement-control-block"><span className="supplement-control-label">กำหนดส่วนลด (บาท)</span><input className="supplement-field" type="number" min="0" step="0.01" value={line.discountValue} onChange={e => change(line.supplementId, { discountValue: Number(e.target.value) })} /></label>}
      <div className="supplement-line-summary"><span><small>ก่อนลด</small>฿{money(price.grossAmount)}</span><span className="discount"><small>ส่วนลด</small>-฿{money(price.discountAmount)}</span><strong><small>สุทธิ</small>฿{money(price.netAmount)}</strong></div>
    </article>; })}</div>
    {!!lines.length && <div className="supplement-total"><div><span>ยอดก่อนส่วนลด</span><b>฿{money(totals.subtotal)}</b></div><div><span>ส่วนลดรวม</span><b className="supplement-discount-text">-฿{money(totals.discountTotal)}</b></div><div className="grand"><span>รวมสุทธิ</span><b>฿{money(totals.total)}</b></div><button type="button" className="supplement-action supplement-action-primary" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกและดาวน์โหลด PDF'}</button></div>}
  </div>;
}

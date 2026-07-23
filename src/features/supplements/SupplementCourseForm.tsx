import { useMemo, useState } from 'react';
import { supplementCoursesApi } from '../../utils/api';
import { CASHBACK_PERCENTAGES, calculateCourseCashback, calculateCourseLine, calculateCourseTotals } from './pricing';
import { createCourseDraftLine } from './draftLines';
import { filterCourseTrainees } from './traineeSearch';
import { displayProductPrice } from './priceDisplay';
import type { CourseDraftLine, CourseTrainee, DiscountType, SavedSupplementCourse, Supplement } from './types';

interface Props { trainees: CourseTrainee[]; supplements: Supplement[]; onSaved: (course: SavedSupplementCourse) => Promise<void>; }
const discounts: Array<[DiscountType, string]> = [['none', 'ไม่ลด'], ['percent_10', '10%'], ['percent_15', '15%'], ['fixed_100', '100฿'], ['fixed_500', '500฿'], ['custom', 'กำหนดเอง']];
const money = (value: number) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SupplementCourseForm({ trainees, supplements, onSaved }: Props) {
  const [traineeId, setTraineeId] = useState('');
  const [traineeDropdownOpen, setTraineeDropdownOpen] = useState(false);
  const [traineeSearch, setTraineeSearch] = useState('');
  const [lines, setLines] = useState<CourseDraftLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [cashbackPercent, setCashbackPercent] = useState(3);
  const totals = useMemo(() => calculateCourseTotals(lines), [lines]);
  const cashbackAmount = useMemo(() => calculateCourseCashback(lines.map(line => ({
    name: line.supplement.name,
    netAmount: calculateCourseLine(line.supplement.price, line.packageQuantity, line.discountType, line.discountValue).netAmount,
  })), cashbackPercent), [lines, cashbackPercent]);
  const selectedTrainee = trainees.find(trainee => trainee.userId === traineeId);
  const filteredTrainees = useMemo(() => filterCourseTrainees(trainees, traineeSearch), [trainees, traineeSearch]);
  const available = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase('th-TH');
    return supplements.filter(item => item.isActive && (!query || item.name.toLocaleLowerCase('th-TH').includes(query)));
  }, [supplements, productSearch]);
  const availableCount = supplements.filter(item => item.isActive).length;

  const add = (supplement: Supplement) => {
    setLines(current => [...current, createCourseDraftLine(supplement)]);
    setProductSearch('');
    setPickerOpen(false);
  };
  const change = (lineId: string, patch: Partial<CourseDraftLine>) => setLines(current => current.map(line => line.lineId === lineId ? { ...line, ...patch } : line));
  const save = async () => {
    if (!traineeId) return alert('กรุณาเลือกลูกเทรน');
    if (!lines.length) return alert('กรุณาเลือกอาหารเสริมอย่างน้อย 1 รายการ');
    if (lines.some(line => !Number.isInteger(line.packageQuantity) || line.packageQuantity <= 0 || line.discountValue < 0)) return alert('กรุณาตรวจสอบจำนวนและส่วนลด');
    setSaving(true);
    try {
      const course = await supplementCoursesApi.create({ traineeId, cashbackPercent, items: lines.map(line => ({ supplementId: line.supplementId, packageQuantity: line.packageQuantity, discountType: line.discountType, discountValue: line.discountValue })) });
      await onSaved(course);
      setLines([]); setTraineeId(''); setCashbackPercent(3);
    } catch (error: any) { alert(error.message || 'บันทึกคอร์สไม่สำเร็จ'); } finally { setSaving(false); }
  };

  if (pickerOpen) return <section className="supplement-screen">
    <div className="supplement-screen-header"><button type="button" className="supplement-back" onClick={() => { setPickerOpen(false); setProductSearch(''); }}>←</button><div><h3>เลือกอาหารเสริม</h3><p>แตะสินค้าที่ต้องการเพิ่มในคอร์ส</p></div></div>
    <input className="supplement-search" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="ค้นหาชื่ออาหารเสริม..." autoFocus />
    {!availableCount ? <div className="supplement-state">ยังไม่มีอาหารเสริมในคลัง</div> : !available.length ? <div className="supplement-state">ไม่พบอาหารเสริม</div> : <div className="supplement-picker-grid">{available.map(item => <button type="button" key={item.id} className="supplement-product-card" onClick={() => add(item)}><img src={item.imageUrl} alt="" /><span className="supplement-card-copy"><b>{item.name}</b><small>{item.contentQuantity} {item.contentUnit}</small><strong>{displayProductPrice(item.price)}</strong></span><span className="supplement-card-add">＋</span></button>)}</div>}
  </section>;

  return <div className="supplement-course-form">
    <label className="supplement-label">เลือกลูกเทรน *</label>
    <div className="supplement-trainee-picker">
      <button type="button" className={`supplement-trainee-trigger ${traineeDropdownOpen ? 'open' : ''}`} onClick={() => setTraineeDropdownOpen(open => !open)} aria-expanded={traineeDropdownOpen}>
        <span className="supplement-trainee-value">{selectedTrainee ? <><span className="supplement-avatar">{selectedTrainee.pictureUrl ? <img src={selectedTrainee.pictureUrl} alt="" /> : '👤'}</span><b>{selectedTrainee.nickname}</b></> : <span className="placeholder">เลือกลูกเทรน</span>}</span>
        <span className="supplement-trainee-chevron">▼</span>
      </button>
      {traineeDropdownOpen && <><button type="button" className="supplement-trainee-overlay" aria-label="ปิดรายการลูกเทรน" onClick={() => { setTraineeDropdownOpen(false); setTraineeSearch(''); }} /><div className="supplement-trainee-panel">
        <div className="supplement-trainee-search-wrap"><span>🔍</span><input value={traineeSearch} onChange={e => setTraineeSearch(e.target.value)} placeholder="ค้นหาลูกเทรน..." autoFocus /></div>
        <div className="supplement-trainee-options">{!trainees.length ? <div className="supplement-trainee-empty">ยังไม่มีลูกเทรน</div> : !filteredTrainees.length ? <div className="supplement-trainee-empty">ไม่พบลูกเทรน</div> : filteredTrainees.map(trainee => <button type="button" key={trainee.userId} className={`supplement-trainee-option ${trainee.userId === traineeId ? 'selected' : ''}`} onClick={() => { setTraineeId(trainee.userId); setTraineeDropdownOpen(false); setTraineeSearch(''); }}><span className="supplement-avatar">{trainee.pictureUrl ? <img src={trainee.pictureUrl} alt="" /> : '👤'}</span><span>{trainee.nickname}</span>{trainee.userId === traineeId && <strong>✓</strong>}</button>)}</div>
      </div></>}
    </div>
    <button type="button" className="supplement-action supplement-action-primary supplement-picker-trigger" onClick={() => setPickerOpen(true)} disabled={!availableCount}>＋ {availableCount ? 'เลือกอาหารเสริม' : 'ยังไม่มีอาหารเสริมในคลัง'}</button>
    {!lines.length && <div className="supplement-state">ยังไม่มีรายการอาหารเสริม<br /><small>แตะ “เลือกอาหารเสริม” เพื่อเริ่มจัดคอร์ส</small></div>}
    <div className="supplement-course-list">{lines.map(line => { const price = calculateCourseLine(line.supplement.price, line.packageQuantity, line.discountType, line.discountValue); return <article key={line.lineId} className="supplement-course-card">
      <div className="supplement-card-head"><img src={line.supplement.imageUrl} alt="" /><div className="supplement-card-copy"><b>{line.supplement.name}</b><small>{line.supplement.contentQuantity} {line.supplement.contentUnit}</small><span>{displayProductPrice(line.supplement.price)} / ชิ้น</span></div><button type="button" onClick={() => setLines(current => current.filter(item => item.lineId !== line.lineId))} className="supplement-icon-danger" aria-label={`ลบ ${line.supplement.name}`}>✕</button></div>
      <div className="supplement-control-block"><span className="supplement-control-label">จำนวนสินค้า</span><div className="supplement-stepper"><button type="button" onClick={() => change(line.lineId, { packageQuantity: Math.max(1, line.packageQuantity - 1) })} disabled={line.packageQuantity <= 1}>−</button><strong>{line.packageQuantity}</strong><button type="button" onClick={() => change(line.lineId, { packageQuantity: line.packageQuantity + 1 })}>＋</button></div></div>
      <label className="supplement-control-block"><span className="supplement-control-label">ส่วนลดรายการนี้</span><span className="supplement-discount-hint">ส่วนลดใช้ได้กับ 1 ชิ้นเท่านั้น</span><select className="supplement-field" value={line.discountType} onChange={e => change(line.lineId, { discountType: e.target.value as DiscountType, discountValue: 0 })}>{discounts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {line.discountType === 'custom' && <label className="supplement-control-block"><span className="supplement-control-label">กำหนดส่วนลด (บาท)</span><input className="supplement-field" type="number" min="0" step="0.01" value={line.discountValue} onChange={e => change(line.lineId, { discountValue: Number(e.target.value) })} /></label>}
      <div className="supplement-line-summary"><span><small>ก่อนลด</small>฿{money(price.grossAmount)}</span><span className="discount"><small>ส่วนลด</small>-฿{money(price.discountAmount)}</span><strong><small>สุทธิ</small>฿{money(price.netAmount)}</strong></div>
    </article>; })}</div>
    {!!lines.length && <div className="supplement-total"><div><span>ยอดก่อนส่วนลด</span><b>฿{money(totals.subtotal)}</b></div><div><span>ส่วนลดรวม</span><b className="supplement-discount-text">-฿{money(totals.discountTotal)}</b></div><div className="grand"><span>รวมสุทธิ</span><b>฿{money(totals.total)}</b></div><label className="supplement-cashback-control"><span>เปอร์เซ็นต์ได้เงินคืน</span><select className="supplement-field" value={cashbackPercent} onChange={e => setCashbackPercent(Number(e.target.value))}>{CASHBACK_PERCENTAGES.map(percent => <option key={percent} value={percent}>{percent}%</option>)}</select></label>{cashbackAmount > 0 && <div className="supplement-cashback-row"><span>ได้เงินคืนภายหลัง ({cashbackPercent}%)</span><b>฿{money(cashbackAmount)}</b></div>}<button type="button" className="supplement-action supplement-action-primary" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกและดาวน์โหลด PDF'}</button></div>}
  </div>;
}

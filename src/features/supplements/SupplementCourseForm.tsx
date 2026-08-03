import { useMemo, useState } from 'react';
import { supplementCoursesApi } from '../../utils/api';
import { calculateAutoCashbackPercent, calculateCourseCashback, calculateCourseLine, calculateCourseTotals } from './pricing';
import { countDraftLinesBySupplement, createCourseDraftLine } from './draftLines';
import { filterCourseTrainees } from './traineeSearch';
import { displayProductPrice } from './priceDisplay';
import { orderSupplementProducts } from './productOrder';
import type { CourseDraftLine, CourseTrainee, DiscountType, SavedSupplementCourse, Supplement } from './types';
import ProfileImage from '../../components/ProfileImage';

interface Props { trainees: CourseTrainee[]; supplements: Supplement[]; onSaved: (course: SavedSupplementCourse) => Promise<void>; }
const discounts: Array<[DiscountType, string]> = [['none', 'ไม่ลด'], ['percent_10', '10%'], ['percent_15', '15%'], ['fixed_100', '100฿'], ['fixed_300', '300฿'], ['fixed_500', '500฿'], ['custom', 'กำหนดเอง']];
const money = (value: number) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SupplementCourseForm({ trainees, supplements, onSaved }: Props) {
  const [traineeId, setTraineeId] = useState('');
  const [traineeDropdownOpen, setTraineeDropdownOpen] = useState(false);
  const [traineeSearch, setTraineeSearch] = useState('');
  const [lines, setLines] = useState<CourseDraftLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const totals = useMemo(() => calculateCourseTotals(lines), [lines]);
  const cashbackPercent = useMemo(() => calculateAutoCashbackPercent(totals.total), [totals.total]);
  const cashbackAmount = useMemo(() => calculateCourseCashback(lines.map(line => ({
    name: line.supplement.name,
    netAmount: calculateCourseLine(line.supplement.price, line.packageQuantity, line.discountType, line.discountValue).netAmount,
  })), cashbackPercent), [lines, cashbackPercent]);
  const selectedTrainee = trainees.find(trainee => trainee.userId === traineeId);
  const filteredTrainees = useMemo(() => filterCourseTrainees(trainees, traineeSearch), [trainees, traineeSearch]);
  const available = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase('th-TH');
    const matches = supplements.filter(item => item.isActive && (!query || item.name.toLocaleLowerCase('th-TH').includes(query)));
    return orderSupplementProducts(matches, item => item.name, item => item.price);
  }, [supplements, productSearch]);
  const availableCount = supplements.filter(item => item.isActive).length;
  const selectedCounts = useMemo(() => countDraftLinesBySupplement(lines), [lines]);
  const orderedLines = useMemo(() => orderSupplementProducts(lines, line => line.supplement.name, line => line.supplement.price), [lines]);

  const add = (supplement: Supplement) => {
    setLines(current => [...current, createCourseDraftLine(supplement)]);
  };
  const clear = (supplementId: string) => {
    setLines(current => current.filter(line => line.supplementId !== supplementId));
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
      setLines([]); setTraineeId('');
    } catch (error: any) { alert(error.message || 'บันทึกคอร์สไม่สำเร็จ'); } finally { setSaving(false); }
  };

  if (pickerOpen) return <section className="supplement-screen">
    <div className="supplement-screen-header supplement-picker-header"><button type="button" className="supplement-back" onClick={() => { setPickerOpen(false); setProductSearch(''); }}>←</button><div><h3>เลือกอาหารเสริม</h3><p>แตะ + เพื่อเพิ่มได้หลายรายการ</p></div><button type="button" className="supplement-picker-finish" onClick={() => { setPickerOpen(false); setProductSearch(''); }}>เสร็จสิ้น</button></div>
    <input className="supplement-search" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="ค้นหาชื่ออาหารเสริม..." autoFocus />
    {!availableCount ? <div className="supplement-state">ยังไม่มีอาหารเสริมในคลัง</div> : !available.length ? <div className="supplement-state">ไม่พบอาหารเสริม</div> : <div className="supplement-picker-grid">{available.map(item => <div key={item.id} className="supplement-product-card" onClick={() => add(item)}><img src={item.imageUrl} alt="" /><span className="supplement-card-copy"><b>{item.name}</b><small>{item.contentQuantity} {item.contentUnit}</small><strong>{displayProductPrice(item.price)}</strong>{selectedCounts[item.id] > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}><span className="supplement-selected-badge" style={{ marginTop: 0 }}>เลือกแล้ว ×{selectedCounts[item.id]}</span><button type="button" className="supplement-card-clear" onClick={(e) => { e.stopPropagation(); clear(item.id); }}>เคลียร์</button></div>}</span><span className="supplement-card-add">＋</span></div>)}</div>}
    <div style={{ padding: '24px 0' }}>
      <button type="button" className="supplement-action supplement-action-primary" style={{ width: '100%', backgroundColor: '#3b82f6', color: 'white' }} onClick={() => { setPickerOpen(false); setProductSearch(''); }}>เสร็จสิ้น</button>
    </div>
  </section>;

  return <div className="supplement-course-form">
    <label className="supplement-label">เลือกลูกเทรน *</label>
    <div className="supplement-trainee-picker">
      <button type="button" className={`supplement-trainee-trigger ${traineeDropdownOpen ? 'open' : ''}`} onClick={() => setTraineeDropdownOpen(open => !open)} aria-expanded={traineeDropdownOpen}>
        <span className="supplement-trainee-value">{selectedTrainee ? <><span className="supplement-avatar">{selectedTrainee.pictureUrl || selectedTrainee.pictureBackupUrl ? <ProfileImage src={selectedTrainee.pictureUrl} fallbackSrc={selectedTrainee.pictureBackupUrl} alt="" /> : '👤'}</span><b>{selectedTrainee.nickname}</b></> : <span className="placeholder">เลือกลูกเทรน</span>}</span>
        <span className="supplement-trainee-chevron">▼</span>
      </button>
      {traineeDropdownOpen && <><button type="button" className="supplement-trainee-overlay" aria-label="ปิดรายการลูกเทรน" onClick={() => { setTraineeDropdownOpen(false); setTraineeSearch(''); }} /><div className="supplement-trainee-panel">
        <div className="supplement-trainee-search-wrap"><span>🔍</span><input value={traineeSearch} onChange={e => setTraineeSearch(e.target.value)} placeholder="ค้นหาลูกเทรน..." autoFocus /></div>
        <div className="supplement-trainee-options">{!trainees.length ? <div className="supplement-trainee-empty">ยังไม่มีลูกเทรน</div> : !filteredTrainees.length ? <div className="supplement-trainee-empty">ไม่พบลูกเทรน</div> : filteredTrainees.map(trainee => <button type="button" key={trainee.userId} className={`supplement-trainee-option ${trainee.userId === traineeId ? 'selected' : ''}`} onClick={() => { setTraineeId(trainee.userId); setTraineeDropdownOpen(false); setTraineeSearch(''); }}><span className="supplement-avatar">{trainee.pictureUrl || trainee.pictureBackupUrl ? <ProfileImage src={trainee.pictureUrl} fallbackSrc={trainee.pictureBackupUrl} alt="" /> : '👤'}</span><span>{trainee.nickname}</span>{trainee.userId === traineeId && <strong>✓</strong>}</button>)}</div>
      </div></>}
    </div>
    <button type="button" className="supplement-action supplement-action-primary supplement-picker-trigger" onClick={() => setPickerOpen(true)} disabled={!availableCount}>＋ {availableCount ? 'เลือกอาหารเสริม' : 'ยังไม่มีอาหารเสริมในคลัง'}</button>
    {!lines.length && <div className="supplement-state">ยังไม่มีรายการอาหารเสริม<br /><small>แตะ “เลือกอาหารเสริม” เพื่อเริ่มจัดคอร์ส</small></div>}
    <div className="supplement-course-list">{orderedLines.map(line => { const price = calculateCourseLine(line.supplement.price, line.packageQuantity, line.discountType, line.discountValue); return <article key={line.lineId} className="supplement-course-card supplement-course-card-compact">
      <div className="supplement-card-head"><img src={line.supplement.imageUrl} alt="" /><div className="supplement-card-copy"><b>{line.supplement.name}</b><small>{line.supplement.contentQuantity} {line.supplement.contentUnit}</small><span>{displayProductPrice(line.supplement.price)} / ชิ้น</span></div><button type="button" onClick={() => setLines(current => current.filter(item => item.lineId !== line.lineId))} className="supplement-icon-danger" aria-label={`ลบ ${line.supplement.name}`}>✕</button></div>
      <div className="supplement-course-controls"><div className="supplement-control-block"><span className="supplement-control-label">จำนวน</span><div className="supplement-stepper"><button type="button" onClick={() => change(line.lineId, { packageQuantity: Math.max(1, line.packageQuantity - 1) })} disabled={line.packageQuantity <= 1}>−</button><strong>{line.packageQuantity}</strong><button type="button" onClick={() => change(line.lineId, { packageQuantity: line.packageQuantity + 1 })}>＋</button></div></div>
      <label className="supplement-control-block"><span className="supplement-control-label">ส่วนลด (1 ชิ้น)</span><select className="supplement-field" value={line.discountType} onChange={e => change(line.lineId, { discountType: e.target.value as DiscountType, discountValue: 0 })}>{discounts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {line.discountType === 'custom' && <label className="supplement-control-block"><span className="supplement-control-label">กำหนดส่วนลด (บาท)</span><input className="supplement-field" type="number" min="0" step="0.01" value={line.discountValue === 0 ? '' : line.discountValue} onChange={e => change(line.lineId, { discountValue: e.target.value === '' ? 0 : Number(e.target.value) })} /></label>}
      <div className="supplement-line-summary"><span><small>ก่อนลด</small>฿{money(price.grossAmount)}</span><span className="discount"><small>ส่วนลด</small>-฿{money(price.discountAmount)}</span><strong><small>สุทธิ</small>฿{money(price.netAmount)}</strong></div>
    </article>; })}</div>
    {!!lines.length && <div className="supplement-total"><div><span>ยอดก่อนส่วนลด</span><b>฿{money(totals.subtotal)}</b></div><div><span>ส่วนลดรวม</span><b className="supplement-discount-text">-฿{money(totals.discountTotal)}</b></div><div className="grand"><span>รวมสุทธิ</span><b>฿{money(totals.total)}</b></div>{cashbackAmount > 0 && <div className="supplement-cashback-row"><span>ได้เงินคืนภายหลัง ({cashbackPercent}%)</span><b>฿{money(cashbackAmount)}</b></div>}<button type="button" className="supplement-action supplement-action-primary" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button></div>}
  </div>;
}

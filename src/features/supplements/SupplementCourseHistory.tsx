import { useEffect, useState } from 'react';
import { supplementCoursesApi } from '../../utils/api';
import { openCoursePdfExternal } from './openCoursePdf';
import { formatCourseItemPriceQuantity } from './courseDetailDisplay';
import type { CourseTrainee, SavedSupplementCourse } from './types';

interface Props { trainees: CourseTrainee[]; refreshKey: number; normalizeCourse: (raw: any) => SavedSupplementCourse; }
const money = (value: number) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SupplementCourseHistory({ trainees, refreshKey, normalizeCourse }: Props) {
  const [traineeId, setTraineeId] = useState('');
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SavedSupplementCourse | null>(null);
  const [opening, setOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { let live = true; setLoading(true); supplementCoursesApi.list(traineeId || undefined).then(rows => { if (live) setCourses(rows); }).catch((error: any) => alert(error.message || 'โหลดประวัติไม่สำเร็จ')).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [traineeId, refreshKey]);
  const open = async (id: string) => { setOpening(true); try { setActive(normalizeCourse(await supplementCoursesApi.get(id))); } catch (error: any) { alert(error.message || 'เปิดประวัติไม่สำเร็จ'); } finally { setOpening(false); } };
  const download = async () => {
    if (!active) return;
    setDownloading(true);
    try { await openCoursePdfExternal(active.id); }
    catch (error: any) { alert(error.message || 'เปิดหน้าดาวน์โหลด PDF ไม่สำเร็จ กรุณาลองใหม่'); }
    finally { setDownloading(false); }
  };

  if (active) return <section className="supplement-screen">
    <div className="supplement-screen-header"><button type="button" className="supplement-back" onClick={() => setActive(null)}>←</button><div><h3>รายละเอียดคอร์ส</h3><p>{new Date(active.createdAt).toLocaleString('th-TH')}</p></div></div>
    <div className="supplement-person-card"><span>ลูกเทรน</span><b>{active.traineeName}</b><small>เทรนเนอร์ {active.trainerName}</small></div>
    <div className="supplement-snapshot-list">{active.items.map(item => <article key={item.id} className="supplement-snapshot-card"><img src={item.imageUrl} alt="" /><div className="supplement-card-copy"><b>{item.supplementName}</b><small>{item.contentQuantity} {item.contentUnit}</small><span>{formatCourseItemPriceQuantity(item.unitPrice, item.packageQuantity)}</span>{Number(item.discountAmount || 0) > 0 && <span className="supplement-item-discount">ลด ฿{money(item.discountAmount)}</span>}</div><strong>฿{money(item.netAmount)}</strong></article>)}</div>
    <div className="supplement-total"><div><span>ยอดก่อนส่วนลด</span><b>฿{money(active.subtotal)}</b></div>{Number(active.discountTotal || 0) > 0 && <div><span>ส่วนลดรวม</span><b className="supplement-discount-text">-฿{money(active.discountTotal)}</b></div>}<div className="grand"><span>รวมสุทธิ</span><b>฿{money(active.total)}</b></div>{Number(active.cashbackAmount || 0) > 0 && <div className="supplement-cashback-row"><span>ได้เงินคืนภายหลัง ({Number(active.cashbackPercent)}%)</span><b>฿{money(active.cashbackAmount)}</b></div>}<button className="supplement-action supplement-action-primary" onClick={download} disabled={downloading}>{downloading ? 'กำลังเปิดหน้าดาวน์โหลด...' : 'ดาวน์โหลด PDF'}</button></div>
  </section>;

  return <div>
    <label className="supplement-label">กรองตามลูกเทรน</label><select className="supplement-field" value={traineeId} onChange={e => setTraineeId(e.target.value)}><option value="">ลูกเทรนทั้งหมด</option>{trainees.map(t => <option key={t.userId} value={t.userId}>{t.nickname}</option>)}</select>
    {loading ? <div className="supplement-state">กำลังโหลด...</div> : !courses.length ? <div className="supplement-state">ยังไม่มีประวัติคอร์ส</div> : <div className="supplement-history-list">{courses.map(course => <article key={course.id} className="supplement-history-card"><div className="supplement-history-top"><div><small>ลูกเทรน</small><b>{course.traineeName}</b></div><strong>฿{money(course.total)}</strong></div><div className="supplement-history-meta"><span>📅 {new Date(course.createdAt).toLocaleDateString('th-TH')}</span><span>📦 {course.itemCount} รายการ</span>{Number(course.cashbackAmount || 0) > 0 && <span>💰 คืน {Number(course.cashbackPercent)}% · ฿{money(course.cashbackAmount)}</span>}</div><button type="button" className="supplement-action supplement-action-secondary" onClick={() => open(course.id)} disabled={opening}>{opening ? 'กำลังเปิด...' : 'ดูรายละเอียด'}</button></article>)}</div>}
  </div>;
}

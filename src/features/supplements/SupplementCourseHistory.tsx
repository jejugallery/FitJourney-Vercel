import { useEffect, useState } from 'react';
import { supplementCoursesApi } from '../../utils/api';
import { downloadSupplementCoursePdf } from './coursePdf';
import type { CourseTrainee, SavedSupplementCourse } from './types';

interface Props { trainees: CourseTrainee[]; refreshKey: number; normalizeCourse: (raw: any) => SavedSupplementCourse; }
const money = (value: number) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SupplementCourseHistory({ trainees, refreshKey, normalizeCourse }: Props) {
  const [traineeId, setTraineeId] = useState('');
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SavedSupplementCourse | null>(null);

  useEffect(() => { let live = true; setLoading(true); supplementCoursesApi.list(traineeId || undefined).then(rows => { if (live) setCourses(rows); }).catch((error: any) => alert(error.message || 'โหลดประวัติไม่สำเร็จ')).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [traineeId, refreshKey]);
  const open = async (id: string) => { try { setActive(normalizeCourse(await supplementCoursesApi.get(id))); } catch (error: any) { alert(error.message || 'เปิดประวัติไม่สำเร็จ'); } };

  return <div>
    <select className="supplement-field" value={traineeId} onChange={e => setTraineeId(e.target.value)}><option value="">ลูกเทรนทั้งหมด</option>{trainees.map(t => <option key={t.userId} value={t.userId}>{t.nickname}</option>)}</select>
    {loading ? <p style={{ textAlign: 'center' }}>กำลังโหลด...</p> : !courses.length ? <p style={{ textAlign: 'center', color: '#94a3b8', padding: 28 }}>ยังไม่มีประวัติคอร์ส</p> : <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>{courses.map(course => <button key={course.id} type="button" onClick={() => open(course.id)} className="supplement-history-card"><div><b>{course.traineeName}</b><div className="supplement-muted">{new Date(course.createdAt).toLocaleString('th-TH')} · {course.itemCount} รายการ</div></div><b style={{ color: '#ff416c' }}>฿{money(course.total)}</b></button>)}</div>}
    {active && <div className="supplement-detail-overlay" onClick={() => setActive(null)}><div className="supplement-detail" onClick={e => e.stopPropagation()}><button className="supplement-close" onClick={() => setActive(null)}>✕</button><h3>คอร์สของ {active.traineeName}</h3><div className="supplement-muted">{new Date(active.createdAt).toLocaleString('th-TH')}</div><div style={{ display: 'grid', gap: 9, marginTop: 16 }}>{active.items.map(item => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 9 }}><img src={item.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 9 }} /><div style={{ flex: 1 }}><b>{item.supplementName}</b><div className="supplement-muted">{item.packageQuantity} ชิ้น · ลด ฿{money(item.discountAmount)}</div></div><b>฿{money(item.netAmount)}</b></div>)}</div><div className="supplement-total"><div className="grand"><span>รวมสุทธิ</span><b>฿{money(active.total)}</b></div><button className="btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => downloadSupplementCoursePdf(active).catch(() => alert('สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่'))}>ดาวน์โหลด PDF</button></div></div></div>}
  </div>;
}

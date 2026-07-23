import { useCallback, useEffect, useState } from 'react';
import { supplementsApi } from '../utils/api';
import SupplementCatalogPanel from '../features/supplements/SupplementCatalogPanel';
import SupplementCourseForm from '../features/supplements/SupplementCourseForm';
import SupplementCourseHistory from '../features/supplements/SupplementCourseHistory';
import type { CourseTrainee, SavedSupplementCourse, Supplement } from '../features/supplements/types';

interface Props { onClose: () => void; trainees: CourseTrainee[]; isSuperadmin: boolean; }
type Tab = 'course' | 'history' | 'catalog';

const numberFields = ['price', 'contentQuantity', 'subtotal', 'discountTotal', 'total', 'cashbackPercent', 'cashbackAmount', 'unitPrice', 'packageQuantity', 'discountValue', 'grossAmount', 'discountAmount', 'netAmount', 'sortOrder'];
const numbers = (obj: any): any => Array.isArray(obj) ? obj.map(numbers) : obj && typeof obj === 'object' ? Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, numberFields.includes(key) ? Number(value) : numbers(value)])) : obj;

export default function SupplementCourseModal({ onClose, trainees, isSuperadmin }: Props) {
  const [tab, setTab] = useState<Tab>('course');
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyKey, setHistoryKey] = useState(0);
  const load = useCallback(async () => { setLoading(true); setError(''); try { setSupplements(numbers(await supplementsApi.list(isSuperadmin))); } catch (err: any) { setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'); } finally { setLoading(false); } }, [isSuperadmin]);
  useEffect(() => { load(); const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, [load]);
  const normalizeCourse = useCallback((raw: any) => numbers(raw) as SavedSupplementCourse, []);
  const saved = async () => { setHistoryKey(key => key + 1); };

  return <div className="supplement-modal-backdrop" onClick={onClose}><div className="supplement-modal" onClick={event => event.stopPropagation()}><button type="button" className="supplement-close" onClick={onClose}>✕</button><h2 style={{ margin: '0 45px 14px 0' }}>จัดคอร์สอาหารเสริม</h2>
    <div className="supplement-tabs"><button className={tab === 'course' ? 'active' : ''} onClick={() => setTab('course')}>จัดคอร์ส</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>ประวัติคอร์ส</button>{isSuperadmin && <button className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>คลังอาหารเสริม</button>}</div>
    {loading ? <p style={{ textAlign: 'center', padding: 30 }}>กำลังโหลด...</p> : error ? <div style={{ textAlign: 'center', padding: 30, color: '#dc2626' }}>{error}<br /><button onClick={load} style={{ marginTop: 10 }}>ลองใหม่</button></div> : tab === 'course' ? <SupplementCourseForm trainees={trainees} supplements={supplements.filter(item => item.isActive)} onSaved={saved} /> : tab === 'history' ? <SupplementCourseHistory trainees={trainees} refreshKey={historyKey} normalizeCourse={normalizeCourse} /> : <SupplementCatalogPanel supplements={supplements} onRefresh={load} />}
  </div></div>;
}

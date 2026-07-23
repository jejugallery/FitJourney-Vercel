import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { downloadSupplementCoursePdf } from '../features/supplements/coursePdf';
import type { SavedSupplementCourse } from '../features/supplements/types';
import { supplementCoursesApi } from '../utils/api';

const numberFields = new Set(['subtotal', 'discountTotal', 'total', 'cashbackPercent', 'cashbackAmount', 'contentQuantity', 'unitPrice', 'packageQuantity', 'discountValue', 'grossAmount', 'discountAmount', 'netAmount', 'sortOrder']);
const normalize = (value: any): any => Array.isArray(value)
  ? value.map(normalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, numberFields.has(key) ? Number(entry) : normalize(entry)]))
    : value;

export default function SupplementCoursePdfPage() {
  const [searchParams] = useSearchParams();
  const [course, setCourse] = useState<SavedSupplementCourse | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const token = searchParams.get('token') || '';

  useEffect(() => {
    if (!token) { setError('ลิงก์ดาวน์โหลดไม่ถูกต้องหรือหมดอายุแล้ว'); return; }
    supplementCoursesApi.getByPdfToken(token)
      .then(data => setCourse(normalize(data)))
      .catch(() => setError('ลิงก์ดาวน์โหลดไม่ถูกต้องหรือหมดอายุแล้ว กรุณากลับไปที่ประวัติคอร์สเพื่อสร้างลิงก์ใหม่'));
  }, [token]);

  const download = async () => {
    if (!course) return;
    setDownloading(true);
    setError('');
    try {
      await downloadSupplementCoursePdf(course);
    } catch {
      setError('สร้าง PDF ไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setDownloading(false);
    }
  };

  return <main className="supplement-pdf-page">
    <section className="supplement-pdf-panel">
      <div className="supplement-pdf-icon">PDF</div>
      <h1>ดาวน์โหลดคอร์สอาหารเสริม</h1>
      {!course && !error && <p>กำลังเตรียมข้อมูลคอร์ส...</p>}
      {error && <p className="supplement-pdf-error">{error}</p>}
      {course && <><div className="supplement-pdf-course"><span>ลูกเทรน</span><b>{course.traineeName}</b><small>{new Date(course.createdAt).toLocaleString('th-TH')}</small></div><button type="button" className="supplement-action supplement-action-primary" onClick={download} disabled={downloading}>{downloading ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}</button></>}
    </section>
  </main>;
}

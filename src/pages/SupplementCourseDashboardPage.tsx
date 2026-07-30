import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import type { SavedSupplementCourse } from '../features/supplements/types';
import { supplementCoursesApi } from '../utils/api';
import { orderSupplementProducts } from '../features/supplements/productOrder';
import { formatCourseItemPriceQuantity } from '../features/supplements/courseDetailDisplay';

const numberFields = new Set(['subtotal', 'discountTotal', 'total', 'cashbackPercent', 'cashbackAmount', 'contentQuantity', 'unitPrice', 'packageQuantity', 'discountValue', 'grossAmount', 'discountAmount', 'netAmount', 'sortOrder']);
const normalize = (value: any): any => Array.isArray(value)
  ? value.map(normalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, numberFields.has(key) ? Number(entry) : normalize(entry)]))
    : value;
const money = (value: number) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SupplementCourseDashboardPage() {
  const [searchParams] = useSearchParams();
  const [course, setCourse] = useState<SavedSupplementCourse | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const token = searchParams.get('token') || '';
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) { setError('ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว'); return; }
    supplementCoursesApi.getByPdfToken(token)
      .then(data => setCourse(normalize(data)))
      .catch(() => setError('ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว กรุณากลับไปที่ประวัติคอร์สเพื่อสร้างลิงก์ใหม่'));
  }, [token]);

  const downloadImage = async () => {
    if (!course || !dashboardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, { scale: 2, useCORS: true, backgroundColor: '#f8fafc' });
      const link = document.createElement('a');
      link.download = `Course_${course.traineeName}_${new Date(course.createdAt).toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      alert('บันทึกรูปภาพไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    return <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', background: '#f1f5f9' }}>
      <div style={{ background: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ margin: '0 0 8px', color: '#1e293b' }}>เกิดข้อผิดพลาด</h2>
        <p style={{ color: '#64748b', margin: 0 }}>{error}</p>
      </div>
    </main>;
  }

  if (!course) {
    return <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f1f5f9' }}>
      <p style={{ color: '#64748b', fontSize: '1.2rem' }}>กำลังเตรียมข้อมูล Dashboard...</p>
    </main>;
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f1f5f9', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: '"Inter", "Google Sans", sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b', fontWeight: 700 }}>Course Dashboard</h1>
        <button 
          onClick={downloadImage} 
          disabled={downloading}
          style={{ 
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
            color: 'white', 
            border: 'none', 
            padding: '10px 20px', 
            borderRadius: '8px', 
            fontWeight: 600, 
            cursor: downloading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)',
            transition: 'all 0.2s ease',
            opacity: downloading ? 0.7 : 1
          }}>
          {downloading ? 'กำลังบันทึก...' : '📸 บันทึกเป็นรูปภาพ'}
        </button>
      </div>

      <div ref={dashboardRef} style={{ background: '#f8fafc', width: '100%', maxWidth: '800px', borderRadius: '24px', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', position: 'relative', overflow: 'hidden' }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px dashed #e2e8f0', paddingBottom: '24px', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: '2rem', color: '#0f172a', fontWeight: 800, letterSpacing: '-0.5px' }}>รายละเอียดคอร์ส</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>วันที่: {new Date(course.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', background: '#eff6ff', padding: '8px 16px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ลูกเทรน</span>
              <strong style={{ display: 'block', fontSize: '1.25rem', color: '#1d4ed8' }}>{course.traineeName}</strong>
            </div>
            <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '0.85rem' }}>โดย {course.trainerName}</p>
          </div>
        </div>

        {/* Items List */}
        <div style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
          {orderSupplementProducts(course.items, item => item.supplementName, item => item.unitPrice).map((item, idx) => (
            <div key={item.id || idx} style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '16px', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '12px', overflow: 'hidden', background: '#f8fafc', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                {item.imageUrl ? <img src={item.imageUrl} alt={item.supplementName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '1.5rem' }}>📦</div>}
              </div>
              <div style={{ flex: 1, marginLeft: '16px' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#1e293b', fontWeight: 600 }}>{item.supplementName}</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: '#64748b' }}>
                  <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>{item.contentQuantity} {item.contentUnit}</span>
                  <span>{formatCourseItemPriceQuantity(item.unitPrice, item.packageQuantity)}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>฿{money(item.netAmount)}</span>
                {Number(item.discountAmount || 0) > 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600, background: '#fef2f2', padding: '2px 6px', borderRadius: '4px', marginTop: '4px' }}>ลด ฿{money(item.discountAmount)}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totals Section */}
        <div style={{ background: 'linear-gradient(to right, #1e293b, #0f172a)', borderRadius: '20px', padding: '24px', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#cbd5e1', fontSize: '0.95rem' }}>ยอดก่อนส่วนลด</span>
            <span style={{ fontSize: '1.1rem' }}>฿{money(course.subtotal)}</span>
          </div>
          {Number(course.discountTotal || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', color: '#fca5a5' }}>
              <span style={{ fontSize: '0.95rem' }}>ส่วนลดรวม</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>-฿{money(course.discountTotal)}</span>
            </div>
          )}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '16px 0' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: Number(course.cashbackAmount || 0) > 0 ? '16px' : '0' }}>
            <span style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 600 }}>ยอดรวมสุทธิ</span>
            <span style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: '#38bdf8' }}>฿{money(course.total)}</span>
          </div>
          
          {Number(course.cashbackAmount || 0) > 0 && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px 16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <span style={{ color: '#6ee7b7', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1.2rem' }}>💸</span> ได้เงินคืนภายหลัง ({Number(course.cashbackPercent)}%)
              </span>
              <span style={{ color: '#34d399', fontSize: '1.1rem', fontWeight: 700 }}>฿{money(course.cashbackAmount)}</span>
            </div>
          )}
        </div>
        
        {/* Footer Branding */}
        <div style={{ textAlign: 'center', marginTop: '32px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>
          Generated by FitJourney Thailand
        </div>
      </div>
    </main>
  );
}

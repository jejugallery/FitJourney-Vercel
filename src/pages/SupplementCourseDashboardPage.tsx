import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import type { SavedSupplementCourse } from '../features/supplements/types';
import { supplementCoursesApi } from '../utils/api';
import { orderSupplementProducts } from '../features/supplements/productOrder';


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
      <div style={{ width: '100%', maxWidth: '1400px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
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

      <div ref={dashboardRef} style={{ background: '#f8fafc', width: '100%', maxWidth: '1400px', borderRadius: '24px', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', position: 'relative', overflow: 'hidden', display: 'flex', gap: '40px', alignItems: 'stretch' }}>
        
        {/* Left Column: Info & Totals */}
        <div style={{ flex: '0 0 380px', display: 'flex', flexDirection: 'column' }}>
          {/* Header Section */}
          <div style={{ borderBottom: '2px dashed #e2e8f0', paddingBottom: '24px', marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '2rem', color: '#0f172a', fontWeight: 800, letterSpacing: '-0.5px' }}>รายละเอียดคอร์ส</h2>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '0.95rem' }}>วันที่: {new Date(course.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            
            <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '16px', border: '1px solid #bfdbfe' }}>
              <span style={{ display: 'block', fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ลูกเทรน</span>
              <strong style={{ display: 'block', fontSize: '1.4rem', color: '#1d4ed8', margin: '4px 0' }}>{course.traineeName}</strong>
              <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '0.9rem', borderTop: '1px solid #bfdbfe', paddingTop: '8px' }}>ดูแลโดย: <b>{course.trainerName}</b></p>
            </div>
          </div>

          {/* Totals Section */}
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', position: 'relative', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ color: '#64748b', fontSize: '0.95rem' }}>ยอดก่อนส่วนลด</span>
              <span style={{ fontSize: '1.1rem', color: '#1e293b', fontWeight: 600 }}>฿{money(course.subtotal)}</span>
            </div>
            {Number(course.discountTotal || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', color: '#ef4444' }}>
                <span style={{ fontSize: '0.95rem' }}>ส่วนลดรวม</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>-฿{money(course.discountTotal)}</span>
              </div>
            )}
            <div style={{ height: '1px', background: '#e2e8f0', margin: '16px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: Number(course.cashbackAmount || 0) > 0 ? '16px' : '0' }}>
              <span style={{ color: '#0f172a', fontSize: '1.1rem', fontWeight: 700 }}>ยอดรวมสุทธิ</span>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1, color: '#2563eb' }}>฿{money(course.total)}</span>
            </div>
            
            {Number(course.cashbackAmount || 0) > 0 && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px 16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <span style={{ color: '#059669', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <span style={{ fontSize: '1.2rem' }}>💸</span> ได้เงินคืนภายหลัง ({Number(course.cashbackPercent)}%)
                </span>
                <span style={{ color: '#047857', fontSize: '1.1rem', fontWeight: 800 }}>฿{money(course.cashbackAmount)}</span>
              </div>
            )}
          </div>
          
          {/* Footer Branding */}
          <div style={{ textAlign: 'center', marginTop: '24px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
            Generated by FitJourney Thailand
          </div>
        </div>

        {/* Right Column: Items List */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignContent: 'start' }}>
            {orderSupplementProducts(course.items, item => item.supplementName, item => item.unitPrice).map((item, idx) => (
              <div key={item.id || idx} style={{ display: 'flex', flexDirection: 'column', background: 'white', padding: '16px', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '10px', overflow: 'hidden', background: '#f8fafc', flexShrink: 0, border: '1px solid #e2e8f0', position: 'relative' }}>
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.supplementName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '1.2rem' }}>📦</div>}
                    <div style={{ position: 'absolute', top: '0', right: '0', background: '#ef4444', color: 'white', fontSize: '0.8rem', fontWeight: 800, padding: '2px 6px', borderBottomLeftRadius: '8px', lineHeight: 1, boxShadow: '-2px 2px 4px rgba(0,0,0,0.2)' }}>
                      x{item.packageQuantity}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#1e293b', fontWeight: 700, lineHeight: 1.3 }}>{item.supplementName}</h4>
                    <span style={{ display: 'inline-block', background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 500 }}>{item.contentQuantity} {item.contentUnit}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', borderTop: '1px dashed #e2e8f0', paddingTop: '12px' }}>
                  <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    {Number(item.unitPrice || 0) === 0 ? 'ฟรี' : `฿${money(item.unitPrice)}`} / ชิ้น
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {Number(item.discountAmount || 0) > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600, background: '#fef2f2', padding: '2px 6px', borderRadius: '4px', marginBottom: '4px', display: 'inline-block' }}>ลด ฿{money(item.discountAmount)}</div>
                    )}
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>฿{money(item.netAmount)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}

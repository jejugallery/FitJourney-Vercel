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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
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
      const el = dashboardRef.current;
      const originalWidth = el.style.width;
      const originalMaxWidth = el.style.maxWidth;
      
      // Force desktop width during capture to prevent mobile layout clipping
      el.style.width = '1200px';
      el.style.maxWidth = '1200px';

      const canvas = await html2canvas(el, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#f8fafc',
        windowWidth: 1200
      });

      // Restore original styles
      el.style.width = originalWidth;
      el.style.maxWidth = originalMaxWidth;
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `Course_${course.traineeName}.png`;

      canvas.toBlob(async (blob) => {
        let shared = false;
        if (blob && navigator.share && navigator.canShare) {
          const file = new File([blob], fileName, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ files: [file], title: 'ใบสรุปคอร์ส' });
              shared = true;
            } catch (e) {
              console.log('Share API failed or cancelled', e);
            }
          }
        }

        if (!shared) {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
          if (isIOS) {
            setPreviewImage(dataUrl);
          } else {
            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }
        setDownloading(false);
      }, 'image/png');
    } catch (err) {
      console.error(err);
      alert('บันทึกรูปภาพไม่สำเร็จ กรุณาลองอีกครั้ง');
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
      <style>{`
        .mobile-placeholder {
          display: none;
        }
        @media (max-width: 1024px) {
          .desktop-only-dashboard {
            position: absolute !important;
            left: -10000px !important;
            top: 0 !important;
          }
          .mobile-placeholder {
            display: flex !important;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: white;
            padding: 48px 24px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
            width: 100%;
            max-width: 500px;
            margin: 60px auto 0;
            border: 1px dashed #cbd5e1;
          }
          .header-title-container {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }
        }
      `}</style>

      <div className="header-title-container" style={{ width: '100%', maxWidth: '1400px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b', fontWeight: 700 }}>Course Dashboard</h1>
        <button 
          onClick={downloadImage} 
          disabled={downloading}
          style={{ 
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
            color: 'white', 
            border: 'none', 
            padding: '12px 24px', 
            borderRadius: '12px', 
            fontWeight: 700,
            fontSize: '1.1rem',
            cursor: downloading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)',
            transition: 'all 0.2s ease',
            opacity: downloading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
          {downloading ? 'กำลังบันทึก...' : '📸 บันทึกเป็นรูปภาพ'}
        </button>
      </div>

      <div className="mobile-placeholder">
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🖼️</div>
        <h2 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '1.4rem' }}>พร้อมบันทึกใบสรุปคอร์ส</h2>
        <p style={{ color: '#64748b', margin: 0, lineHeight: 1.5 }}>
          คุณสามารถกดปุ่ม <b>"บันทึกเป็นรูปภาพ"</b> <br/>เพื่อสร้างภาพใบสรุปคอร์สฉบับเต็มได้ทันที
        </p>
      </div>

      <div className="desktop-only-dashboard">
        <div ref={dashboardRef} style={{ background: '#f8fafc', width: '100%', maxWidth: '1400px', borderRadius: '24px', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', position: 'relative', overflow: 'hidden', display: 'flex', gap: '40px', alignItems: 'stretch' }}>
        
        {/* Left Column: Info & Totals */}
        <div style={{ flex: '0 0 380px', display: 'flex', flexDirection: 'column' }}>
          {/* Header Section */}
          <div style={{ borderBottom: '2px dashed #e2e8f0', paddingBottom: '24px', marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '2rem', color: '#0f172a', fontWeight: 800, letterSpacing: '-0.5px' }}>ใบสรุปคอร์ส</h2>
            
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
        </div>

        {/* Right Column: Items List */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {(() => {
            const allItems = orderSupplementProducts(course.items, item => item.supplementName, item => item.unitPrice);
            const paidItems = allItems.filter(item => Number(item.unitPrice || 0) > 0);
            return (
              <div style={{ display: 'grid', gridTemplateColumns: paidItems.length > 9 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: '16px', alignContent: 'start' }}>
                {paidItems.map((item, idx) => (
                  <div key={item.id || idx} style={{ display: 'flex', flexDirection: 'column', background: 'white', padding: '16px', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-1px', right: '-1px', background: '#ef4444', color: 'white', fontSize: '0.9rem', fontWeight: 800, padding: '4px 10px', borderRadius: '0 16px 0 16px', lineHeight: 1, boxShadow: '-2px 2px 4px rgba(0,0,0,0.1)' }}>
                  x{item.packageQuantity}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px', paddingRight: '24px' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '10px', overflow: 'hidden', background: '#f8fafc', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.supplementName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '1.2rem' }}>📦</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#1e293b', fontWeight: 700, lineHeight: 1.3 }}>{item.supplementName}</h4>
                    <span style={{ display: 'inline-block', background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 500 }}>{item.contentQuantity} {item.contentUnit}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', borderTop: '1px dashed #e2e8f0', paddingTop: '12px' }}>
                  <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    ฿{money(item.unitPrice)} / ชิ้น
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
          );
        })()}

          {course.items.some(item => Number(item.unitPrice || 0) === 0) && (() => {
            const freeItems = course.items.filter(item => Number(item.unitPrice || 0) === 0);
            const totalFreeValue = freeItems.reduce((sum, item) => {
              const m = item.supplementName.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?/g);
              const price = m ? Number(m[m.length - 1].replace(/,/g, '')) : 0;
              return sum + (price * Number(item.packageQuantity || 1));
            }, 0);

            return (
              <div style={{ marginTop: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🎁</span> รายการของแถม (ฟรี)
                  </h3>
                  {totalFreeValue > 0 && (
                    <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '6px 16px', borderRadius: '24px', fontSize: '0.95rem', fontWeight: 600, boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)' }}>
                      มูลค่ารวม <span style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 4px' }}>{money(totalFreeValue)}</span> บาท
                    </div>
                  )}
                </div>
                {(() => {
                  const paidCount = course.items.filter(item => Number(item.unitPrice || 0) > 0).length;
                  return (
                  <div style={{ display: 'grid', gridTemplateColumns: paidCount > 9 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: '16px', alignContent: 'start' }}>
                    {orderSupplementProducts(freeItems, item => item.supplementName, item => item.unitPrice)
                      .map((item, idx) => (
                    <div key={item.id || idx} style={{ display: 'flex', flexDirection: 'column', background: '#ecfdf5', padding: '16px', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #a7f3d0', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '-1px', right: '-1px', background: '#10b981', color: 'white', fontSize: '0.9rem', fontWeight: 800, padding: '4px 10px', borderRadius: '0 16px 0 16px', lineHeight: 1, boxShadow: '-2px 2px 4px rgba(16,185,129,0.2)' }}>
                        x{item.packageQuantity}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px', paddingRight: '24px' }}>
                        <div style={{ width: '50px', height: '50px', borderRadius: '10px', overflow: 'hidden', background: 'white', flexShrink: 0, border: '1px solid #a7f3d0' }}>
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.supplementName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a7f3d0', fontSize: '1.2rem' }}>📦</div>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#064e3b', fontWeight: 700, lineHeight: 1.3 }}>{item.supplementName}</h4>
                          <span style={{ display: 'inline-block', background: 'white', color: '#047857', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, border: '1px solid #d1fae5' }}>{item.contentQuantity} {item.contentUnit}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                );
              })()}
              </div>
            );
          })()}
        </div>
        </div>
      </div>

      {previewImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ color: 'white', marginBottom: '16px', fontSize: '1.2rem', fontWeight: 600 }}>
            👇 แตะค้างที่รูปภาพเพื่อบันทึก
          </div>
          <img src={previewImage} style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '12px', objectFit: 'contain' }} alt="Course Preview" />
          <button 
            onClick={() => setPreviewImage(null)}
            style={{ marginTop: '24px', background: 'white', color: '#1e293b', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          >
            ปิด
          </button>
        </div>
      )}
    </main>
  );
}

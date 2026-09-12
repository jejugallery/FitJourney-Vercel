import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import type { SavedCourseItem, SavedSupplementCourse } from '../features/supplements/types';
import { supplementCoursesApi } from '../utils/api';
import { orderSupplementProducts } from '../features/supplements/productOrder';

const numberFields = new Set(['subtotal', 'discountTotal', 'total', 'cashbackPercent', 'cashbackAmount', 'contentQuantity', 'unitPrice', 'packageQuantity', 'discountValue', 'grossAmount', 'discountAmount', 'netAmount', 'sortOrder']);
const normalize = (value: any): any => Array.isArray(value)
  ? value.map(normalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, numberFields.has(key) ? Number(entry) : normalize(entry)]))
    : value;
const money = (value: number) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function CardScalerWrapper({
  children,
  innerRef,
  background = '#f8fafc',
}: {
  children: React.ReactNode;
  innerRef: (el: HTMLDivElement | null) => void;
  background?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setScale(Math.min(w / 1000, 1));
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        maxWidth: '1000px',
        height: `${1400 * scale}px`,
        position: 'relative',
        marginBottom: '32px',
      }}
    >
      <div
        ref={innerRef}
        style={{
          width: '1000px',
          height: '1400px',
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center',
          background,
          borderRadius: '28px',
          padding: '48px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontFamily: '"Inter", "Google Sans", sans-serif',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function SupplementCourseDashboardPage() {
  const [searchParams] = useSearchParams();
  const [course, setCourse] = useState<SavedSupplementCourse | null>(null);
  const [courseTitle, setCourseTitle] = useState<string>('คอร์สลดน้ำหนัก');
  const [customTraineeName, setCustomTraineeName] = useState<string>('');
  const [customTrainerName, setCustomTrainerName] = useState<string>('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const token = searchParams.get('token') || '';
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!token) { setError('ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว'); return; }
    supplementCoursesApi.getByPdfToken(token)
      .then(data => {
        const norm = normalize(data);
        setCourse(norm);
        setCustomTraineeName(norm.traineeName || '');
        setCustomTrainerName(norm.trainerName || '');
      })
      .catch(() => setError('ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว กรุณากลับไปที่ประวัติคอร์สเพื่อสร้างลิงก์ใหม่'));
  }, [token]);

  const displayTraineeName = customTraineeName.trim() || course?.traineeName || '';
  const displayTrainerName = customTrainerName.trim() || course?.trainerName || '';

  const allItems = course ? orderSupplementProducts(course.items, item => item.supplementName, item => item.unitPrice) : [];
  const itemChunks: SavedCourseItem[][] = [];
  for (let i = 0; i < allItems.length; i += 5) {
    itemChunks.push(allItems.slice(i, i + 5));
  }
  const totalPages = itemChunks.length + 1; // Item pages + 1 separate Summary page

  const downloadImages = async () => {
    if (!course) return;
    setDownloading(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < totalPages; i++) {
        const el = pageRefs.current[i];
        if (!el) continue;

        const originalTransform = el.style.transform;
        const originalLeft = el.style.left;
        el.style.transform = 'none';
        el.style.left = '0px';

        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#f8fafc',
          width: 1000,
          height: 1400,
          windowWidth: 1000,
          windowHeight: 1400,
        });

        el.style.transform = originalTransform;
        el.style.left = originalLeft;
        const dataUrl = canvas.toDataURL('image/png');
        urls.push(dataUrl);
      }

      setPreviewImages(urls);

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (!isIOS) {
        urls.forEach((url, i) => {
          const isSummary = i === totalPages - 1;
          const link = document.createElement('a');
          const pageLabel = isSummary ? 'Summary' : `Page_${i + 1}`;
          link.download = `Course_${displayTraineeName}_${pageLabel}.png`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
      }
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
    <main style={{ minHeight: '100vh', background: '#f1f5f9', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: '"Inter", "Google Sans", sans-serif' }}>
      <style>{`
        .page-card-scaler {
          width: 1000px;
          maxWidth: 100%;
          aspectRatio: 5 / 7;
        }
        .header-edit-input:focus {
          background: rgba(255, 255, 255, 0.6) !important;
          border-radius: 8px !important;
        }
        @media (max-width: 1024px) {
          .header-title-container {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }
          .editors-panel {
            flex-direction: column;
            align-items: stretch !important;
          }
        }
      `}</style>

      {/* Top Header & Download Trigger */}
      <div className="header-title-container" style={{ width: '100%', maxWidth: '1000px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#1e293b', fontWeight: 800 }}>Course Dashboard (อัตราส่วน 5:7)</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.95rem' }}>ตัดทีละ 5 รายการ และรูปสรุปรวมราคาแยกอีกภาพ ({totalPages} รูปภาพ)</p>
        </div>
        <button 
          onClick={downloadImages} 
          disabled={downloading}
          style={{ 
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
            color: 'white', 
            border: 'none', 
            padding: '14px 28px', 
            borderRadius: '14px', 
            fontWeight: 800,
            fontSize: '1.1rem',
            cursor: downloading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)',
            transition: 'all 0.2s ease',
            opacity: downloading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
          {downloading ? 'กำลังสร้างรูปภาพ...' : '📸 ดาวน์โหลดรูปภาพ'}
        </button>
      </div>

      {/* Temporary On-Screen Editors Panel (does NOT update DB) */}
      <div className="editors-panel" style={{ width: '100%', maxWidth: '1000px', background: 'white', padding: '18px 24px', borderRadius: '20px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>✏️ หัวข้อรูปภาพ (ชั่วคราว):</label>
          <input
            type="text"
            value={courseTitle}
            onChange={e => setCourseTitle(e.target.value)}
            placeholder="พิมพ์หัวข้อ..."
            style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '1rem', fontWeight: 700, color: '#0f172a', outline: 'none' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>✏️ ชื่อลูกเทรน (ชั่วคราว):</label>
          <input
            type="text"
            value={customTraineeName}
            onChange={e => setCustomTraineeName(e.target.value)}
            placeholder="พิมพ์ชื่อลูกเทรน..."
            style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #3b82f6', fontSize: '1rem', fontWeight: 700, color: '#1d4ed8', outline: 'none', background: '#eff6ff' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>✏️ ชื่อเทรนเนอร์ (ชั่วคราว):</label>
          <input
            type="text"
            value={customTrainerName}
            onChange={e => setCustomTrainerName(e.target.value)}
            placeholder="พิมพ์ชื่อเทรนเนอร์..."
            style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '1rem', fontWeight: 700, color: '#0f172a', outline: 'none' }}
          />
        </div>

        {(courseTitle !== 'คอร์สลดน้ำหนัก' || customTraineeName !== course.traineeName || customTrainerName !== course.trainerName) && (
          <button 
            onClick={() => { setCourseTitle('คอร์สลดน้ำหนัก'); setCustomTraineeName(course.traineeName); setCustomTrainerName(course.trainerName); }}
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#64748b', padding: '10px 16px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
          >
            คืนค่าเดิม
          </button>
        )}
      </div>

      {/* Cards List Stack (5:7 ratio pages) */}
      <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Item Pages (5 items per page) */}
        {itemChunks.map((chunk, pageIndex) => (
          <CardScalerWrapper
            key={`page-${pageIndex}`}
            innerRef={el => { pageRefs.current[pageIndex] = el; }}
          >
            {/* Unified Single Header Frame (กรอบเดียวกัน) */}
            <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '22px', padding: '24px 28px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.05)' }}>
              {/* Top Row: Title + Page Indicator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ flex: 1, paddingRight: '16px' }}>
                  <h2 style={{
                    margin: 0,
                    fontSize: '2.1rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.5px',
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                    fontFamily: 'inherit'
                  }}>
                    {courseTitle || 'คอร์สลดน้ำหนัก'}
                  </h2>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', padding: '6px 18px', borderRadius: '16px', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0, boxShadow: '0 4px 6px -1px rgba(37,99,235,0.25)' }}>
                  หน้า {pageIndex + 1}/{totalPages}
                </div>
              </div>

              {/* Divider Line inside Frame */}
              <div style={{ height: '1.5px', background: '#bfdbfe', margin: '12px 0 16px 0' }}></div>

              {/* Bottom Row: Trainee + Trainer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, paddingRight: '20px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '2px' }}>ลูกเทรน</span>
                  <div style={{
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: '#1d4ed8',
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                    fontFamily: 'inherit'
                  }}>
                    {displayTraineeName || '-'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '2px' }}>เทรนเนอร์</span>
                  <b style={{ display: 'block', fontSize: '1.25rem', color: '#334155', fontWeight: 700, lineHeight: 1.4 }}>{displayTrainerName || '-'}</b>
                </div>
              </div>
            </div>

            {/* Items Chunk (Up to 5 items stacked from top) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'flex-start' }}>
              {chunk.map((item, idx) => {
                const isFree = Number(item.unitPrice || 0) === 0;
                const grossAmount = Number(item.grossAmount ?? (item.unitPrice * item.packageQuantity));
                const hasDiscount = Number(item.discountAmount || 0) > 0;

                return (
                  <div key={item.id || idx} style={{ background: isFree ? '#ecfdf5' : 'white', border: `1.5px solid ${isFree ? '#a7f3d0' : '#e2e8f0'}`, borderRadius: '24px', padding: '24px 28px', display: 'flex', alignItems: 'center', gap: '28px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
                    {/* Enlarged Product Image */}
                    <div style={{ width: '126px', height: '126px', borderRadius: '20px', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.imageUrl ? <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : <span style={{ fontSize: '3.5rem' }}>📦</span>}
                    </div>

                    {/* Product Title + Quantity right next to item name */}
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 10px', fontSize: '1.65rem', color: isFree ? '#064e3b' : '#0f172a', fontWeight: 800, lineHeight: 1.35 }}>
                        {item.supplementName}
                        <span style={{ color: isFree ? '#059669' : '#ff416c', fontWeight: 900, fontSize: '1.75rem', marginLeft: '12px', display: 'inline-block' }}>
                          × {item.packageQuantity}
                        </span>
                      </h3>
                      {!isFree && <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '1.05rem', padding: '6px 14px', borderRadius: '10px', fontWeight: 600 }}>฿{money(item.unitPrice)} / ชิ้น</span>}
                      {isFree && <span style={{ background: '#d1fae5', color: '#047857', fontSize: '1.05rem', padding: '6px 14px', borderRadius: '10px', fontWeight: 700 }}>🎁 ของแถมฟรี</span>}
                    </div>

                    {/* Prices */}
                    {!isFree && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {hasDiscount && <div style={{ fontSize: '1.05rem', color: '#94a3b8', textDecoration: 'line-through', fontWeight: 500 }}>฿{money(grossAmount)}</div>}
                        {hasDiscount && <div style={{ fontSize: '1.05rem', color: '#ef4444', fontWeight: 600 }}>ส่วนลด -฿{money(item.discountAmount)}</div>}
                        <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>฿{money(item.netAmount)}</div>
                      </div>
                    )}
                    {isFree && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#059669' }}>ฟรี</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.95rem' }}>
              <span>📅 {new Date(course.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span>FitJourney Health & Wellness</span>
            </div>
          </CardScalerWrapper>
        ))}

        {/* Separate Summary Page Card */}
        <CardScalerWrapper
          key="summary-page"
          innerRef={el => { pageRefs.current[itemChunks.length] = el; }}
        >
          {/* Summary Page Unified Single Header Frame */}
          <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', color: 'white', borderRadius: '22px', padding: '24px 28px', marginBottom: '24px', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.25)' }}>
            {/* Top Row: Title + Page Indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ flex: 1, paddingRight: '16px' }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '2.1rem',
                  fontWeight: 800,
                  color: 'white',
                  letterSpacing: '-0.5px',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                  fontFamily: 'inherit'
                }}>
                  {courseTitle || 'คอร์สลดน้ำหนัก'}
                </h2>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white', padding: '6px 18px', borderRadius: '16px', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0, backdropFilter: 'blur(4px)' }}>
                หน้า {totalPages}/{totalPages}
              </div>
            </div>

            {/* Divider Line inside Frame */}
            <div style={{ height: '1.5px', background: 'rgba(255, 255, 255, 0.25)', margin: '12px 0 16px 0' }}></div>

            {/* Bottom Row: Trainee + Trainer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, paddingRight: '20px' }}>
                <span style={{ fontSize: '0.85rem', color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '2px' }}>ลูกเทรน</span>
                <div style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: 'white',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                  fontFamily: 'inherit'
                }}>
                  {displayTraineeName || '-'}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ fontSize: '0.85rem', color: '#93c5fd', fontWeight: 600, display: 'block', marginBottom: '2px' }}>เทรนเนอร์</span>
                <b style={{ display: 'block', fontSize: '1.25rem', color: 'white', fontWeight: 700, lineHeight: 1.4 }}>{displayTrainerName || '-'}</b>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', justifyContent: 'center' }}>
            {/* Items List Overview */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '24px 32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#1e293b', fontWeight: 700 }}>📦 รายการสินค้าทั้งหมด</h3>
                <span style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 800, padding: '6px 16px', borderRadius: '12px', fontSize: '1.1rem' }}>
                  {course.items.length} รายการ ({course.items.reduce((sum, item) => sum + Number(item.packageQuantity || 1), 0)} ชิ้น)
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {allItems.map((item, idx) => (
                  <span key={item.id || idx} style={{ background: Number(item.unitPrice || 0) === 0 ? '#ecfdf5' : '#f8fafc', color: Number(item.unitPrice || 0) === 0 ? '#047857' : '#334155', border: `1px solid ${Number(item.unitPrice || 0) === 0 ? '#a7f3d0' : '#cbd5e1'}`, padding: '6px 14px', borderRadius: '10px', fontSize: '1rem', fontWeight: 600 }}>
                    {item.supplementName} <strong style={{ color: Number(item.unitPrice || 0) === 0 ? '#059669' : '#ff416c' }}>×{item.packageQuantity}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Financial Summary Card */}
            <div style={{ background: 'white', border: '2px solid #bfdbfe', borderRadius: '24px', padding: '36px 40px', boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.08)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.25rem', color: '#64748b' }}>
                <span>ยอดก่อนส่วนลด</span>
                <strong style={{ color: '#1e293b', fontWeight: 700 }}>฿{money(course.subtotal)}</strong>
              </div>

              {Number(course.discountTotal || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.25rem', color: '#ef4444' }}>
                  <span>ส่วนลดรวม</span>
                  <strong style={{ fontWeight: 700 }}>-฿{money(course.discountTotal)}</strong>
                </div>
              )}

              <div style={{ height: '2px', background: '#e2e8f0', margin: '4px 0' }}></div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.5rem', color: '#0f172a', fontWeight: 800 }}>ยอดรวมสุทธิ</span>
                <span style={{ fontSize: '3.2rem', color: '#2563eb', fontWeight: 900, lineHeight: 1 }}>฿{money(course.total)}</span>
              </div>

              {Number(course.cashbackAmount || 0) > 0 && (
                <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '16px', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <span style={{ color: '#059669', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>💸</span> ได้เงินคืนภายหลัง ({Number(course.cashbackPercent)}%)
                  </span>
                  <strong style={{ color: '#047857', fontSize: '1.5rem', fontWeight: 800 }}>฿{money(course.cashbackAmount)}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.95rem' }}>
            <span>📅 วันที่ออกเอกสาร: {new Date(course.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>ขอบคุณที่ไว้วางใจ FitJourney 💙</span>
          </div>
        </CardScalerWrapper>
      </div>

      {/* Generated Images Preview Modal */}
      {previewImages.length > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ color: 'white', marginBottom: '16px', fontSize: '1.3rem', fontWeight: 700, textAlign: 'center' }}>
            📸 สร้างรูปภาพอัตราส่วน 5:7 สำเร็จ ({previewImages.length} ภาพ) <br />
            <small style={{ fontWeight: 400, fontSize: '0.95rem', color: '#cbd5e1' }}>👇 แตะค้างที่รูปภาพ หรือกดปุ่มด้านล่างเพื่อบันทึก</small>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', maxWidth: '1200px', maxHeight: '75vh', overflowY: 'auto', padding: '10px' }}>
            {previewImages.map((url, i) => {
              const isSummary = i === previewImages.length - 1;
              const label = isSummary ? 'รูปสรุปรวมราคา' : `รูปรายการสินค้า (${i * 5 + 1}-${Math.min((i + 1) * 5, allItems.length)})`;

              return (
                <div key={i} style={{ background: '#1e293b', padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', maxWidth: '320px' }}>
                  <span style={{ color: '#93c5fd', fontWeight: 700, fontSize: '0.95rem' }}>{label}</span>
                  <img src={url} alt={label} style={{ width: '100%', height: 'auto', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', aspectRatio: '5 / 7', objectFit: 'contain' }} />
                  <a href={url} download={`Course_${displayTraineeName}_${isSummary ? 'Summary' : `Page_${i + 1}`}.png`} style={{ background: '#3b82f6', color: 'white', textDecoration: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', width: '100%', textAlign: 'center' }}>
                    ⬇️ ดาวน์โหลดรูปนี้
                  </a>
                </div>
              );
            })}
          </div>

          <button 
            onClick={() => setPreviewImages([])}
            style={{ marginTop: '24px', background: 'white', color: '#1e293b', border: 'none', padding: '12px 32px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)' }}
          >
            ปิดหน้าต่าง
          </button>
        </div>
      )}
    </main>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { downloadICS } from '../utils/icsHelper';
import { eventsApi } from '../utils/api';

export default function DownloadICSPage() {
  const [searchParams] = useSearchParams();
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState('');
  const [eventDetails, setEventDetails] = useState<any>(null);
  const [fetching, setFetching] = useState(false);

  const eventId = searchParams.get('eventId') || '';

  const name = eventDetails?.name || searchParams.get('name') || 'กิจกรรม';
  const startDatetimeIso = eventDetails?.startDatetimeIso || searchParams.get('startDatetimeIso') || '';
  const endDatetimeIso = eventDetails?.endDatetimeIso || searchParams.get('endDatetimeIso') || '';
  const description = eventDetails?.description || searchParams.get('description') || '';
  const location = eventDetails?.location || searchParams.get('location') || '';

  useEffect(() => {
    if (eventId) {
      const fetchEvent = async () => {
        setFetching(true);
        try {
          const ev = await eventsApi.get(eventId);
          if (ev) {
            setEventDetails(ev);
            setError('');
          } else {
            setError('ไม่พบกิจกรรมที่ระบุ');
          }
        } catch (err: any) {
          console.error(err);
          setError('ไม่สามารถดึงข้อมูลกิจกรรมได้: ' + (err.message || err));
        } finally {
          setFetching(false);
        }
      };
      fetchEvent();
    }
  }, [eventId]);

  const triggerDownload = () => {
    if (fetching) return;
    if (!startDatetimeIso) {
      setError('ไม่พบวันเวลาเริ่มต้นของกิจกรรม');
      return;
    }
    try {
      downloadICS({
        name,
        startDatetimeIso,
        endDatetimeIso,
        description,
        location,
      });
      setDownloaded(true);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('เกิดข้อผิดพลาดในการดาวน์โหลด: ' + (err.message || err));
    }
  };

  useEffect(() => {
    if (startDatetimeIso) {
      // Auto-trigger download on mount or when data is loaded
      const timer = setTimeout(() => {
        triggerDownload();
      }, 800); // Small delay to let page mount and animate smoothly
      return () => clearTimeout(timer);
    }
  }, [startDatetimeIso, fetching]);

  useEffect(() => {
    if (downloaded) {
      const timer = setTimeout(() => {
        try {
          window.open('', '_self');
          window.close();
        } catch (e) {
          console.error('Failed to auto-close window:', e);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [downloaded]);

  const getStatusText = () => {
    if (error) return 'เกิดข้อผิดพลาด';
    if (fetching) return 'กำลังดึงข้อมูลกิจกรรม...';
    if (downloaded) return 'เตรียมไฟล์เรียบร้อย!';
    return 'กำลังเตรียมไฟล์ปฏิทิน...';
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      padding: '24px',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      color: '#1e293b'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '24px',
        padding: '40px 32px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        textAlign: 'center',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* Animated Calendar Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          boxShadow: '0 8px 16px rgba(30, 64, 175, 0.3)',
          marginBottom: '24px',
          transform: downloaded ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          📅
        </div>

        {/* Status Text */}
        <h2 style={{ fontSize: '1.4rem', margin: '0 0 12px 0', fontWeight: 700, color: '#1e1b4b' }}>
          {getStatusText()}
        </h2>

        <p style={{ fontSize: '0.95rem', color: '#475569', margin: '0 0 28px 0', lineHeight: 1.5 }}>
          {error 
            ? error 
            : fetching
              ? 'กรุณารอสักครู่ ระบบกำลังเรียกข้อมูลปฏิทินของกิจกรรมนี้...'
              : downloaded 
                ? 'ระบบเริ่มดาวน์โหลดไฟล์แล้ว หน้านี้จะปิดลงโดยอัตโนมัติ (หากหน้านี้ไม่ปิดตัวลง สามารถกดปิดแท็บหรือกดปุ่มปิดด้านล่างได้ทันที)' 
                : `กำลังสร้างไฟล์ .ics สำหรับกิจกรรม "${name}"`}
        </p>

        {/* Details card */}
        {!error && !fetching && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.6)',
            borderRadius: '16px',
            padding: '16px',
            width: '100%',
            marginBottom: '28px',
            textAlign: 'left',
            boxSizing: 'border-box',
            border: '1px solid rgba(226, 232, 240, 0.8)'
          }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#4f46e5', marginBottom: '4px' }}>
              📌 {name}
            </div>
            {location && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                📍 {location}
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          <button
            onClick={triggerDownload}
            style={{
              padding: '14px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
          >
            {downloaded ? 'ดาวน์โหลดไฟล์อีกครั้ง' : 'เริ่มดาวน์โหลดทันที'}
          </button>
          
          <button
            onClick={() => {
              try {
                window.open('', '_self');
                window.close();
              } catch (e) {
                console.error('Failed to close window:', e);
              }
            }}
            style={{
              padding: '14px',
              background: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
          >
            ปิดหน้านี้
          </button>
        </div>
      </div>
    </div>
  );
}

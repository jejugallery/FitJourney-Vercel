

import { createPortal } from 'react-dom';

interface SuccessPopupProps {
  show: boolean;
  message?: string;
}

export default function SuccessPopup({ show, message = 'สำเร็จ' }: SuccessPopupProps) {
  if (!show) return null;

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <style>{`
        @keyframes scaleUpSuccess {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .success-popup-anim {
          animation: scaleUpSuccess 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
      <div className="success-popup-anim" style={{ background: '#fff', padding: '2rem 3rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#22c55e', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontSize: '2.5rem' }}>
          ✓
        </div>
        <h3 style={{ margin: 0, color: '#334155', fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center' }}>{message}</h3>
      </div>
    </div>,
    document.body
  );
}

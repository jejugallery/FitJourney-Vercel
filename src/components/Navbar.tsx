import { useLiff } from '../context/LiffContext';

interface NavbarProps {
  showProfile?: boolean;
  onLogoClick?: () => void;
  onProfileClick?: () => void;
  onEventsClick?: () => void;
  onAppointmentsClick?: () => void;
  onBillingClick?: () => void;
  onKnowledgeClick?: () => void;
  notificationCount?: number;
  eventNotificationCount?: number;
  appointmentNotificationCount?: number;
  style?: React.CSSProperties;
  onBackClick?: () => void;
}

export default function Navbar({ 
  showProfile = false, 
  onLogoClick, 
  onProfileClick, 
  onEventsClick, 
  onBillingClick,
  onKnowledgeClick,
  notificationCount = 0, 
  eventNotificationCount = 0, 
  appointmentNotificationCount = 0,
  style, 
  onBackClick 
}: NavbarProps) {
  const { profile } = useLiff();
  const scheduleNotificationCount = eventNotificationCount + appointmentNotificationCount;

  return (
    <nav className="nav" style={{ justifyContent: showProfile ? 'space-between' : 'center', ...style }}>
      {onBackClick && (
        <div style={{ position: 'absolute', left: '15px', display: 'flex', alignItems: 'center' }}>
          <button 
            onClick={onBackClick}
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}
            title="กลับไปหน้าก่อนหน้า"
          >
            ←
          </button>
        </div>
      )}
      <div 
        className="logo" 
        style={{ userSelect: 'none', cursor: onLogoClick ? 'pointer' : 'default' }}
        title="FitJourney.th"
        onClick={onLogoClick}
      >
        FitJourney.th
      </div>

      {showProfile && profile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onEventsClick && (
            <div style={{ position: 'relative' }}>
              <div 
                onClick={onEventsClick}
                style={{ cursor: 'pointer', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #e2e8f0', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                title="กิจกรรม"
              >
                📅
              </div>
              {scheduleNotificationCount > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: 'red',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  {scheduleNotificationCount}
                </div>
              )}
            </div>
          )}
          {onBillingClick && (
            <div style={{ position: 'relative' }}>
              <div 
                onClick={onBillingClick}
                style={{ cursor: 'pointer', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #e2e8f0', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                title="รายการเรียกเก็บเงิน"
              >
                💵
              </div>
            </div>
          )}
          {onKnowledgeClick && (
            <div style={{ position: 'relative' }}>
              <div 
                onClick={onKnowledgeClick}
                style={{ cursor: 'pointer', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #e2e8f0', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                title="คลังความรู้"
              >
                📖
              </div>
            </div>
          )}
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: onProfileClick ? 'pointer' : 'default' }}
            onClick={onProfileClick}
          >
            <div style={{ position: 'relative' }}>
              <div 
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  background: '#f8fafc', 
                  border: `2px solid ${notificationCount > 0 ? '#ef4444' : '#e2e8f0'}`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '1.5rem',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s'
                }}
                title="ตรวจอาหาร"
              >
                🥗
              </div>
              {notificationCount > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: 'red',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  {notificationCount}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

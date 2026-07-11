import { useEffect } from 'react';

interface HealthKnowledgePlayerModalProps {
  videoUrl: string;
  title: string;
  category?: 'health' | 'business';
  onClose: () => void;
}

export default function HealthKnowledgePlayerModal({ videoUrl, title, category, onClose }: HealthKnowledgePlayerModalProps) {
  useEffect(() => {
    // Disable scrolling when the player is open
    const win = window as any;
    win.__activeScrollLocks = (win.__activeScrollLocks || 0) + 1;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      win.__activeScrollLocks = Math.max(0, (win.__activeScrollLocks || 0) - 1);
      if (win.__activeScrollLocks === 0) {
        document.body.style.overflow = 'unset';
        document.documentElement.style.overflow = 'unset';
      }
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.95)', // Deep slate/dark background
      backdropFilter: 'blur(8px)',
      zIndex: 20000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      {/* Main Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '400px', // Restrict width so it stays tall and narrow on desktop
        aspectRatio: '9/16', // Strict 9:16 aspect ratio
        backgroundColor: '#000',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            fontSize: '1.2rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            transition: 'all 0.2s',
            backdropFilter: 'blur(4px)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.8)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ✕
        </button>

        {/* Video Player */}
        {(() => {
          const isYoutube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
          if (isYoutube) {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
            const match = videoUrl.match(regExp);
            const ytId = (match && match[2].length === 11) ? match[2] : null;
            if (ytId) {
              const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`;
              return (
                <iframe
                  src={embedUrl}
                  title={title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    border: 'none'
                  }}
                />
              );
            }
          }
          return (
            <video
              src={videoUrl}
              autoPlay
              controls
              playsInline
              loop
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block'
              }}
            />
          );
        })()}

        {/* Title Overlay */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0) 100%)',
          padding: '24px 20px',
          color: '#fff',
          zIndex: 5,
          pointerEvents: 'none' // Don't block video controls interaction
        }}>
          <span style={{
            display: 'inline-block',
            backgroundColor: 'var(--primary)',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            padding: '4px 8px',
            borderRadius: '50px',
            marginBottom: '8px',
            boxShadow: '0 4px 6px -1px rgba(255, 65, 108, 0.3)'
          }}>
            {category === 'business' ? '💡 สื่อแนวคิดธุรกิจ' : '💡 สื่อความรู้สุขภาพ'}
          </span>
          <h3 style={{
            margin: 0,
            color: '#fff',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            lineHeight: '1.4',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {title}
          </h3>
        </div>
      </div>
    </div>
  );
}

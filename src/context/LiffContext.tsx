import React, { createContext, useContext, useEffect, useState } from 'react';
import liff from '@line/liff';
import { LIFF_IDS } from '../constants/liff';

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

interface LiffContextType {
  profile: LineProfile | null;
  loading: boolean;
  error: string | null;
  setMockProfile: (profile: LineProfile | null) => void;
  realProfile: LineProfile | null;
  mockProfile: LineProfile | null;
}

const LiffContext = createContext<LiffContextType>({
  profile: null,
  loading: true,
  error: null,
  setMockProfile: () => {},
  realProfile: null,
  mockProfile: null,
});

export const useLiff = () => useContext(LiffContext);

export const LiffProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<LineProfile | null>(null);
  const [mockProfile, setMockProfile] = useState<LineProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initLiff = async (isRetry = false) => {
      try {
        const path = window.location.pathname;
        let LIFF_ID = LIFF_IDS.DEFAULT;
        if (path.startsWith('/shareKnowledge')) {
          LIFF_ID = LIFF_IDS.SHARE_KNOWLEDGE;
        } else if (path.startsWith('/shareLink')) {
          // Links created for knowledge content use FYLbLMl2 and its
          // endpoint is /shareLink, so this page must initialize the same LIFF app.
          LIFF_ID = LIFF_IDS.SHARE_KNOWLEDGE;
        } else if (path.startsWith('/shareEvent')) {
          LIFF_ID = LIFF_IDS.SHARE_EVENT;
        }
        await liff.init({ liffId: LIFF_ID });
        
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const liffProfile = await liff.getProfile();
        setProfile({
          userId: liffProfile.userId,
          displayName: liffProfile.displayName,
          pictureUrl: liffProfile.pictureUrl,
        });
      } catch (err: any) {
        console.error("LIFF Init Error:", err);
        const errMsg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        
        if (!isRetry && (errMsg.includes("revoked") || errMsg.includes("expired") || errMsg.includes("token") || errMsg.includes("Revoked"))) {
          console.warn("LIFF Access token revoked/expired. Clearing storage and retrying...");
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.toLowerCase().includes("liff") || key.includes("2010284484"))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));

          const sessionKeysToRemove: string[] = [];
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (key.toLowerCase().includes("liff") || key.includes("2010284484"))) {
              sessionKeysToRemove.push(key);
            }
          }
          sessionKeysToRemove.forEach(k => sessionStorage.removeItem(k));

          try {
            liff.logout();
          } catch (e) {}

          await initLiff(true);
        } else {
          setError(`ไม่สามารถเชื่อมต่อระบบ LINE ได้ (Error: ${errMsg})`);
        }
      } finally {
        if (!isRetry) {
          setLoading(false);
        }
      }
    };

    initLiff();
  }, []);

  return (
    <LiffContext.Provider value={{ 
      profile: mockProfile || profile, 
      loading, 
      error, 
      setMockProfile, 
      realProfile: profile,
      mockProfile
    }}>
      {children}
    </LiffContext.Provider>
  );
};

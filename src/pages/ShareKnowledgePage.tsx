import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { healthKnowledgesApi } from '../utils/api';
import { LIFF_IDS, LIFF_URLS } from '../constants/liff';
import { useLiff } from '../context/LiffContext';
import liff from '@line/liff';

export default function ShareKnowledgePage() {
  const [searchParams] = useSearchParams();
  
  const getParamSafe = (name: string): string | null => {
    let val = searchParams.get(name);
    if (val) return val;

    const urlParams = new URLSearchParams(window.location.search);
    val = urlParams.get(name);
    if (val) return val;

    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    val = hashParams.get(name);
    if (val) return val;

    const liffState = urlParams.get('liff.state');
    if (liffState) {
      const decodedState = decodeURIComponent(liffState);
      const stateParams = new URLSearchParams(decodedState.split('?')[1] || decodedState);
      val = stateParams.get(name);
      if (val) return val;
    }

    return null;
  };

  const knowledgeId = getParamSafe('knowledgeId');
  
  const { loading: liffLoading, error: liffError } = useLiff();
  const statusText = 'กำลังเตรียมสื่อ กรุณารอสักครู่...';
  const [errorText, setErrorText] = useState<string | null>(null);
  const [hasShared, setHasShared] = useState(false);

  useEffect(() => {
    if (liffError) {
      setErrorText(liffError);
      return;
    }

    if (liffLoading) {
      return; // Wait until LIFF is initialized by LiffProvider
    }

    if (!knowledgeId) {
      setErrorText('ไม่พบรหัสคลังความรู้ (knowledgeId)');
      return;
    }

    if (hasShared) {
      return; // Prevent multiple invocations
    }

    const share = async () => {
      try {
        // LIFF is initialized. Ensure logged in.
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        // Fetch the knowledge item via REST API
        const rawData = await healthKnowledgesApi.get(knowledgeId);

        if (!rawData) {
          setErrorText('ไม่พบข้อมูลสื่อความรู้นี้ในระบบ');
          return;
        }

        const category = rawData.category;
        if (category === 'business') {
          const shareLinkUrl = new URL('/shareLink', window.location.origin);
          shareLinkUrl.searchParams.set('knowledgeId', knowledgeId);
          window.location.replace(shareLinkUrl.toString());
          return;
        }

        const data = {
          id: rawData.id,
          title: rawData.title,
          videoUrl: rawData.videoUrl || rawData.video_url,
          videoThumbnailUrl: rawData.videoThumbnailUrl || rawData.video_thumbnail_url,
          createdBy: rawData.createdBy || rawData.created_by,
          createdAt: rawData.createdAt || rawData.created_at,
          category,
          promoText: rawData.promoText || rawData.promo_text,
          isChallenge: rawData.isChallenge || rawData.is_challenge
        };

        // Construct Flex Message
        const liffUrl = `${LIFF_URLS.SHARE_LINK}?knowledgeId=${data.id}&liffId=${LIFF_IDS.SHARE_LINK}`;
        let flexMsg: any;

        if (data.category === 'business') {
          flexMsg = {
            type: "flex",
            altText: data.isChallenge ? `🏆 ฟังลิงก์ Challenge: ${data.title}` : `💡 แนวคิดธุรกิจ: ${data.title}`,
            contents: {
              type: "bubble",
              ...(data.isChallenge ? {
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#E11D48",
                  paddingAll: "sm",
                  contents: [
                    {
                      type: "text",
                      text: "ฟังลิงก์ Challenge",
                      color: "#FFFFFF",
                      weight: "bold",
                      size: "sm",
                      align: "center"
                    }
                  ]
                }
              } : {}),
              hero: {
                type: "image",
                url: data.videoThumbnailUrl || "https://i.ytimg.com/vi/placeholder/maxresdefault.jpg",
                size: "full",
                aspectRatio: "16:9",
                aspectMode: "cover",
                action: {
                  type: "uri",
                  uri: liffUrl
                }
              },
              body: {
                type: "box",
                layout: "vertical",
                spacing: "xs",
                contents: [
                  {
                    type: "text",
                    text: data.title,
                    weight: "bold",
                    size: "md",
                    wrap: true
                  },
                  ...((data.isChallenge || data.promoText) ? [
                    {
                      type: "separator",
                      margin: "md",
                      color: "#e2e8f0"
                    },
                    {
                      type: "text",
                      text: data.isChallenge 
                        ? "ชวนฟังลิงก์นี้ แชร์สิ่งที่ได้รับ ส่งต่อความฮอตให้เพื่อน ๆ ในกลุ่มกัน" 
                        : data.promoText,
                      size: "xs",
                      color: "#718096",
                      wrap: true,
                      margin: "md",
                      lineSpacing: "4px"
                    }
                  ] : [])
                ]
              },
              footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    spacing: "md",
                    alignItems: "center",
                    contents: [
                      {
                        type: "box",
                        layout: "vertical",
                        backgroundColor: "#FF416C",
                        cornerRadius: "xxl",
                        paddingAll: "10px",
                        flex: 1,
                        action: {
                          type: "uri",
                          label: "กดฟังเลยตอนนี้",
                          uri: data.isChallenge 
                            ? liffUrl
                            : (data.videoUrl ? (data.videoUrl.includes('?') ? `${data.videoUrl}&openExternalBrowser=1` : `${data.videoUrl}?openExternalBrowser=1`) : '')
                        },
                        contents: [
                          {
                            type: "text",
                            text: "กดฟังเลยตอนนี้",
                            color: "#ffffff",
                            weight: "bold",
                            size: "sm",
                            align: "center"
                          }
                        ]
                      },
                      ...(!data.isChallenge ? [
                        {
                          type: "image",
                          url: "https://cdn-icons-png.flaticon.com/512/9513/9513588.png",
                          size: "24px",
                          aspectRatio: "1:1",
                          flex: 0,
                          action: {
                            type: "uri",
                            label: "Share",
                            uri: liffUrl
                          }
                        }
                      ] : [])
                    ]
                  },
                  ...(data.isChallenge ? [
                    {
                      type: "box",
                      layout: "vertical",
                      backgroundColor: "#10B981",
                      cornerRadius: "xxl",
                      paddingAll: "10px",
                      margin: "sm",
                      action: {
                        type: "uri",
                        label: "แชร์สิ่งที่ได้",
                        uri: liffUrl
                      },
                      contents: [
                        {
                          type: "text",
                          text: "แชร์สิ่งที่ได้ 📝",
                          color: "#ffffff",
                          weight: "bold",
                          size: "sm",
                          align: "center"
                        }
                      ]
                    }
                  ] : [])
                ]
              }
            }
          };
        } else {
          flexMsg = {
            type: "flex",
            altText: `💡 ความรู้สุขภาพ: ${data.title}`,
            contents: {
              type: "bubble",
              hero: {
                type: "video",
                altContent: {
                  type: "image",
                  size: "full",
                  aspectRatio: "9:16",
                  aspectMode: "cover",
                  url: data.videoThumbnailUrl || "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png"
                },
                aspectRatio: "9:16",
                url: data.videoUrl,
                previewUrl: data.videoThumbnailUrl || "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png"
              },
              footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "จิ้มคลิปเพื่อเปิดเสียง",
                    align: "center",
                    color: "#cccccc",
                    size: "xxs",
                    weight: "bold"
                  },
                  {
                    type: "box",
                    layout: "horizontal",
                    justifyContent: "center",
                    contents: [
                      {
                        type: "box",
                        layout: "horizontal",
                        backgroundColor: "#FF416C",
                        cornerRadius: "30px",
                        paddingStart: "xl",
                        paddingEnd: "xl",
                        paddingTop: "md",
                        paddingBottom: "md",
                        action: {
                          type: "uri",
                          label: "ส่งต่อ ➦",
                          uri: liffUrl
                        },
                        contents: [
                          {
                            type: "text",
                            text: "ส่งต่อ ➦",
                            color: "#FFFFFF",
                            weight: "bold",
                            align: "center",
                            size: "md"
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          };
        }

        // Trigger target picker
        if (!liff.isApiAvailable('shareTargetPicker')) {
          setErrorText('บราวเซอร์หรืออุปกรณ์นี้ไม่รองรับการแชร์ (shareTargetPicker)');
          return;
        }

        setHasShared(true);
        const res = await liff.shareTargetPicker([flexMsg as any]);
        if (res) {
          liff.closeWindow();
        } else {
          liff.closeWindow();
        }
      } catch (err: any) {
        console.error("Error in ShareKnowledgePage:", err);
        const errMsg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        setErrorText(errMsg || 'เกิดข้อผิดพลาดในการโหลดหรือแชร์ข้อมูล');
      }
    };

    share();
  }, [knowledgeId, liffLoading, liffError, hasShared]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '20px', background: '#f8fafc', boxSizing: 'border-box', fontFamily: 'inherit'
    }}>
      <div style={{
        background: '#fff', padding: '30px 24px', borderRadius: '20px', width: '100%', maxWidth: '360px',
        textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.05)'
      }}>
        {errorText ? (
          <div>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 10px 0', color: '#dc2626', fontWeight: 'bold' }}>พบข้อผิดพลาด</h3>
            <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0 0 20px 0', lineHeight: 1.5 }}>{errorText}</p>
            <button
              onClick={() => {
                try {
                  liff.closeWindow();
                } catch (e) {
                  window.close();
                }
              }}
              style={{
                background: '#f1f5f9', color: '#475569', border: 'none', width: '100%', padding: '12px',
                borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              ปิดหน้าต่าง
            </button>
          </div>
        ) : (
          <div>
            {/* animated spinner */}
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', border: '3px solid #f1f5f9',
              borderTopColor: '#FF416C', animation: 'spin 1s linear infinite', margin: '0 auto 20px auto'
            }}></div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            
            <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontWeight: 'bold' }}>FitJourney.th</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{statusText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

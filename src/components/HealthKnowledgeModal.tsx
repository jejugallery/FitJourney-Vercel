import React, { useState, useEffect, useRef } from 'react';
import { healthKnowledgesApi } from '../utils/api';
import { LIFF_IDS, LIFF_URLS } from '../constants/liff';
import { uploadToImgBB } from '../utils/mediaHelper';
import HealthKnowledgePlayerModal from './HealthKnowledgePlayerModal';
import { AutoResizeTextarea } from './AutoResizeTextarea';

const formatKnowledgeDate = (createdAt: any) => {
  if (!createdAt) return '';
  try {
    if (createdAt.toDate) return createdAt.toDate().toLocaleDateString('th-TH');
    if (createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleDateString('th-TH');
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('th-TH');
  } catch (e) {
    console.error('Error formatting date:', e);
  }
  return '';
};

interface HealthKnowledgeModalProps {
  onClose: () => void;
  userId: string;
}

interface HealthKnowledgeItem {
  id: string;
  title: string;
  videoUrl: string;
  videoThumbnailUrl: string;
  createdBy: string;
  createdAt: any;
  category?: 'health' | 'business';
  promoText?: string;
  isChallenge?: boolean;
}

// Module-level global listener and cache to keep data in memory across mount/unmount cycles
let cachedItems: HealthKnowledgeItem[] = [];
let loadingCache = true;
const listeners: Array<(items: HealthKnowledgeItem[], loading: boolean) => void> = [];

const fetchGlobalItems = async () => {
  try {
    const listRaw = await healthKnowledgesApi.list();
    const list = listRaw.map((k: any) => ({
      id: k.id,
      title: k.title,
      videoUrl: k.videoUrl || k.video_url,
      videoThumbnailUrl: k.videoThumbnailUrl || k.video_thumbnail_url,
      createdBy: k.createdBy || k.created_by,
      createdAt: k.createdAt || k.created_at,
      category: k.category,
      promoText: k.promoText || k.promo_text,
      isChallenge: k.isChallenge || k.is_challenge
    }));
    cachedItems = list;
    loadingCache = false;
    listeners.forEach(listener => listener(list, false));
  } catch (err) {
    console.error("Error loading health knowledges globally:", err);
    loadingCache = false;
    listeners.forEach(listener => listener(cachedItems, false));
  }
};

fetchGlobalItems();
setInterval(fetchGlobalItems, 10000);

export default function HealthKnowledgeModal({ onClose, userId }: HealthKnowledgeModalProps) {
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [items, setItems] = useState<HealthKnowledgeItem[]>(cachedItems);
  const [loadingItems, setLoadingItems] = useState(loadingCache);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'health' | 'business'>('business');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [category, setCategory] = useState<'health' | 'business'>('health');
  const [promoText, setPromoText] = useState('');
  const [isChallenge, setIsChallenge] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverUploadedManually, setCoverUploadedManually] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<HealthKnowledgeItem | null>(null);

  // Player state
  const [activePlayerItem, setActivePlayerItem] = useState<HealthKnowledgeItem | null>(null);
  const [sharingItem, setSharingItem] = useState<HealthKnowledgeItem | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const coverFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Lock scrolling on mounting
    const win = window as any;
    win.__activeScrollLocks = (win.__activeScrollLocks || 0) + 1;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // Register state update listener
    const updateState = (newItems: HealthKnowledgeItem[], loading: boolean) => {
      setItems(newItems);
      setLoadingItems(loading);
    };
    listeners.push(updateState);

    // Call immediately in case cache updated since component initialized
    updateState(cachedItems, loadingCache);

    return () => {
      // Unregister listener
      const idx = listeners.indexOf(updateState);
      if (idx !== -1) {
        listeners.splice(idx, 1);
      }

      win.__activeScrollLocks = Math.max(0, (win.__activeScrollLocks || 0) - 1);
      if (win.__activeScrollLocks === 0) {
        document.body.style.overflow = 'unset';
        document.documentElement.style.overflow = 'unset';
      }
    };
  }, []);

  useEffect(() => {
    if (viewMode === 'list' && focusedItemId) {
      const filteredItems = items.filter(item => {
        const itemCategory = item.category || 'health';
        return itemCategory === activeTab;
      });
      const itemIndex = filteredItems.findIndex(item => item.id === focusedItemId);
      if (itemIndex !== -1) {
        const ITEMS_PER_PAGE = 5;
        const pageNum = Math.floor(itemIndex / ITEMS_PER_PAGE) + 1;
        setCurrentPage(pageNum);
      }

      setTimeout(() => {
        const element = document.getElementById(`knowledge-item-${focusedItemId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.style.transition = 'all 0.5s';
          element.style.borderColor = '#FF416C';
          element.style.boxShadow = '0 0 12px rgba(255, 65, 108, 0.4)';
          element.style.transform = 'scale(1.02)';
          
          setTimeout(() => {
            element.style.borderColor = '#e2e8f0';
            element.style.boxShadow = 'none';
            element.style.transform = 'scale(1)';
            setFocusedItemId(null);
          }, 2000);
        }
      }, 100);
    }
  }, [viewMode, focusedItemId, items, activeTab]);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
        return;
      }

      // ตรวจสอบขนาดไฟล์ไม่ให้เกิน 5MB
      const maxMb = 5;
      if (file.size > maxMb * 1024 * 1024) {
        alert(`⚠️ ไฟล์รูปภาพมีขนาดใหญ่เกินไป (${(file.size / 1024 / 1024).toFixed(1)}MB) กรุณาใช้ไฟล์ขนาดไม่เกิน ${maxMb}MB`);
        return;
      }

      // ลบ object URL เดิมก่อน
      if (coverPreview && !coverPreview.startsWith('http')) {
        URL.revokeObjectURL(coverPreview);
      }

      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
      setCoverUploadedManually(true);
    }
  };

  const handleResetCoverToYoutube = () => {
    if (coverPreview && !coverPreview.startsWith('http')) {
      URL.revokeObjectURL(coverPreview);
    }
    setCoverFile(null);
    setCoverUploadedManually(false);

    // ดึง thumbnail จาก YouTube URL ปัจจุบัน
    const videoId = extractYoutubeId(videoUrl);
    if (videoId) {
      setCoverPreview(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
    } else if (editingItem) {
      setCoverPreview(editingItem.videoThumbnailUrl || '');
    } else {
      setCoverPreview('');
    }
  };

  const extractYoutubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleYoutubeUrlChange = async (url: string) => {
    setVideoUrl(url);
    const videoId = extractYoutubeId(url);
    if (videoId) {
      const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      setCoverPreview(thumbUrl);
      setCoverFile(null);
      setCoverUploadedManually(false);

      try {
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        const data = await response.json();
        if (data.title) {
          setTitle(data.title);
        } else {
          const ytRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
          const ytData = await ytRes.json();
          if (ytData.title) {
            setTitle(ytData.title);
          }
        }
      } catch (err) {
        console.error("Error fetching youtube metadata:", err);
      }
    }
  };

  const handlePasteYoutubeUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleYoutubeUrlChange(text.trim());
      } else {
        alert('ไม่พบข้อความในคลิปบอร์ด');
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      alert('บราวเซอร์หรืออุปกรณ์นี้ไม่อนุญาตให้เข้าถึงคลิปบอร์ด กรุณาวางลิงก์ด้วยตนเอง');
    }
  };

  const handlePasteVideoUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setVideoUrl(text.trim());
      } else {
        alert('ไม่พบข้อความในคลิปบอร์ด');
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      alert('บราวเซอร์หรืออุปกรณ์นี้ไม่อนุญาตให้เข้าถึงคลิปบอร์ด กรุณาวางลิงก์ด้วยตนเอง');
    }
  };


  const handleOpenAddForm = () => {
    setTitle('');
    setVideoUrl('');
    setCoverFile(null);
    setCoverPreview('');
    setCoverUploadedManually(false);
    setCategory(activeTab);
    setPromoText('');
    setIsChallenge(false);
    setEditingItem(null);
    setViewMode('form');
  };

  const handleOpenEditForm = (item: HealthKnowledgeItem) => {
    setTitle(item.title);
    setVideoUrl(item.videoUrl);
    setCoverFile(null);
    setCoverPreview(item.videoThumbnailUrl || '');
    setCoverUploadedManually(false);
    setCategory(item.category || 'health');
    setPromoText(item.promoText || '');
    setIsChallenge(!!item.isChallenge);
    setEditingItem(item);
    setViewMode('form');
  };

  const handleCancelForm = () => {
    setViewMode('list');
    if (editingItem) {
      setFocusedItemId(editingItem.id);
    }
    if (coverPreview && !coverPreview.startsWith('http')) {
      URL.revokeObjectURL(coverPreview);
    }
    setActiveTab(category);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert(category === 'business' ? 'กรุณากรอกชื่อคลิป' : 'กรุณากรอกหัวข้อความรู้');
      return;
    }

    if (!videoUrl.trim()) {
      alert(category === 'business' ? 'กรุณากรอกลิงก์ YouTube' : 'กรุณากรอกลิงก์วิดีโอ (URL)');
      return;
    }

    if (category !== 'business' && !coverFile && !coverPreview) {
      alert('กรุณาเลือกรูปภาพหน้าปกเพื่ออัปโหลด');
      return;
    }

    setUploading(true);
    try {
      let finalVideoThumbnailUrl = editingItem ? editingItem.videoThumbnailUrl : '';

      if (coverFile) {
        // Upload cover image to ImgBB (ทั้ง business และ health)
        finalVideoThumbnailUrl = await uploadToImgBB(coverFile);
      } else if (category === 'business') {
        // Business: ใช้ coverPreview จาก YouTube auto-fetch หรือค่าเดิม
        finalVideoThumbnailUrl = coverPreview;
      }

      if (editingItem) {
        // Update existing doc
        await healthKnowledgesApi.update(editingItem.id, {
          title: title.trim(),
          videoUrl: videoUrl.trim(),
          videoThumbnailUrl: finalVideoThumbnailUrl,
          category: category,
          promoText: category === 'business' ? promoText.trim() : '',
          isChallenge: category === 'business' ? isChallenge : false,
        });
        setFocusedItemId(editingItem.id);
      } else {
        // Create new doc
        const newKnowledge = await healthKnowledgesApi.create({
          title: title.trim(),
          videoUrl: videoUrl.trim(),
          videoThumbnailUrl: finalVideoThumbnailUrl,
          createdBy: userId,
          category: category,
          promoText: category === 'business' ? promoText.trim() : '',
          isChallenge: category === 'business' ? isChallenge : false,
        });
        setFocusedItemId(newKnowledge.id);
      }

      setViewMode('list');
      setActiveTab(category);
    } catch (err: any) {
      console.error("Error saving health knowledge:", err);
      const errMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'ไม่ทราบสาเหตุ';
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + errMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบสื่อความรู้นี้?')) return;
    try {
      await healthKnowledgesApi.delete(itemId);
    } catch (err) {
      console.error("Error deleting item:", err);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  const handleShareToLine = async (item: HealthKnowledgeItem) => {
    try {
      const liff = (window as any).liff;
      if (!liff || !liff.isApiAvailable('shareTargetPicker')) {
        alert('อุปกรณ์หรือบราวเซอร์นี้ไม่รองรับการแชร์ผ่าน LINE (shareTargetPicker)');
        return;
      }

      const knowledgeLiffUrl = item.category === 'business'
        ? LIFF_URLS.SHARE_KNOWLEDGE
        : LIFF_URLS.SHARE_LINK;
      const liffUrl = item.category === 'business'
        ? `${knowledgeLiffUrl}?knowledgeId=${item.id}`
        : `${knowledgeLiffUrl}?knowledgeId=${item.id}&liffId=${LIFF_IDS.SHARE_LINK}`;
      let flexMsg: any;

      if (item.category === 'business') {
        flexMsg = {
          type: "flex",
          altText: item.isChallenge ? `🏆 ฟังลิงก์ Challenge: ${item.title}` : `💡 แนวคิดธุรกิจ: ${item.title}`,
          contents: {
            type: "bubble",
            ...(item.isChallenge ? {
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
              url: item.videoThumbnailUrl || "https://i.ytimg.com/vi/placeholder/maxresdefault.jpg",
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
                  text: item.title,
                  weight: "bold",
                  size: "md",
                  wrap: true
                },
                ...((item.isChallenge || item.promoText) ? [
                  {
                    type: "separator",
                    margin: "md",
                    color: "#e2e8f0"
                  },
                  {
                    type: "text",
                    text: item.isChallenge 
                      ? "ชวนฟังลิงก์นี้ แชร์สิ่งที่ได้รับ ส่งต่อความฮอตให้เพื่อน ๆ ในกลุ่มกัน" 
                      : item.promoText,
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
                        uri: item.isChallenge 
                          ? liffUrl
                          : (item.videoUrl ? (item.videoUrl.includes('?') ? `${item.videoUrl}&openExternalBrowser=1` : `${item.videoUrl}?openExternalBrowser=1`) : '')
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
                    ...(!item.isChallenge ? [
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
                ...(item.isChallenge ? [
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
          altText: `💡 ความรู้สุขภาพ: ${item.title}`,
          contents: {
            type: "bubble",
            hero: {
              type: "video",
              altContent: {
                type: "image",
                size: "full",
                aspectRatio: "9:16",
                aspectMode: "cover",
                url: item.videoThumbnailUrl || "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png"
              },
              aspectRatio: "9:16",
              url: item.videoUrl,
              previewUrl: item.videoThumbnailUrl || "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png"
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

      const res = await liff.shareTargetPicker([flexMsg]);
      if (res) {
        setShowSuccessPopup(true);
        setTimeout(() => {
          setShowSuccessPopup(false);
        }, 2000);
      }
    } catch (err) {
      console.error("Error sharing to LINE:", err);
      alert('เกิดข้อผิดพลาดในการแชร์ไปยัง LINE');
    }
  };

  const filteredItems = items.filter(item => {
    const itemCategory = item.category || 'health';
    return itemCategory === activeTab;
  });

  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedItems = filteredItems.slice((activePage - 1) * ITEMS_PER_PAGE, activePage * ITEMS_PER_PAGE);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 15000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '500px',
        padding: '24px', position: 'relative', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Close Button */}
        <button
          onClick={sharingItem ? () => setSharingItem(null) : viewMode === 'form' ? handleCancelForm : onClose}
          disabled={uploading}
          style={{ 
            position: 'absolute', top: '20px', right: '20px', 
            background: '#fef2f2', border: 'none', width: '36px', height: '36px', 
            borderRadius: '50%', cursor: uploading ? 'not-allowed' : 'pointer', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            color: '#dc2626', fontSize: '1.2rem', fontWeight: 'bold' 
          }}
        >
          ✕
        </button>

        {sharingItem ? (
          <div>
            {/* Back Button */}
            <button
              onClick={() => setSharingItem(null)}
              style={{
                background: '#f1f5f9', border: 'none', padding: '10px 16px',
                borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                color: '#475569', fontSize: '0.9rem', marginBottom: '20px',
                transition: 'all 0.2s'
              }}
            >
              ← ย้อนกลับ
            </button>

            {/* Cover Image */}
            <div style={{
              width: '100%', aspectRatio: '16/9', borderRadius: '16px',
              overflow: 'hidden', backgroundColor: '#000', marginBottom: '20px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.12)'
            }}>
              <img
                src={sharingItem.videoThumbnailUrl}
                alt={sharingItem.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Title */}
            <h2 style={{
              margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: 'bold',
              color: 'var(--text-main)', lineHeight: '1.4'
            }}>
              {sharingItem.title}
            </h2>

            {/* Date */}
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '20px', display: 'block' }}>
              📅 {sharingItem.createdAt ? formatKnowledgeDate(sharingItem.createdAt) : ''}
            </span>

            {/* Promo Text */}
            {sharingItem.promoText && (
              <div style={{
                background: '#f8fafc', borderRadius: '12px', padding: '16px',
                border: '1px solid #e2e8f0', marginBottom: '20px',
                fontSize: '0.9rem', color: '#475569', lineHeight: '1.6'
              }}>
                {sharingItem.promoText}
              </div>
            )}

            {/* Share Button */}
            <button
              onClick={async () => {
                await handleShareToLine(sharingItem);
              }}
              style={{
                width: '100%', padding: '14px', background: '#06c755', color: '#fff',
                border: 'none', borderRadius: '12px', fontWeight: 'bold',
                fontSize: '1rem', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 4px 12px rgba(6, 199, 85, 0.2)'
              }}
            >
              📤 แชร์ความรู้ไปยัง LINE
            </button>

            {/* Listen Now Button */}
            {sharingItem.videoUrl && (
              <button
                onClick={() => {
                  const url = sharingItem.videoUrl.includes('?')
                    ? `${sharingItem.videoUrl}&openExternalBrowser=1`
                    : `${sharingItem.videoUrl}?openExternalBrowser=1`;
                  window.open(url, '_blank');
                }}
                style={{
                  width: '100%', padding: '14px', marginTop: '10px',
                  background: 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 12px rgba(255, 65, 108, 0.2)'
                }}
              >
                ▶️ กดฟังเลยตอนนี้
              </button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', marginBottom: '20px', paddingRight: '40px' }}>
              <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📖 คลังความรู้
              </h2>
            </div>

            {/* Category Tabs */}
            <div style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              padding: '4px',
              borderRadius: '14px',
              marginBottom: '16px',
              gap: '4px'
            }}>
              <button
                onClick={() => {
                  setActiveTab('business');
                  setCurrentPage(1);
                }}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: activeTab === 'business' ? '#fff' : 'transparent',
                  color: activeTab === 'business' ? '#1e293b' : '#64748b',
                  boxShadow: activeTab === 'business' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                💼 แนวคิดธุรกิจ
              </button>
              <button
                onClick={() => {
                  setActiveTab('health');
                  setCurrentPage(1);
                }}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: activeTab === 'health' ? '#fff' : 'transparent',
                  color: activeTab === 'health' ? '#1e293b' : '#64748b',
                  boxShadow: activeTab === 'health' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                🥦 สุขภาพ
              </button>
            </div>

            {/* Create Button (Moved below tabs) */}
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={handleOpenAddForm}
                style={{
                  background: 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)',
                  color: '#fff', border: 'none', padding: '12px 16px',
                  borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer',
                  fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 4px 6px rgba(255, 65, 108, 0.2)',
                  width: '100%',
                  justifyContent: 'center'
                }}
              >
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff', lineHeight: 1 }}>+</span>{' '}
                {activeTab === 'business' ? 'สร้างลิงก์' : 'สร้างสื่อความรู้'}
              </button>
            </div>

            {/* List */}
            {loadingItems ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>กำลังโหลดคลังความรู้...</div>
            ) : filteredItems.length === 0 ? (
              <div style={{ 
                textAlign: 'center', padding: '60px 20px', color: '#64748b', 
                border: '2px dashed #e2e8f0', borderRadius: '16px', background: '#f8fafc' 
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📭</div>
                <div style={{ fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                  {activeTab === 'health' ? 'ยังไม่มีสื่อความรู้สุขภาพ' : 'ยังไม่มีสื่อแนวคิดธุรกิจ'}
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  {activeTab === 'health' ? 'กดปุ่มด้านบนเพื่อแชร์วิดีโอสุขภาพได้เลย' : 'กดปุ่มด้านบนเพื่อแชร์วิดีโอแนวคิดธุรกิจได้เลย'}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {paginatedItems.map(item => {
                    const isBusiness = item.category === 'business';
                    
                    if (isBusiness) {
                      return (
                        <div 
                          key={item.id}
                          id={`knowledge-item-${item.id}`}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px',
                            borderRadius: '16px', border: '1px solid #e2e8f0',
                            background: '#f8fafc', transition: 'all 0.2s',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
                          }}
                        >
                          {/* Youtube Cover Image (landscape 16:9) */}
                          <div
                            onClick={() => handleOpenEditForm(item)}
                            style={{
                              width: '100%', aspectRatio: '16/9', borderRadius: '12px',
                              overflow: 'hidden', backgroundColor: '#000', cursor: 'pointer',
                              position: 'relative', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                            }}
                          >
                            <img 
                              src={item.videoThumbnailUrl} 
                              alt="Video Cover"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>

                          {/* Content Column */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <h3 
                              onClick={() => setActivePlayerItem(item)}
                              style={{
                                margin: 0, fontSize: '1rem', fontWeight: 'bold',
                                color: 'var(--text-main)', cursor: 'pointer', wordBreak: 'break-word',
                                lineHeight: '1.4'
                              }}
                            >
                              {item.title}
                            </h3>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              📅 {item.createdAt ? formatKnowledgeDate(item.createdAt) : 'กำลังบันทึก...'}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleOpenEditForm(item)}
                                style={{
                                  flex: 1,
                                  background: '#fff', color: '#475569', border: '1px solid #cbd5e1',
                                  padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem',
                                  fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                }}
                              >
                                ✏️ แก้ไข
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                style={{
                                  flex: 1,
                                  background: '#fef2f2', color: '#dc2626', border: 'none',
                                  padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem',
                                  fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                }}
                              >
                                🗑️ ลบ
                              </button>
                            </div>
                            <button
                              onClick={() => handleShareToLine(item)}
                              style={{
                                background: '#06c755', color: '#fff', border: 'none',
                                padding: '10px 16px', borderRadius: '8px', fontSize: '0.9rem',
                                fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                width: '100%', boxShadow: '0 2px 4px rgba(6, 199, 85, 0.15)'
                              }}
                            >
                              📤 แชร์ลิงก์ไปยัง LINE
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Original Health style
                    return (
                      <div 
                        key={item.id}
                        id={`knowledge-item-${item.id}`}
                        style={{
                          display: 'flex', gap: '12px', padding: '12px',
                          borderRadius: '16px', border: '1px solid #e2e8f0',
                          background: '#f8fafc', transition: 'all 0.2s'
                        }}
                      >
                        {/* Thumbnail Column */}
                        <div 
                          onClick={() => setActivePlayerItem(item)}
                          style={{
                            width: '96px', alignSelf: 'stretch', borderRadius: '12px',
                            overflow: 'hidden', backgroundColor: '#000', cursor: 'pointer',
                            position: 'relative', flexShrink: 0, boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                          }}
                        >
                          <img 
                            src={item.videoThumbnailUrl} 
                            alt="Video Thumbnail"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>

                        {/* Content Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
                          <div>
                            <h3 
                              onClick={() => setActivePlayerItem(item)}
                              style={{
                                margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 'bold',
                                color: 'var(--text-main)', cursor: 'pointer', wordBreak: 'break-word',
                                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                                overflow: 'hidden', lineHeight: '1.4'
                              }}
                            >
                              {item.title}
                            </h3>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              📅 {item.createdAt ? formatKnowledgeDate(item.createdAt) : 'กำลังบันทึก...'}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleOpenEditForm(item)}
                                style={{
                                  flex: 1,
                                  background: '#fff', color: '#475569', border: '1px solid #cbd5e1',
                                  padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem',
                                  fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                }}
                              >
                                ✏️ แก้ไข
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                style={{
                                  flex: 1,
                                  background: '#fef2f2', color: '#dc2626', border: 'none',
                                  padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem',
                                  fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                }}
                              >
                                🗑️ ลบ
                              </button>
                            </div>
                            <button
                              onClick={() => handleShareToLine(item)}
                              style={{
                                background: '#06c755', color: '#fff', border: 'none',
                                padding: '10px 16px', borderRadius: '8px', fontSize: '0.9rem',
                                fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                width: '100%', boxShadow: '0 2px 4px rgba(6, 199, 85, 0.15)'
                              }}
                            >
                              📤 แชร์ต่อความรู้ไปยัง LINE
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '20px',
                    paddingTop: '16px',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={activePage === 1}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        background: activePage === 1 ? '#f8fafc' : '#fff',
                        color: activePage === 1 ? '#cbd5e1' : '#475569',
                        cursor: activePage === 1 ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        transition: 'all 0.2s'
                      }}
                    >
                      ย้อนกลับ
                    </button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          border: 'none',
                          background: pageNum === activePage
                            ? 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)'
                            : '#fff',
                          color: pageNum === activePage ? '#fff' : '#475569',
                          borderStyle: pageNum === activePage ? 'none' : 'solid',
                          borderWidth: pageNum === activePage ? '0' : '1px',
                          borderColor: '#e2e8f0',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          boxShadow: pageNum === activePage ? '0 4px 6px rgba(255, 65, 108, 0.2)' : 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={activePage === totalPages}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        background: activePage === totalPages ? '#f8fafc' : '#fff',
                        color: activePage === totalPages ? '#cbd5e1' : '#475569',
                        cursor: activePage === totalPages ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        transition: 'all 0.2s'
                      }}
                    >
                      ถัดไป
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Form Mode (Add / Edit) */
          <div>
            <h2 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '1.3rem', fontWeight: 'bold' }}>
              {editingItem 
                ? (category === 'business' ? '✏️ แก้ไขสื่อแนวคิดธุรกิจ' : '✏️ แก้ไขสื่อความรู้') 
                : (category === 'business' ? '➕ สร้างลิงก์ใหม่' : '➕ สร้างสื่อความรู้ใหม่')}
            </h2>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Shared hidden file input for cover image upload (both business & health) */}
              <input
                type="file"
                ref={coverFileInputRef}
                accept="image/*"
                onChange={handleCoverChange}
                style={{ display: 'none' }}
              />

              {category === 'business' ? (
                /* Business Mindset YouTube Link Form */
                <>
                  {/* YouTube URL Field */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>
                      ลิงก์ YouTube *
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="url"
                        required
                        disabled={uploading}
                        value={videoUrl}
                        onChange={e => handleYoutubeUrlChange(e.target.value)}
                        placeholder="เช่น https://www.youtube.com/watch?v=..."
                        style={{
                          flex: 1, padding: '12px', borderRadius: '10px',
                          border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box',
                          outline: 'none', transition: 'border-color 0.2s'
                        }}
                      />
                      <button
                        type="button"
                        onClick={handlePasteYoutubeUrl}
                        disabled={uploading}
                        style={{
                          padding: '0 16px',
                          borderRadius: '10px',
                          border: '1px solid var(--primary)',
                          background: 'var(--primary)',
                          color: '#fff',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.95rem',
                          transition: 'all 0.2s',
                          flexShrink: 0
                        }}
                      >
                        วาง
                      </button>
                    </div>
                  </div>

                  {/* Cover Image (auto-fetched from YouTube or uploaded manually) */}
                  {coverPreview ? (
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>
                        ภาพปกของคลิป
                        {coverUploadedManually ? (
                          <span style={{ color: '#FF416C', marginLeft: '6px', fontSize: '0.8rem' }}>📷 ภาพที่อัพโหลด (ImgBB)</span>
                        ) : (
                          <span style={{ color: '#0066cc', marginLeft: '6px', fontSize: '0.8rem' }}>🎬 ดึงจาก YouTube</span>
                        )}
                      </label>
                      <div
                        onClick={() => !uploading && coverFileInputRef.current?.click()}
                        style={{
                          width: '100%', aspectRatio: '16/9', borderRadius: '12px',
                          overflow: 'hidden', backgroundColor: '#eaeaea',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          cursor: uploading ? 'not-allowed' : 'pointer',
                          position: 'relative'
                        }}
                      >
                        <img
                          src={coverPreview}
                          alt="Cover Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {/* Overlay hint */}
                        <div style={{
                          position: 'absolute', bottom: '0', left: '0', right: '0',
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: '6px', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold'
                        }}>
                          📷 คลิกเพื่อเปลี่ยนภาพปก
                        </div>
                      </div>
                      {/* Reset to YouTube thumbnail button (only when uploaded manually and YouTube ID exists) */}
                      {coverUploadedManually && extractYoutubeId(videoUrl) && (
                        <button
                          type="button"
                          onClick={handleResetCoverToYoutube}
                          disabled={uploading}
                          style={{
                            marginTop: '8px', padding: '8px 14px',
                            background: '#e0f2fe', color: '#0066cc',
                            border: '1px solid #0099ff', borderRadius: '8px',
                            fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#0099ff';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#e0f2fe';
                            e.currentTarget.style.color = '#0066cc';
                          }}
                        >
                          🎬 ใช้ภาพจาก YouTube
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>
                        ภาพปกของคลิป
                        <span style={{ color: '#0066cc', marginLeft: '6px', fontSize: '0.8rem' }}>🎬 จะดึงจาก YouTube โดยอัตโนมัติ</span>
                      </label>
                      <div
                        onClick={() => !uploading && coverFileInputRef.current?.click()}
                        style={{
                          width: '100%', aspectRatio: '16/9', borderRadius: '12px',
                          border: '2px dashed #cbd5e1', backgroundColor: '#f8fafc',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: '8px', cursor: uploading ? 'not-allowed' : 'pointer',
                          color: '#94a3b8',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#0099ff';
                          e.currentTarget.style.backgroundColor = '#f0f9ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#cbd5e1';
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                        }}
                      >
                        <div style={{ fontSize: '2rem' }}>📷</div>
                        <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.9rem' }}>
                          คลิกเพื่ออัพโหลดภาพปกเอง (ทางเลือก)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>รองรับ PNG, JPG, JPEG (ไม่เกิน 5MB)</div>
                        <div style={{ fontSize: '0.7rem', color: '#0066cc', marginTop: '4px', fontWeight: '500' }}>💡 หากไม่อัพโหลด จะใช้ภาพจาก YouTube โดยอัตโนมัติ</div>
                      </div>
                    </div>
                  )}

                  {/* Title Field (Auto-fetched but editable) */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>
                      ชื่อคลิป *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={uploading}
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="ชื่อคลิปจะดึงอัตโนมัติเมื่อวางลิงก์"
                      style={{
                        width: '100%', padding: '12px', borderRadius: '10px',
                        border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box',
                        outline: 'none', transition: 'border-color 0.2s'
                      }}
                    />
                  </div>

                  {/* Promo Text Field */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>
                      ข้อความโปรโมท
                    </label>
                     <AutoResizeTextarea
                      disabled={uploading}
                      value={promoText}
                      onChange={e => setPromoText(e.target.value)}
                      placeholder="เช่น คลิปนี้ดีมากห้ามพลาด!, เทคนิคการปิดการขายระดับเซียน"
                      style={{
                        width: '100%', padding: '12px', borderRadius: '10px',
                        border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box',
                        outline: 'none', transition: 'border-color 0.2s',
                        fontFamily: 'inherit', minHeight: '150px'
                      }}
                    />
                  </div>

                  {/* Challenge Checkbox */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 10px 0' }}>
                    <input
                      type="checkbox"
                      id="isChallengeCheckbox"
                      disabled={uploading}
                      checked={isChallenge}
                      onChange={e => setIsChallenge(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="isChallengeCheckbox" style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.95rem', cursor: 'pointer', userSelect: 'none' }}>
                      ฟังลิงก์ Challenge
                    </label>
                  </div>
                </>
              ) : (
                /* Health Knowledge Form (Original Form) */
                <>
                  {/* Title Field */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>
                      หัวข้อความรู้ *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={uploading}
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="เช่น ประโยชน์ของการคาร์ดิโอตอนเช้า"
                      style={{
                        width: '100%', padding: '12px', borderRadius: '10px',
                        border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box',
                        outline: 'none', transition: 'border-color 0.2s'
                      }}
                    />
                  </div>

                  {/* Video URL Field */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>
                      ลิงก์วิดีโอ (URL) *
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input
                        type="url"
                        required
                        disabled={uploading}
                        value={videoUrl}
                        onChange={e => setVideoUrl(e.target.value)}
                        placeholder="วางลิงก์วิดีโอที่นี่ (รองรับ .mp4, .mov ฯลฯ)"
                        style={{
                          flex: 1, padding: '12px', borderRadius: '10px',
                          border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box',
                          outline: 'none', transition: 'border-color 0.2s'
                        }}
                      />
                      <button
                        type="button"
                        onClick={handlePasteVideoUrl}
                        disabled={uploading}
                        style={{
                          padding: '0 16px',
                          borderRadius: '10px',
                          border: '1px solid var(--primary)',
                          background: 'var(--primary)',
                          color: '#fff',
                          fontWeight: 'bold',
                          cursor: uploading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.95rem',
                          transition: 'all 0.2s',
                          flexShrink: 0,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        วาง
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          const liff = (window as any).liff;
                          if (liff && liff.openWindow) {
                            liff.openWindow({
                              url: 'https://www.image2url.com/hosting/video-hosting',
                              external: true
                            });
                          } else {
                            window.open('https://www.image2url.com/hosting/video-hosting', '_blank');
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: 'linear-gradient(135deg, #1cb0f6 0%, #0079f2 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '10px',
                          fontWeight: 'bold',
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 6px rgba(28, 176, 246, 0.2)'
                        }}
                      >
                        Upload Video เพื่อรับ URL
                      </button>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', display: 'block' }}>
                        💡 แนะนำ: คัดลอกลิงก์ที่ลงท้ายด้วย .mp4 มาวางในช่องด้านบน
                      </span>
                    </div>
                  </div>

                  {/* Cover Image Upload Field */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>
                      อัปโหลดรูปภาพหน้าปก *
                    </label>
                    <div
                      onClick={() => !uploading && coverFileInputRef.current?.click()}
                      style={{
                        border: '2px dashed #cbd5e1', borderRadius: '16px', padding: '24px 16px',
                        textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer', background: '#f8fafc',
                        position: 'relative', overflow: 'hidden', transition: 'all 0.2s'
                      }}
                    >
                      {coverPreview ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                          {/* aspect-ratio 9:16 portrait preview for cover */}
                          <div style={{
                            width: '120px', aspectRatio: '9/16', borderRadius: '12px',
                            overflow: 'hidden', backgroundColor: '#eaeaea', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                          }}>
                            <img
                              src={coverPreview}
                              alt="Cover Preview"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                            คลิกเพื่อเลือกรูปภาพหน้าปกใหม่
                          </span>
                        </div>
                      ) : (
                        <div style={{ color: '#94a3b8' }}>
                          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📸</div>
                          <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.95rem', marginBottom: '4px' }}>
                            คลิกเพื่ออัปโหลดรูปภาพหน้าปก
                          </div>
                          <div style={{ fontSize: '0.8rem' }}>รองรับไฟล์รูปภาพ PNG, JPG, JPEG (แนะนำอัตราส่วน 9:16)</div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Progress Indicator */}
              {uploading && (
                <div style={{
                  padding: '12px', background: '#f0fdf4', borderRadius: '10px',
                  border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '10px', color: '#166534', fontSize: '0.9rem'
                }}>
                  {/* spinner */}
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%',
                    border: '2px solid #166534', borderTopColor: 'transparent',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                  กำลังบันทึกข้อมูลและอัปโหลดรูปภาพหน้าปก...
                </div>
              )}

              {/* Form Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  disabled={uploading}
                  style={{
                    flex: 1, padding: '14px', background: '#f1f5f9', color: '#475569',
                    border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem',
                    cursor: uploading ? 'not-allowed' : 'pointer'
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  style={{
                    flex: 2, padding: '14px',
                    background: 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)',
                    color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold',
                    fontSize: '1rem', cursor: uploading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 10px rgba(255, 65, 108, 0.3)'
                  }}
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Embedded player overlay */}
      {activePlayerItem && (
        <HealthKnowledgePlayerModal
          videoUrl={activePlayerItem.videoUrl}
          title={activePlayerItem.title}
          category={activePlayerItem.category}
          onClose={() => setActivePlayerItem(null)}
        />
      )}

      {/* Success sharing popup */}
      {showSuccessPopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 30000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '24px',
            padding: '30px 40px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              color: '#22c55e',
              border: '2px solid #bbf7d0',
              boxShadow: '0 4px 10px rgba(34, 197, 94, 0.15)'
            }}>
              ✓
            </div>
            <div style={{
              fontWeight: 'bold',
              fontSize: '1.1rem',
              color: '#1e293b',
              marginTop: '4px'
            }}>
              แชร์ความรู้สำเร็จ!
            </div>
          </div>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleIn {
              from { transform: scale(0.85); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

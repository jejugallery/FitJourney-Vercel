/**
 * Helper utilities for managing media files (images and videos).
 */

export const isVideoUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  
  // Cloudinary video URL path segment
  if (url.includes('/video/upload/')) return true;
  
  // File extension checking
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.avi', '.mkv', '.quicktime'];
  const urlLower = url.toLowerCase();
  
  return videoExtensions.some(ext => 
    urlLower.endsWith(ext) || 
    urlLower.includes(ext + '?') || 
    urlLower.includes(ext + '&')
  );
};

export async function uploadToImgBB(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('key', '42148f6b7b12bd47c5e7909be404d11d');
  formData.append('image', file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `การอัปโหลดรูปภาพไปที่ ImgBB ล้มเหลว (${response.status})`);
    }

    const data = await response.json();
    if (!data.success || !data.data?.url) {
      throw new Error(data.error?.message || 'ไม่ได้รับ URL จาก ImgBB');
    }

    return data.data.url;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('การอัปโหลดรูปภาพใช้เวลานานเกินไป (timeout 30 วินาที) กรุณาลองอีกครั้ง');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}


export async function uploadToCloudinary(file: File): Promise<string> {
  if (file.type.startsWith('image/')) {
    return uploadToImgBB(file);
  }

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (
    !cloudName || 
    cloudName === 'your_cloud_name' || 
    !uploadPreset || 
    uploadPreset === 'your_upload_preset'
  ) {
    throw new Error('กรุณาตั้งค่า VITE_CLOUDINARY_CLOUD_NAME และ VITE_CLOUDINARY_UPLOAD_PRESET ในไฟล์ .env ก่อนทำการอัปโหลดรูปภาพหรือวิดีโอ');
  }

  const fileType = file.type.startsWith('video/') ? 'video' : 'image';
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${fileType}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `การอัปโหลดไฟล์ไปที่ Cloudinary ล้มเหลว (${response.status})`);
  }

  const data = await response.json();
  if (!data.secure_url) {
    throw new Error('ไม่ได้รับ secure_url จาก Cloudinary');
  }

  return data.secure_url;
}

export const getMediaThumbnailUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (isVideoUrl(url)) {
    if (url.includes('/video/upload/')) {
      const lastDotIndex = url.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        return url.substring(0, lastDotIndex).replace('/video/upload/', '/video/upload/so_0/') + '.jpg';
      }
    }
    return 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=600&auto=format&fit=crop';
  }
  return url;
};

export const getMediaVideoLoopUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.includes('/video/upload/')) {
    return url.replace('/video/upload/', '/video/upload/e_loop:5/');
  }
  return url;
};

export const getMediaFlexUrl = (url: string | null | undefined): string => {
  return getMediaThumbnailUrl(url);
};

function loadGifshot(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).gifshot) {
      resolve((window as any).gifshot);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gifshot/0.3.2/gifshot.min.js';
    script.onload = () => {
      resolve((window as any).gifshot);
    };
    script.onerror = (err) => {
      reject(new Error('Failed to load gifshot library: ' + err));
    };
    document.head.appendChild(script);
  });
}

export async function convertVideoToGif(videoFile: File): Promise<Blob> {
  const gifshot = await loadGifshot();
  const videoUrl = URL.createObjectURL(videoFile);

  return new Promise((resolve, reject) => {
    gifshot.createGIF(
      {
        video: [videoUrl],
        numFrames: 15,          // 15 frames
        interval: 0.2,          // 0.2s interval -> 3 seconds of video
        gifWidth: 360,          // standard width
        gifHeight: 202,         // 16:9 ratio
        sampleInterval: 10,     // speed of processing
        numWorkers: 2,          // use web workers
      },
      (obj: any) => {
        URL.revokeObjectURL(videoUrl);
        if (obj.error) {
          reject(new Error(obj.errorMsg || 'เกิดข้อผิดพลาดในการแปลงวิดีโอเป็น GIF'));
        } else {
          // Convert base64 data URL to Blob
          const base64Data = obj.image.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/gif' });
          resolve(blob);
        }
      }
    );
  });
}


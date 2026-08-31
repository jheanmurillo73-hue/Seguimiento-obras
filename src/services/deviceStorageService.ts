import { InspectionPhoto, InspectorProfile, AppSettings, ActivityItem, InspectionCollection } from '../types';

export interface DeviceStorageStats {
  usedBytes: number;
  usedFormatted: string;
  photoCount: number;
  activityCount: number;
  quotaPercent: number;
  storageType: 'localStorage' | 'indexedDB';
}

export type EvidenceCompressionLevel = 'estándar' | 'reforzada' | 'intensiva';

export interface EvidenceCompressionProfile {
  level: EvidenceCompressionLevel;
  maxWidth: number;
  maxHeight: number;
  quality: number;
  targetBytes: number;
}

export interface CompressedEvidenceImage {
  dataUrl: string;
  originalBytes: number;
  optimizedBytes: number;
  profile: EvidenceCompressionProfile;
}

const MB = 1024 * 1024;

export function getEvidenceImageCompressionProfile(fileSize: number): EvidenceCompressionProfile {
  if (fileSize >= 8 * MB) {
    return { level: 'intensiva', maxWidth: 1280, maxHeight: 960, quality: 0.66, targetBytes: 900 * 1024 };
  }
  if (fileSize >= 3 * MB) {
    return { level: 'reforzada', maxWidth: 1600, maxHeight: 1200, quality: 0.72, targetBytes: 1400 * 1024 };
  }
  return { level: 'estándar', maxWidth: 1920, maxHeight: 1440, quality: 0.8, targetBytes: 2 * MB };
}

export function getDataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0));
}

export function formatImageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

// Compress image on mobile or PC before storing to keep local device memory fast and lightweight
export function compressImageForDevice(
  file: File | string,
  maxWidth = 1600,
  maxHeight = 1200,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const processImg = (imgSrc: string) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = Math.round(maxHeight);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(imgSrc);
          return;
        }

        // Draw smooth image
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch {
          resolve(imgSrc);
        }
      };
      img.onerror = () => resolve(typeof file === 'string' ? file : imgSrc);
      img.src = imgSrc;
    };

    if (typeof file === 'string') {
      processImg(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        processImg(e.target?.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }
  });
}

export async function compressEvidenceImageForUpload(file: File): Promise<CompressedEvidenceImage> {
  const profile = getEvidenceImageCompressionProfile(file.size);
  let dataUrl = await compressImageForDevice(file, profile.maxWidth, profile.maxHeight, profile.quality);
  let optimizedBytes = getDataUrlByteSize(dataUrl);

  if (optimizedBytes > profile.targetBytes) {
    const retryQuality = Math.max(0.58, profile.quality - 0.1);
    dataUrl = await compressImageForDevice(dataUrl, 1280, 960, retryQuality);
    optimizedBytes = getDataUrlByteSize(dataUrl);
  }

  return { dataUrl, originalBytes: file.size, optimizedBytes, profile };
}

// Calculate approximate local device memory usage
export function getDeviceStorageStats(photos: InspectionPhoto[], activities: ActivityItem[]): DeviceStorageStats {
  let totalBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const val = localStorage.getItem(key) || '';
        totalBytes += (key.length + val.length) * 2; // 2 bytes per char in UTF-16
      }
    }
  } catch (e) {
    totalBytes = JSON.stringify(photos).length * 2;
  }

  const estimatedQuota = 5 * 1024 * 1024; // Standard ~5MB-10MB localStorage quota
  const quotaPercent = Math.min(100, Math.round((totalBytes / estimatedQuota) * 100));

  let usedFormatted = '';
  if (totalBytes < 1024) {
    usedFormatted = `${totalBytes} B`;
  } else if (totalBytes < 1024 * 1024) {
    usedFormatted = `${(totalBytes / 1024).toFixed(1)} KB`;
  } else {
    usedFormatted = `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return {
    usedBytes: totalBytes,
    usedFormatted,
    photoCount: photos.length,
    activityCount: activities.length,
    quotaPercent,
    storageType: 'localStorage',
  };
}

// Export full backup of user's PC or Mobile data to JSON file
export function exportLocalBackup(data: {
  photos: InspectionPhoto[];
  inspector: InspectorProfile;
  settings: AppSettings;
  activities: ActivityItem[];
  collections?: InspectionCollection[];
}) {
  const exportPayload = {
    version: '1.0.0',
    appName: 'PhotoVault Pro',
    exportDate: new Date().toISOString(),
    device: navigator.userAgent.includes('Mobile') ? 'Dispositivo Móvil' : 'Computadora / PC',
    data,
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `photovault_inspecciones_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import backup from JSON file into local device memory
export function importLocalBackup(file: File): Promise<{
  photos?: InspectionPhoto[];
  inspector?: InspectorProfile;
  settings?: AppSettings;
  activities?: ActivityItem[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.data) {
          resolve(parsed.data);
        } else if (Array.isArray(parsed)) {
          resolve({ photos: parsed });
        } else {
          resolve(parsed);
        }
      } catch (err) {
        reject(new Error('El archivo no es un archivo JSON de respaldo válido.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsText(file);
  });
}

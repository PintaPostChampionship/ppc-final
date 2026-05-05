import { supabase } from './supabaseClient';
import type { Profile } from '../types';

// Helper function to convert data URI to Blob
export const dataURItoBlob = (dataURI: string) => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], {type: mimeString});
};

export function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], filename, { type: mime });
}

export async function resizeImage(dataUrl: string, maxWidth: number = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }

      // Si la imagen ya es más pequeña que el máximo, no la agrandamos.
      if (img.width <= maxWidth) {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);
      } else {
        // Si la imagen es más grande, la reducimos.
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      // Convierte el canvas de vuelta a un Data URL de imagen JPG con calidad del 90%
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = (error) => reject(error);
  });
}

export function avatarSrc(p?: Profile | null) {
  if (!p) return '/default-avatar.png';
  const direct = (p.avatar_url || '').trim();
  if (direct) return direct;

  // Fallback: URL pública del bucket "avatars/<id>.jpg"
  const { data } = supabase.storage.from('avatars').getPublicUrl(`${p.id}.jpg`);
  return data?.publicUrl || '/default-avatar.png';
}

export function hasExplicitAvatar(p?: Profile | null) {
  if (!p) return false;
  return !!(p.avatar_url || '').trim();
}

import { supabase } from '@/db/supabase';

export interface ScannedReceipt {
  amount: number | null;
  merchant: string | null;
  date: string | null;
  kind: 'expense' | 'income';
  category: string | null;
  institutionId: string | null;
}

/**
 * Compresses an image file on the client to max 1280px JPEG so camera photos
 * upload fast and stay well within edge function payload limits.
 */
const compressImageToBase64 = (
  file: File,
): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const MAX_DIM = 1280;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const rawBase64 = dataUrl.split(',')[1] ?? '';
          resolve({ base64: rawBase64, mimeType: file.type || 'image/jpeg' });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedUrl = canvas.toDataURL('image/jpeg', 0.82);
        const base64 = compressedUrl.split(',')[1] ?? '';
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });

export const scanReceiptImage = async (
  file: File,
  categoryNames: string[],
): Promise<ScannedReceipt> => {
  const { base64, mimeType } = await compressImageToBase64(file);

  const { data, error } = await supabase.functions.invoke<{
    receipt?: ScannedReceipt;
    error?: string;
  }>('advisor', {
    body: {
      action: 'scan_receipt',
      imageBase64: base64,
      mimeType,
      categories: categoryNames,
    },
  });

  if (error) {
    let detail = error.message;
    if (error && typeof error === 'object' && 'context' in error) {
      try {
        const res = (error as { context: Response }).context;
        if (res && typeof res.json === 'function') {
          const body = await res.json();
          if (body?.error && typeof body.error === 'string') {
            detail = body.error;
          }
        }
      } catch {
        // ignore
      }
    }
    if (detail.includes('question is required')) {
      throw new Error(
        'Atualiza a função advisor no Supabase: npx supabase functions deploy advisor',
      );
    }
    throw new Error(detail);
  }

  if (data?.error) {
    throw new Error(data.error);
  }
  if (!data?.receipt) {
    throw new Error('Could not extract receipt details');
  }

  return data.receipt;
};

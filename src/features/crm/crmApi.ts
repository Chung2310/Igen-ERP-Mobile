import type { ImagePickerAsset } from 'expo-image-picker';
import { apiRequest } from '@/core/network/apiClient';
import type { CrmLeadDraft } from '@/features/crm/types';

/** OCR endpoint is provisional until the ERP backend contract is supplied. */
export async function recognizeLeadImage(asset: ImagePickerAsset): Promise<CrmLeadDraft> {
  const body = new FormData();
  const file = {
    uri: asset.uri,
    name: asset.fileName ?? 'lead-source.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  };
  body.append('file', file as unknown as Blob);

  return apiRequest<CrmLeadDraft>('/crm/leads/ocr', { method: 'POST', body });
}

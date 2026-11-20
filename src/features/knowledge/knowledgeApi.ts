import type { DocumentPickerAsset } from 'expo-document-picker';
import { apiRequest } from '@/core/network/apiClient';

export type KnowledgeDocumentType =
  | 'company_profile' | 'product' | 'service' | 'policy' | 'pricing'
  | 'promotion' | 'faq' | 'brand_guideline' | 'scenario' | 'general';

export type ErpKnowledgeDocument = {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string;
  status: 'active' | 'syncing' | 'failed' | string;
  version: number;
  channelScope: string[];
  purposeScope: string[];
  pageScope: 'all' | 'selected';
  pageIds: string[];
  documentType: KnowledgeDocumentType;
  chunksCount: number;
  createdAt: string;
  updatedAt: string;
};

type DocumentListResponse = { companyCode?: string; documents?: ErpKnowledgeDocument[] };

export async function listKnowledgeDocuments() {
  const response = await apiRequest<DocumentListResponse>('/company-knowledge/documents');
  return Array.isArray(response.documents) ? response.documents : [];
}

export async function updateKnowledgeDocumentType(document: ErpKnowledgeDocument, documentType: KnowledgeDocumentType) {
  return apiRequest(`/company-knowledge/documents/${encodeURIComponent(document.id)}/scopes`, {
    method: 'PATCH',
    body: {
      channelScope: document.channelScope,
      purposeScope: document.purposeScope,
      pageScope: document.pageScope,
      pageIds: document.pageIds,
      documentType,
    },
  });
}

export async function deleteKnowledgeDocument(id: string) {
  return apiRequest(`/company-knowledge/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

async function assetToBase64(asset: DocumentPickerAsset) {
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('Không đọc được tệp đã chọn trên thiết bị.');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không chuyển được tệp sang định dạng tải lên.'));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const commaIndex = dataUrl.indexOf(',');
      if (commaIndex < 0) reject(new Error('Tệp không có dữ liệu hợp lệ.'));
      else resolve(dataUrl.slice(commaIndex + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export async function uploadKnowledgeDocument(asset: DocumentPickerAsset) {
  const fileBase64 = await assetToBase64(asset);
  return apiRequest('/company-knowledge/documents/upload', {
    method: 'POST',
    body: {
      fileName: asset.name,
      fileBase64,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      channelScope: ['all'],
      purposeScope: ['all'],
      pageScope: 'all',
      pageIds: [],
      documentType: 'general',
    },
  });
}

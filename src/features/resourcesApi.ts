import type { DocumentPickerAsset } from 'expo-document-picker';
import { apiRequest } from '@/core/network/apiClient';

export type ResourceShare = {
  targetId: string;
  targetType: 'user' | 'room';
  targetName: string;
};

export type ResourceItem = {
  _id: string;
  companyCode: string;
  section: 'local';
  type: 'folder' | 'file';
  name: string;
  parentId: string | null;
  roomId?: string | null;
  fileUrl?: string;
  mimeType?: string;
  size?: number;
  creatorUid?: string;
  creatorName?: string;
  isFixed?: boolean;
  isShared?: boolean;
  shares?: ResourceShare[];
  managedType?: 'user' | 'system';
  sourceModule?: string;
  sourceRoute?: string;
  createdAt: string;
  updatedAt: string;
};

export type ResourceBreadcrumb = { _id: string; name: string; isFixed?: boolean };

export async function listResources(parentId: string | null, roomId?: string | null): Promise<ResourceItem[]> {
  const query = new URLSearchParams({ section: 'local' });
  if (parentId) query.set('parentId', parentId);
  if (roomId) query.set('roomId', roomId);
  const response = await apiRequest<{ items?: ResourceItem[] }>(`/resources?${query.toString()}`);
  return Array.isArray(response?.items) ? response.items : [];
}

export async function getResourceBreadcrumb(folderId: string, roomId?: string | null): Promise<ResourceBreadcrumb[]> {
  const query = new URLSearchParams();
  if (roomId) query.set('roomId', roomId);
  const queryString = query.toString();
  const response = await apiRequest<{ trail?: ResourceBreadcrumb[] }>(
    `/resources/breadcrumb/${encodeURIComponent(folderId)}${queryString ? `?${queryString}` : ''}`,
  );
  return Array.isArray(response?.trail) ? response.trail : [];
}

export async function createResourceFolder(name: string, parentId: string | null, roomId?: string | null) {
  const response = await apiRequest<{ item: ResourceItem }>('/resources/folder', {
    method: 'POST',
    body: { name, parentId, section: 'local', roomId },
  });
  return response.item;
}

async function assetToDataUrl(asset: DocumentPickerAsset) {
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('Không đọc được tệp đã chọn trên thiết bị.');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không chuyển được tệp sang định dạng tải lên.'));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      if (!dataUrl.startsWith('data:')) reject(new Error('Tệp không có dữ liệu hợp lệ.'));
      else resolve(dataUrl);
    };
    reader.readAsDataURL(blob);
  });
}

export async function uploadResourceFile(asset: DocumentPickerAsset, parentId: string | null, roomId?: string | null) {
  const file = await assetToDataUrl(asset);
  const uploaded = await apiRequest<{ url?: string }>('/media/upload', {
    method: 'POST',
    body: { file, folder: 'igen_erp/resources' },
  });
  if (!uploaded?.url) throw new Error('Máy chủ không trả về đường dẫn tệp đã tải lên.');

  const response = await apiRequest<{ item: ResourceItem }>('/resources/file', {
    method: 'POST',
    body: {
      name: asset.name,
      fileUrl: uploaded.url,
      parentId,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size ?? 0,
      roomId,
    },
  });
  return response.item;
}

export async function renameResource(id: string, name: string) {
  const response = await apiRequest<{ item: ResourceItem }>(
    `/resources/${encodeURIComponent(id)}/rename`,
    { method: 'PATCH', body: { name } },
  );
  return response.item;
}

export async function moveResource(id: string, parentId: string | null) {
  const response = await apiRequest<{ item: ResourceItem }>(
    `/resources/${encodeURIComponent(id)}/move`,
    { method: 'PATCH', body: { parentId } },
  );
  return response.item;
}

export async function getResourceShares(id: string): Promise<ResourceShare[]> {
  const response = await apiRequest<{ shares?: ResourceShare[] }>(
    `/resources/${encodeURIComponent(id)}/shares`,
  );
  return Array.isArray(response?.shares) ? response.shares : [];
}

export async function updateResourceShares(id: string, shares: ResourceShare[]) {
  const response = await apiRequest<{ shares?: ResourceShare[] }>(
    `/resources/${encodeURIComponent(id)}/shares`,
    { method: 'PUT', body: shares },
  );
  return Array.isArray(response?.shares) ? response.shares : shares;
}

export async function listResourceTrash(roomId?: string | null): Promise<ResourceItem[]> {
  const query = new URLSearchParams();
  if (roomId) query.set('roomId', roomId);
  const queryString = query.toString();
  const response = await apiRequest<{ items?: ResourceItem[] }>(`/resources/trash${queryString ? `?${queryString}` : ''}`);
  return Array.isArray(response?.items) ? response.items : [];
}

export async function restoreResource(id: string) {
  await apiRequest(`/resources/${encodeURIComponent(id)}/restore`, { method: 'POST' });
}

export async function removeResource(id: string) {
  await apiRequest(`/resources/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

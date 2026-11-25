import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { withAppLockSuspended } from '@/core/auth/appLockSuspension';

function safeFilename(value: string) {
  return (value || 'bao-gia').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 180);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được dữ liệu tệp.'));
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export async function saveAndShareExport(blob: Blob | Uint8Array, filename: string, mimeType?: string) {
  const name = safeFilename(filename);
  if (Platform.OS === 'web') {
    const webBlob = blob instanceof Uint8Array
      ? new Blob([blob.slice().buffer], { type: mimeType || 'application/octet-stream' })
      : blob;
    const url = URL.createObjectURL(webBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const file = new File(Paths.cache, `${Date.now()}-${name}`);
  file.create({ overwrite: true });
  if (blob instanceof Uint8Array) {
    await file.write(blob);
  } else if (typeof blob.arrayBuffer === 'function') {
    await file.write(new Uint8Array(await blob.arrayBuffer()));
  } else {
    const base64 = await blobToBase64(blob);
    await file.write(base64, { encoding: 'base64' });
  }
  if (await Sharing.isAvailableAsync()) {
    await withAppLockSuspended(() => Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name }));
  } else {
    await withAppLockSuspended(() => file.preview());
  }
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export async function saveAndShareCsv(headers: string[], rows: unknown[][], filename: string) {
  const content = '\uFEFF' + [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  await saveAndShareExport(new Blob([content], { type: 'text/csv;charset=utf-8' }), filename, 'text/csv');
}

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

function safeFilename(value: string) {
  return (value || 'bao-gia').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 180);
}

export async function saveAndShareExport(blob: Blob, filename: string, mimeType?: string) {
  const name = safeFilename(filename);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const file = new File(Paths.cache, `${Date.now()}-${name}`);
  file.create();
  await file.write(new Uint8Array(await blob.arrayBuffer()));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
  } else {
    await file.preview();
  }
}

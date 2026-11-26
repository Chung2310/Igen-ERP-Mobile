import { withAppLockSuspended } from '@/core/auth/appLockSuspension';
import { BrandLoader } from '@/components/BrandLoader';
import { PopupError } from '@/components/PopupError';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Check, ChevronDown, ChevronRight, EllipsisVertical, File, FileImage, FileSpreadsheet, FileText, Folder, HardDrive, Plus, Presentation, RefreshCw, Upload, X } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { showAppAlert, showHrConfirm } from '@/features/hr/components/HrConfirmModal';
import { useAuth } from '@/core/auth/AuthProvider';
import { getChatColleagues, getChatRooms } from '@/features/chat/chatApi';
import type { ChatColleague, ChatRoom } from '@/features/chat/types';
import {
  createResourceFolder,
  getResourceBreadcrumb,
  getResourceShares,
  listResourceTrash,
  listResources,
  moveResource,
  removeResource,
  renameResource,
  restoreResource,
  updateResourceShares,
  uploadResourceFile,
  type ResourceBreadcrumb,
  type ResourceItem,
  type ResourceShare,
} from '@/features/resourcesApi';
import { colors } from '@/theme/colors';

type LocalView = 'mine' | 'shared' | 'trash';

function formatBytes(value?: number) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
}

function fileIcon(mimeType?: string, isFolder = false) {
  if (isFolder) return { Icon: Folder, tint: '#EAF2FF' };
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.includes('image')) return { Icon: FileImage, tint: '#FCEFF3' };
  if (mime.includes('pdf')) return { Icon: FileText, tint: '#FCEBEC' };
  if (mime.includes('spreadsheet') || mime.includes('excel')) return { Icon: FileSpreadsheet, tint: '#E9F8F1' };
  if (mime.includes('presentation') || mime.includes('powerpoint')) return { Icon: Presentation, tint: '#FFF3E5' };
  if (mime.includes('word') || mime.includes('document')) return { Icon: FileText, tint: '#EAF2FF' };
  return { Icon: File, tint: '#F0F3F8' };
}

function shareTargetId(person: ChatColleague) {
  return person._id || person.id || person.uid || '';
}

function shareTargetName(person: ChatColleague) {
  return person.displayName || person.email || 'Thành viên';
}

export function ResourcesScreen() {
  const { user } = useAuth();
  const canManage = Boolean(user?.permissions?.includes('resource:manage') || user?.role === 'admin' || user?.role === 'superadmin');
  const [localView, setLocalView] = useState<LocalView>('mine');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [spaceModal, setSpaceModal] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<ResourceBreadcrumb[]>([]);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);

  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [savingFolder, setSavingFolder] = useState(false);
  const [actionItem, setActionItem] = useState<ResourceItem | null>(null);
  const [detailItem, setDetailItem] = useState<ResourceItem | null>(null);
  const [renameItem, setRenameItem] = useState<ResourceItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [sharingItem, setSharingItem] = useState<ResourceItem | null>(null);
  const [shareTargets, setShareTargets] = useState<ResourceShare[]>([]);
  const [colleagues, setColleagues] = useState<ChatColleague[]>([]);
  const [shareRooms, setShareRooms] = useState<ChatRoom[]>([]);
  const [shareTab, setShareTab] = useState<'users' | 'rooms'>('users');
  const [shareSearch, setShareSearch] = useState('');
  const [loadingShares, setLoadingShares] = useState(false);
  const [savingShares, setSavingShares] = useState(false);

  const [moveItem, setMoveItem] = useState<ResourceItem | null>(null);
  const [moveFolderId, setMoveFolderId] = useState<string | null>(null);
  const [moveFolders, setMoveFolders] = useState<ResourceItem[]>([]);
  const [moveBreadcrumb, setMoveBreadcrumb] = useState<ResourceBreadcrumb[]>([]);
  const [loadingMoveFolders, setLoadingMoveFolders] = useState(false);
  const [moving, setMoving] = useState(false);

  const activeRoom = rooms.find((room) => room._id === selectedRoomId);
  const detailIcon = detailItem ? fileIcon(detailItem.mimeType, detailItem.type === 'folder') : null;
  const DetailIcon = detailIcon?.Icon;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const request = localView === 'trash'
      ? listResourceTrash(selectedRoomId)
      : listResources(folderId, selectedRoomId);
    void request.then((rows) => {
      if (active) setItems(rows);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Không tải được tài nguyên từ ERP.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [folderId, localView, refreshKey, selectedRoomId]);

  useEffect(() => {
    let active = true;
    if (localView === 'trash' || !folderId) {
      setBreadcrumb([]);
      return () => { active = false; };
    }
    void getResourceBreadcrumb(folderId, selectedRoomId).then((trail) => {
      if (active) setBreadcrumb(trail);
    }).catch(() => {
      if (active) setBreadcrumb([]);
    });
    return () => { active = false; };
  }, [folderId, localView, selectedRoomId]);

  useEffect(() => {
    let active = true;
    if (!moveItem) return () => { active = false; };
    setLoadingMoveFolders(true);
    void Promise.all([
      listResources(moveFolderId, selectedRoomId),
      moveFolderId ? getResourceBreadcrumb(moveFolderId, selectedRoomId) : Promise.resolve([] as ResourceBreadcrumb[]),
    ]).then(([rows, trail]) => {
      if (!active) return;
      setMoveFolders(rows.filter((item) => item.type === 'folder' && item._id !== moveItem._id && item.managedType !== 'system'));
      setMoveBreadcrumb(trail);
    }).catch((cause: unknown) => {
      if (active) showAppAlert({ title: 'Không tải được thư mục', message: cause instanceof Error ? cause.message : 'ERP không trả về danh sách thư mục.', tone: 'danger' });
    }).finally(() => {
      if (active) setLoadingMoveFolders(false);
    });
    return () => { active = false; };
  }, [moveFolderId, moveItem, selectedRoomId]);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return items
      .filter((item) => !(item.isFixed && item.name.toLocaleUpperCase('vi') === '_GOOGLE DOCUMENTS'))
      .filter((item) => localView !== 'shared' || Boolean(folderId) || item.isShared)
      .filter((item) => localView !== 'mine' || Boolean(folderId) || Boolean(selectedRoomId) || !item.isShared)
      .filter((item) => !normalized || `${item.name} ${item.creatorName ?? ''} ${item.mimeType ?? ''}`.toLocaleLowerCase('vi').includes(normalized));
  }, [folderId, items, localView, query, selectedRoomId]);

  const counts = useMemo(() => ({
    folders: visibleItems.filter((item) => item.type === 'folder').length,
    files: visibleItems.filter((item) => item.type === 'file').length,
  }), [visibleItems]);

  const filteredColleagues = colleagues.filter((person) => {
    const id = shareTargetId(person);
    const isCurrentUser = id && id === (user?._id || user?.id);
    const value = `${person.displayName} ${person.email ?? ''}`.toLocaleLowerCase('vi');
    return !isCurrentUser && value.includes(shareSearch.trim().toLocaleLowerCase('vi'));
  });
  const filteredShareRooms = shareRooms.filter((room) => (room.name || '').toLocaleLowerCase('vi').includes(shareSearch.trim().toLocaleLowerCase('vi')));

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  function chooseView(view: LocalView) {
    setLocalView(view);
    if (view === 'shared') setSelectedRoomId(null);
    setFolderId(null);
    setQuery('');
  }

  async function openSpacePicker() {
    setSpaceModal(true);
    if (rooms.length) return;
    setLoadingRooms(true);
    try {
      setRooms((await getChatRooms()).filter((room) => room.isGroup));
    } catch {
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }

  async function pickAndUpload() {
    try {
      const result = await withAppLockSuspended(() => DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true }));
      if (result.canceled) return;
      setUploading(true);
      let uploaded = 0;
      for (const asset of result.assets) {
        await uploadResourceFile(asset, folderId, selectedRoomId);
        uploaded += 1;
      }
      refresh();
      showAppAlert({ title: 'Đã tải tệp lên', message: `${uploaded} tệp đã được lưu vào thư mục hiện tại.`, tone: 'success' });
    } catch (cause) {
      showAppAlert({ title: 'Chưa tải được tệp', message: cause instanceof Error ? cause.message : 'ERP không xử lý được tệp đã chọn.', tone: 'danger' });
    } finally {
      setUploading(false);
    }
  }

  async function saveFolder() {
    const name = folderName.trim();
    if (!name) return;
    setSavingFolder(true);
    try {
      await createResourceFolder(name, folderId, selectedRoomId);
      setFolderModal(false);
      setFolderName('');
      refresh();
    } catch (cause) {
      showAppAlert({ title: 'Chưa tạo được thư mục', message: cause instanceof Error ? cause.message : 'ERP không tạo được thư mục.', tone: 'danger' });
    } finally {
      setSavingFolder(false);
    }
  }

  async function openShare(item: ResourceItem) {
    setSharingItem(item);
    setShareSearch('');
    setShareTab('users');
    setLoadingShares(true);
    try {
      const [existing, people, chatRooms] = await Promise.all([getResourceShares(item._id), getChatColleagues(), getChatRooms()]);
      setShareTargets(existing);
      setColleagues(people);
      setShareRooms(chatRooms.filter((room) => room.isGroup));
    } catch (cause) {
      setSharingItem(null);
      showAppAlert({ title: 'Không tải được chia sẻ', message: cause instanceof Error ? cause.message : 'Không lấy được danh sách người và nhóm.', tone: 'danger' });
    } finally {
      setLoadingShares(false);
    }
  }

  function toggleUserShare(person: ChatColleague) {
    const id = shareTargetId(person);
    if (!id) return;
    const selected = shareTargets.some((target) => target.targetId === id && target.targetType === 'user');
    setShareTargets((current) => selected
      ? current.filter((target) => !(target.targetId === id && target.targetType === 'user'))
      : [...current, { targetId: id, targetType: 'user', targetName: shareTargetName(person) }]);
  }

  function toggleRoomShare(room: ChatRoom) {
    const selected = shareTargets.some((target) => target.targetId === room._id && target.targetType === 'room');
    setShareTargets((current) => selected
      ? current.filter((target) => !(target.targetId === room._id && target.targetType === 'room'))
      : [...current, { targetId: room._id, targetType: 'room', targetName: room.name || 'Nhóm' }]);
  }

  async function saveShares() {
    if (!sharingItem) return;
    setSavingShares(true);
    try {
      await updateResourceShares(sharingItem._id, shareTargets);
      setSharingItem(null);
      refresh();
      showAppAlert({ title: 'Đã cập nhật chia sẻ', message: 'Quyền truy cập tài nguyên đã được cập nhật.', tone: 'success' });
    } catch (cause) {
      showAppAlert({ title: 'Chưa cập nhật được chia sẻ', message: cause instanceof Error ? cause.message : 'ERP không lưu được thay đổi.', tone: 'danger' });
    } finally {
      setSavingShares(false);
    }
  }

  function confirmRemove(item: ResourceItem) {
    const permanent = localView === 'trash';
    setActionItem(null);
    showHrConfirm({
      title: permanent ? 'Xóa vĩnh viễn?' : 'Chuyển vào thùng rác?',
      message: `“${item.name}” sẽ ${permanent ? 'bị xóa vĩnh viễn' : 'được chuyển vào thùng rác'}.`,
      confirmLabel: permanent ? 'Xóa vĩnh viễn' : 'Xóa',
      onConfirm: async () => {
        try {
          await removeResource(item._id);
          refresh();
        } catch (cause: unknown) {
          showAppAlert({ title: 'Chưa xóa được tài nguyên', message: cause instanceof Error ? cause.message : 'ERP không xóa được mục này.', tone: 'danger' });
        }
      },
    });
  }

  async function restore(item: ResourceItem) {
    try {
      await restoreResource(item._id);
      setActionItem(null);
      refresh();
    } catch (cause) {
      showAppAlert({ title: 'Chưa khôi phục được', message: cause instanceof Error ? cause.message : 'ERP không khôi phục được tài nguyên.', tone: 'danger' });
    }
  }

  async function saveRename() {
    if (!renameItem || !renameValue.trim()) return;
    setRenaming(true);
    try {
      await renameResource(renameItem._id, renameValue.trim());
      setRenameItem(null);
      setActionItem(null);
      refresh();
    } catch (cause) {
      showAppAlert({ title: 'Chưa đổi được tên', message: cause instanceof Error ? cause.message : 'ERP không lưu được tên mới.', tone: 'danger' });
    } finally {
      setRenaming(false);
    }
  }

  async function saveMove() {
    if (!moveItem) return;
    setMoving(true);
    try {
      await moveResource(moveItem._id, moveFolderId);
      setMoveItem(null);
      setActionItem(null);
      refresh();
    } catch (cause) {
      showAppAlert({ title: 'Chưa di chuyển được', message: cause instanceof Error ? cause.message : 'ERP không di chuyển được mục này.', tone: 'danger' });
    } finally {
      setMoving(false);
    }
  }

  function openFile(item: ResourceItem) {
    if (!item.fileUrl) {
      showAppAlert({ title: 'Chưa có liên kết', message: 'Tài nguyên này chưa có đường dẫn để mở.', tone: 'info' });
      return;
    }
    void Linking.openURL(item.fileUrl).catch(() => showAppAlert({ title: 'Không mở được tệp', message: 'Thiết bị không mở được liên kết tài nguyên này.', tone: 'danger' }));
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.localTabs}>
          <TabButton label="Kho lưu trữ" active={localView === 'mine'} onPress={() => chooseView('mine')} />
          <TabButton label="Được chia sẻ" active={localView === 'shared'} onPress={() => chooseView('shared')} />
          <TabButton label="Thùng rác" active={localView === 'trash'} onPress={() => chooseView('trash')} />
        </View>

        {localView !== 'shared' && <Pressable style={styles.spaceButton} onPress={() => { void openSpacePicker(); }}>
          <HardDrive size={17} color={colors.primary} style={styles.spaceIcon} />
          <View style={styles.spaceCopy}>
            <Text style={styles.spaceLabel}>KHÔNG GIAN</Text>
            <Text style={styles.spaceName} numberOfLines={1}>{activeRoom?.name || 'Cá nhân'}</Text>
          </View>
          <ChevronDown size={17} color={colors.muted} style={styles.rowChevron} />
        </Pressable>}

        {localView !== 'trash' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breadcrumb}>
          <Pressable onPress={() => setFolderId(null)}><Text style={[styles.breadcrumbText, !folderId && styles.breadcrumbCurrent]}>Tài liệu</Text></Pressable>
          {breadcrumb.map((entry, index) => <View key={entry._id} style={styles.crumb}>
            <ChevronRight size={13} color={colors.muted} style={styles.crumbDivider} />
            <Pressable onPress={() => setFolderId(entry._id)}><Text style={[styles.breadcrumbText, index === breadcrumb.length - 1 && styles.breadcrumbCurrent]} numberOfLines={1}>{entry.name}</Text></Pressable>
          </View>)}
        </ScrollView>}

        <View style={styles.actionRow}>
          {canManage && localView === 'mine' && <Pressable style={styles.secondaryAction} onPress={() => setFolderModal(true)}>
            <Plus size={16} color={colors.primary} /><Text style={styles.secondaryActionText}>Thư mục</Text>
          </Pressable>}
          {canManage && localView === 'mine' && <Pressable disabled={uploading} style={[styles.primaryAction, uploading && styles.disabled]} onPress={() => { void pickAndUpload(); }}>
            {uploading ? <ActivityIndicator color={colors.white} size="small" /> : <Upload size={16} color={colors.white} />}
            <Text style={styles.primaryActionText}>{uploading ? 'Đang tải...' : 'Tải tệp lên'}</Text>
          </Pressable>}
          <Pressable style={styles.refreshButton} onPress={refresh} accessibilityLabel="Tải lại danh sách"><RefreshCw size={18} color={colors.primary} /></Pressable>
        </View>

        <TextInput value={query} onChangeText={setQuery} placeholder="Tìm tệp hoặc thư mục..." placeholderTextColor={colors.muted} style={styles.search} />

        <View style={styles.countRow}>
          <Text style={styles.listHeading}>{localView === 'trash' ? 'Thùng rác' : localView === 'shared' ? 'Được chia sẻ với tôi' : 'Tài nguyên'}</Text>
          <Text style={styles.countText}>{counts.folders} thư mục · {counts.files} tệp</Text>
        </View>

        {!!error && <PopupError error={error} onRetry={refresh} />}

        <View style={styles.list}>
          {visibleItems.map((item) => <ResourceRow
            key={item._id}
            item={item}
            inTrash={localView === 'trash'}
            canManage={Boolean(canManage && localView === 'mine' && !item.isShared && item.managedType !== 'system' && !item.isFixed)}
            onOpen={() => {
              if (item.type === 'folder' && localView !== 'trash') setFolderId(item._id);
              else { setDetailItem(item); setActionItem(null); }
            }}
            onMore={() => { setActionItem(item); setDetailItem(null); }}
          />)}
          {loading && <BrandLoader size={42} style={styles.loading} />}
          {!loading && !error && visibleItems.length === 0 && <Text style={styles.empty}>
            {query ? 'Không tìm thấy tài nguyên phù hợp.' : localView === 'trash' ? 'Thùng rác đang trống.' : localView === 'shared' ? 'Chưa có tài nguyên nào được chia sẻ với bạn.' : 'Thư mục này chưa có tài nguyên.'}
          </Text>}
        </View>
      </ScrollView>

      <Modal visible={spaceModal} transparent animationType="fade" onRequestClose={() => setSpaceModal(false)}>
        <Sheet onClose={() => setSpaceModal(false)} title="Chọn không gian" scrollable>
          <ActionMenuButton label={`Cá nhân${!selectedRoomId ? ' · Đang chọn' : ''}`} onPress={() => { setSelectedRoomId(null); setLocalView('mine'); setFolderId(null); setSpaceModal(false); }} />
          {loadingRooms && <ActivityIndicator color={colors.primary} style={styles.loading} />}
          {rooms.map((room) => <ActionMenuButton
            key={room._id}
            label={`${room.name || 'Nhóm chat'}${selectedRoomId === room._id ? ' · Đang chọn' : ''}`}
            onPress={() => { setSelectedRoomId(room._id); setLocalView('mine'); setFolderId(null); setSpaceModal(false); }}
          />)}
          {!loadingRooms && rooms.length === 0 && <Text style={styles.emptySmall}>Bạn chưa tham gia nhóm chat nào.</Text>}
        </Sheet>
      </Modal>

      <Modal visible={folderModal} transparent animationType="fade" onRequestClose={() => setFolderModal(false)}>
        <Sheet onClose={() => setFolderModal(false)} title="Tạo thư mục">
          <Text style={styles.fieldLabel}>Tên thư mục</Text>
          <TextInput value={folderName} onChangeText={setFolderName} placeholder="Nhập tên thư mục" placeholderTextColor={colors.muted} style={styles.fieldInput} autoFocus />
          <View style={styles.sheetButtons}><ActionButton label="Hủy" secondary onPress={() => setFolderModal(false)} /><ActionButton label={savingFolder ? 'Đang tạo...' : 'Tạo thư mục'} disabled={!folderName.trim() || savingFolder} onPress={() => { void saveFolder(); }} /></View>
        </Sheet>
      </Modal>

      <Modal visible={Boolean(detailItem)} transparent animationType="fade" onRequestClose={() => setDetailItem(null)}>
        {detailItem && <Sheet onClose={() => setDetailItem(null)} title="Chi tiết tài nguyên">
          <View style={styles.detailHero}>
            <View style={[styles.fileIconContainer, { backgroundColor: detailIcon?.tint }]}>
              {DetailIcon && <DetailIcon size={19} color={colors.primary} />}
            </View>
            <View style={styles.detailCopy}><Text style={styles.detailName}>{detailItem.name}</Text><Text style={styles.detailMeta}>{formatBytes(detailItem.size)}</Text></View>
          </View>
          <InfoLine label="Người tạo" value={detailItem.creatorName || detailItem.creatorUid || '—'} />
          <InfoLine label="Cập nhật" value={formatDate(detailItem.updatedAt)} />
          <InfoLine label="Loại tệp" value={detailItem.mimeType || (detailItem.type === 'folder' ? 'Thư mục' : 'Tệp')} />
          <InfoLine label="Chia sẻ" value={detailItem.shares?.length ? `${detailItem.shares.length} người/nhóm` : 'Chưa chia sẻ'} />
          <View style={styles.sheetButtons}><ActionButton label="Đóng" secondary onPress={() => setDetailItem(null)} /><ActionButton label="Mở tệp" onPress={() => openFile(detailItem)} /></View>
        </Sheet>}
      </Modal>

      <Modal visible={Boolean(actionItem)} transparent animationType="fade" onRequestClose={() => setActionItem(null)}>
        {actionItem && <Sheet onClose={() => setActionItem(null)} title="Thao tác">
          <Text style={styles.actionItemName} numberOfLines={2}>{actionItem.name}</Text>
          <ActionMenuButton label="Chi tiết" onPress={() => { setDetailItem(actionItem); setActionItem(null); }} />
          {localView === 'trash' && canManage && <>
            <ActionMenuButton label="Khôi phục" onPress={() => { void restore(actionItem); }} />
            <ActionMenuButton label="Xóa vĩnh viễn" destructive onPress={() => confirmRemove(actionItem)} />
          </>}
          {localView === 'mine' && canManage && !actionItem.isShared && actionItem.managedType !== 'system' && !actionItem.isFixed && <>
            <ActionMenuButton label="Đổi tên" onPress={() => { setRenameItem(actionItem); setRenameValue(actionItem.name); setActionItem(null); }} />
            <ActionMenuButton label="Chia sẻ với người hoặc nhóm" onPress={() => { void openShare(actionItem); setActionItem(null); }} />
            <ActionMenuButton label="Di chuyển thư mục" onPress={() => { setMoveFolderId(null); setMoveItem(actionItem); setActionItem(null); }} />
            <ActionMenuButton label="Chuyển vào thùng rác" destructive onPress={() => confirmRemove(actionItem)} />
          </>}
          <ActionButton label="Đóng" secondary onPress={() => setActionItem(null)} />
        </Sheet>}
      </Modal>

      <Modal visible={Boolean(renameItem)} transparent animationType="fade" onRequestClose={() => setRenameItem(null)}>
        {renameItem && <Sheet onClose={() => setRenameItem(null)} title="Đổi tên">
          <Text style={styles.fieldLabel}>Tên mới</Text>
          <TextInput value={renameValue} onChangeText={setRenameValue} style={styles.fieldInput} autoFocus />
          <View style={styles.sheetButtons}><ActionButton label="Hủy" secondary onPress={() => setRenameItem(null)} /><ActionButton label={renaming ? 'Đang lưu...' : 'Lưu'} disabled={!renameValue.trim() || renaming} onPress={() => { void saveRename(); }} /></View>
        </Sheet>}
      </Modal>

      <Modal visible={Boolean(sharingItem)} transparent animationType="fade" onRequestClose={() => setSharingItem(null)}>
        {sharingItem && <Sheet onClose={() => setSharingItem(null)} title="Chia sẻ tài nguyên" scrollable>
          {loadingShares ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : <>
            <Text style={styles.actionItemName} numberOfLines={1}>{sharingItem.name}</Text>
            <View style={styles.localTabs}>
              <TabButton label="Thành viên" active={shareTab === 'users'} onPress={() => setShareTab('users')} compact />
              <TabButton label="Nhóm chat" active={shareTab === 'rooms'} onPress={() => setShareTab('rooms')} compact />
            </View>
            <TextInput value={shareSearch} onChangeText={setShareSearch} placeholder="Tìm thành viên hoặc nhóm..." placeholderTextColor={colors.muted} style={styles.search} />
            {(shareTab === 'users' ? filteredColleagues.length : filteredShareRooms.length) === 0 && <Text style={styles.emptySmall}>Không có kết quả phù hợp.</Text>}
            {shareTab === 'users' ? filteredColleagues.map((person) => {
              const id = shareTargetId(person);
              const checked = shareTargets.some((target) => target.targetId === id && target.targetType === 'user');
              return <ShareChoice key={id || person.email} label={shareTargetName(person)} hint={person.email || 'Thành viên'} checked={checked} onPress={() => toggleUserShare(person)} />;
            }) : filteredShareRooms.map((room) => {
              const checked = shareTargets.some((target) => target.targetId === room._id && target.targetType === 'room');
              return <ShareChoice key={room._id} label={room.name || 'Nhóm chat'} hint={`${room.members.length} thành viên`} checked={checked} onPress={() => toggleRoomShare(room)} />;
            })}
          </>}
          <View style={styles.sheetButtons}><ActionButton label="Hủy" secondary onPress={() => setSharingItem(null)} /><ActionButton label={savingShares ? 'Đang lưu...' : 'Lưu chia sẻ'} disabled={loadingShares || savingShares} onPress={() => { void saveShares(); }} /></View>
        </Sheet>}
      </Modal>

      <Modal visible={Boolean(moveItem)} transparent animationType="fade" onRequestClose={() => setMoveItem(null)}>
        {moveItem && <Sheet onClose={() => setMoveItem(null)} title="Di chuyển tài nguyên" scrollable>
          <Text style={styles.actionItemName} numberOfLines={1}>{moveItem.name}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breadcrumb}>
            <Pressable onPress={() => setMoveFolderId(null)}><Text style={[styles.breadcrumbText, !moveFolderId && styles.breadcrumbCurrent]}>Thư mục gốc</Text></Pressable>
            {moveBreadcrumb.map((entry, index) => <View key={entry._id} style={styles.crumb}><ChevronRight size={13} color={colors.muted} style={styles.crumbDivider} /><Pressable onPress={() => setMoveFolderId(entry._id)}><Text style={[styles.breadcrumbText, index === moveBreadcrumb.length - 1 && styles.breadcrumbCurrent]}>{entry.name}</Text></Pressable></View>)}
          </ScrollView>
          <Pressable style={styles.destinationButton} onPress={() => { void saveMove(); }} disabled={moving}>
            <Text style={styles.destinationText}>{moveFolderId ? `Chuyển vào “${moveBreadcrumb[moveBreadcrumb.length - 1]?.name || 'thư mục này'}”` : 'Chuyển vào thư mục gốc'}</Text><Check size={17} color={colors.primary} />
          </Pressable>
          {loadingMoveFolders ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : moveFolders.map((folder) => <ResourceRow key={folder._id} item={folder} compact onOpen={() => setMoveFolderId(folder._id)} onMore={() => setMoveFolderId(folder._id)} />)}
          {!loadingMoveFolders && moveFolders.length === 0 && <Text style={styles.emptySmall}>Không có thư mục con.</Text>}
          <View style={styles.sheetButtons}><ActionButton label="Hủy" secondary onPress={() => setMoveItem(null)} /><ActionButton label={moving ? 'Đang chuyển...' : 'Chuyển'} disabled={moving} onPress={() => { void saveMove(); }} /></View>
        </Sheet>}
      </Modal>
    </View>
  );
}

function TabButton({ label, active, onPress, compact = false }: { label: string; active: boolean; onPress: () => void; compact?: boolean }) {
  return <Pressable onPress={onPress} style={[compact ? styles.localTab : styles.viewTab, active && styles.activeTab]}><Text style={[compact ? styles.localTabText : styles.viewTabText, active && styles.activeTabText]}>{label}</Text></Pressable>;
}

function ResourceRow({ item, onOpen, onMore, inTrash = false, canManage = false, compact = false }: { item: ResourceItem; onOpen: () => void; onMore: () => void; inTrash?: boolean; canManage?: boolean; compact?: boolean }) {
  const icon = fileIcon(item.mimeType, item.type === 'folder');
  const Icon = icon.Icon;
  return <View style={[styles.row, compact && styles.compactRow]}>
    <Pressable style={styles.rowMain} onPress={onOpen}>
      <View style={[styles.fileIconContainer, { backgroundColor: icon.tint }]}><Icon size={19} color={colors.primary} /></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{item.type === 'folder' ? 'Thư mục' : formatBytes(item.size)}{item.isShared ? ' · Được chia sẻ' : ''}{inTrash ? ' · Trong thùng rác' : ''}</Text>
      </View>
      {item.type === 'folder' && !inTrash && <ChevronRight size={17} color={colors.muted} style={styles.rowChevron} />}
    </Pressable>
    {(canManage || !compact) && <Pressable onPress={onMore} style={styles.moreButton} accessibilityLabel={`Thao tác với ${item.name}`}><EllipsisVertical size={18} color={colors.muted} /></Pressable>}
  </View>;
}

function Sheet({ children, title, onClose, scrollable = false }: { children: ReactNode; title: string; onClose: () => void; scrollable?: boolean }) {
  return <Pressable style={styles.modalBackdrop} onPress={onClose}><Pressable style={styles.sheet} onPress={() => {}}>
    <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{title}</Text><Pressable onPress={onClose} accessibilityLabel="Đóng"><X size={19} color={colors.muted} /></Pressable></View>
    {scrollable ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View>{children}</View>}
  </Pressable></Pressable>;
}

function ActionButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.actionButton, secondary && styles.actionButtonSecondary, disabled && styles.disabled]}><Text style={[styles.actionButtonText, secondary && styles.actionButtonSecondaryText]}>{label}</Text></Pressable>;
}

function ActionMenuButton({ label, onPress, destructive = false }: { label: string; onPress: () => void; destructive?: boolean }) {
  return <Pressable onPress={onPress} style={styles.menuAction}><Text style={[styles.menuActionText, destructive && styles.destructiveText]}>{label}</Text><ChevronRight size={17} color={destructive ? '#B4232E' : colors.muted} /></Pressable>;
}

function ShareChoice({ label, hint, checked, onPress }: { label: string; hint: string; checked: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.shareChoice}>
    <View style={styles.shareChoiceCopy}><Text style={styles.shareChoiceName} numberOfLines={1}>{label}</Text><Text style={styles.shareChoiceHint} numberOfLines={1}>{hint}</Text></View>
    <View style={[styles.checkbox, checked && styles.checkboxActive]}>{checked && <Check size={13} color={colors.white} />}</View>
  </Pressable>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoLine}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue} numberOfLines={2}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingTop: 10, paddingBottom: 32 },
  localTabs: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  viewTab: { flex: 1, minHeight: 37, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EEF1F6' },
  viewTabText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  activeTab: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#DDE6F4' },
  activeTabText: { color: colors.primary },
  localTab: { minHeight: 30, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#EEF1F6' },
  localTabText: { color: colors.muted, fontSize: 8, fontWeight: '700' },
  spaceButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 10, marginBottom: 6 },
  spaceIcon: { marginRight: 9 },
  spaceCopy: { flex: 1 },
  spaceLabel: { color: colors.muted, fontSize: 7, fontWeight: '800', letterSpacing: 0.7 },
  spaceName: { color: colors.ink, fontSize: 9, fontWeight: '800', marginTop: 2 },
  breadcrumb: { alignItems: 'center', paddingVertical: 8, paddingRight: 14 },
  crumb: { flexDirection: 'row', alignItems: 'center' },
  crumbDivider: { marginHorizontal: 7 },
  breadcrumbText: { maxWidth: 145, color: colors.muted, fontSize: 9, fontWeight: '600' },
  breadcrumbCurrent: { color: colors.primary, fontWeight: '800' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, marginBottom: 11 },
  primaryAction: { flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryActionText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  secondaryAction: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#EAF2FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  secondaryActionText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  refreshButton: { width: 40, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  search: { minHeight: 41, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, color: colors.ink, fontSize: 10, marginBottom: 11 },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  listHeading: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  countText: { color: colors.muted, fontSize: 8 },
  list: { gap: 7 },
  row: { minHeight: 61, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  compactRow: { minHeight: 50 },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  fileIconContainer: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  rowTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  rowMeta: { color: colors.muted, fontSize: 8, marginTop: 4 },
  rowChevron: { marginLeft: 7 },
  moreButton: { minWidth: 34, minHeight: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 3 },
  loading: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: 100 },
  empty: { paddingVertical: 24, paddingHorizontal: 12, color: colors.muted, textAlign: 'center', fontSize: 9, lineHeight: 15 },
  emptySmall: { paddingVertical: 17, color: colors.muted, textAlign: 'center', fontSize: 9 },
  errorCard: { padding: 12, marginBottom: 12, backgroundColor: '#FFF1F0', borderColor: '#F6D6D4' },
  errorText: { color: '#A43B36', fontSize: 9, lineHeight: 14 },
  retry: { color: colors.primary, fontSize: 9, fontWeight: '800', marginTop: 7 },
  disabled: { opacity: 0.55 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(18,30,49,0.42)' },
  sheet: { maxHeight: '86%', backgroundColor: '#F5F7FB', borderRadius: 24, overflow: 'hidden', paddingHorizontal: 18, paddingVertical: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 11 },
  sheetTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  fieldLabel: { color: colors.ink, fontSize: 9, fontWeight: '700', marginBottom: 6 },
  fieldInput: { minHeight: 42, paddingHorizontal: 11, backgroundColor: colors.white, borderRadius: 11, borderColor: colors.border, borderWidth: 1, color: colors.ink, fontSize: 10, marginBottom: 11 },
  sheetButtons: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 4 },
  actionButton: { flex: 1, minHeight: 41, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 11, marginTop: 8 },
  actionButtonText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  actionButtonSecondary: { backgroundColor: '#E9EDF4' },
  actionButtonSecondaryText: { color: colors.ink },
  detailHero: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 14, backgroundColor: colors.white, marginBottom: 7 },
  detailCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  detailName: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  detailMeta: { color: colors.muted, fontSize: 8, marginTop: 4 },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { color: colors.muted, fontSize: 9 },
  infoValue: { color: colors.ink, fontSize: 9, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  actionItemName: { color: colors.ink, fontSize: 10, lineHeight: 15, fontWeight: '700', marginBottom: 8 },
  menuAction: { minHeight: 43, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  menuActionText: { color: colors.ink, fontSize: 10, fontWeight: '600' },
  destructiveText: { color: '#B4232E' },
  shareChoice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  shareChoiceCopy: { flex: 1, minWidth: 0, paddingRight: 8 },
  shareChoiceName: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  shareChoiceHint: { color: colors.muted, fontSize: 8, marginTop: 3 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: '#C8D0DD', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  destinationButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EAF2FF', borderRadius: 11, paddingHorizontal: 11, marginBottom: 8 },
  destinationText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
});

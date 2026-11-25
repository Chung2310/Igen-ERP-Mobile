import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Bell, BriefcaseBusiness, CheckCheck, GraduationCap, Package, Trash2 } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { PopupError } from '@/components/PopupError';
import { Screen } from '@/components/Screen';
import {
  deleteUserNotification,
  emitUnreadNotificationCount,
  getUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  type NotificationType,
  type UserNotification,
} from '@/features/notifications/notificationsApi';
import { colors } from '@/theme/colors';

const PAGE_SIZE = 20;
const TYPE_FILTERS: Array<{ key: NotificationType | 'all'; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'kho', label: 'Kho' },
  { key: 'task', label: 'Công việc' },
  { key: 'training', label: 'Đào tạo' },
  { key: 'he-thong', label: 'Hệ thống' },
];

const typeAppearance: Record<NotificationType, { label: string; color: string; background: string; Icon: typeof Bell }> = {
  kho: { label: 'Kho', color: '#B7791F', background: '#FFF5DC', Icon: Package },
  task: { label: 'Công việc', color: colors.primary, background: '#EAF2FF', Icon: BriefcaseBusiness },
  training: { label: 'Đào tạo', color: '#7C3AED', background: '#F2EAFE', Icon: GraduationCap },
  'he-thong': { label: 'Hệ thống', color: colors.muted, background: '#EEF1F5', Icon: Bell },
};

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa ghi nhận thời gian';
  const elapsed = Date.now() - date.getTime();
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function NotificationsScreen() {
  const [items, setItems] = useState<UserNotification[]>([]);
  const [type, setType] = useState<NotificationType | 'all'>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (targetPage: number, append: boolean) => {
    setError(null);
    if (targetPage === 1 && !append) setLoading(true);
    try {
      const result = await getUserNotifications({
        page: targetPage,
        limit: PAGE_SIZE,
        ...(unreadOnly ? { read: false } : {}),
        ...(type !== 'all' ? { type } : {}),
      });
      setItems((previous) => append ? [...previous, ...result.data.filter((item) => !previous.some((row) => row._id === item._id))] : result.data);
      setUnreadCount(result.unreadCount || 0);
      setTotal(result.total || 0);
      setPage(result.page || targetPage);
      emitUnreadNotificationCount(result.unreadCount || 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách thông báo.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [type, unreadOnly]);

  useFocusEffect(useCallback(() => {
    void loadPage(1, false);
  }, [loadPage]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadPage(1, false);
  }, [loadPage]);

  const onLoadMore = useCallback(() => {
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (!loading && !loadingMore && page < lastPage) {
      setLoadingMore(true);
      void loadPage(page + 1, true);
    }
  }, [loadPage, loading, loadingMore, page, total]);

  const onMarkRead = useCallback(async (item: UserNotification) => {
    if (item.read) return;
    setItems((previous) => previous.map((row) => row._id === item._id ? { ...row, read: true } : row));
    setUnreadCount((previous) => {
      const next = Math.max(0, previous - 1);
      emitUnreadNotificationCount(next);
      return next;
    });
    try {
      const updated = await markUserNotificationRead(item._id);
      if (unreadOnly) {
        setItems((previous) => previous.filter((row) => row._id !== item._id));
        setTotal((previous) => Math.max(0, previous - 1));
      } else {
        setItems((previous) => previous.map((row) => row._id === item._id ? updated : row));
      }
    } catch (cause) {
      setItems((previous) => previous.map((row) => row._id === item._id ? { ...row, read: false } : row));
      setUnreadCount((previous) => {
        const next = previous + 1;
        emitUnreadNotificationCount(next);
        return next;
      });
      Alert.alert('Không cập nhật được thông báo', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    }
  }, [unreadOnly]);

  const onMarkAllRead = useCallback(async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllUserNotificationsRead();
      setUnreadCount(0);
      emitUnreadNotificationCount(0);
      if (unreadOnly) {
        setItems([]);
        setTotal(0);
      }
      else setItems((previous) => previous.map((item) => ({ ...item, read: true })));
    } catch (cause) {
      Alert.alert('Không cập nhật được thông báo', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, unreadCount, unreadOnly]);

  const onDelete = useCallback((item: UserNotification) => {
    Alert.alert('Xóa thông báo?', `Xóa “${item.title}” khỏi danh sách thông báo của bạn?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => {
        void (async () => {
          try {
            await deleteUserNotification(item._id);
            setItems((previous) => previous.filter((row) => row._id !== item._id));
            setTotal((previous) => Math.max(0, previous - 1));
            if (!item.read) {
              setUnreadCount((previous) => {
                const next = Math.max(0, previous - 1);
                emitUnreadNotificationCount(next);
                return next;
              });
            }
          } catch (cause) {
            Alert.alert('Không xóa được thông báo', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
          }
        })();
      } },
    ]);
  }, []);

  const listHeader = useMemo(() => (
    <View style={styles.listHeader}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>Thông báo</Text>
          <Text style={styles.subtitle}>{unreadCount ? `${unreadCount} thông báo chưa đọc` : 'Bạn đã xem hết thông báo'}</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={markingAll || unreadCount === 0} onPress={() => void onMarkAllRead()} style={[styles.markAllButton, (markingAll || unreadCount === 0) && styles.disabled]}>
          {markingAll ? <ActivityIndicator size="small" color={colors.primary} /> : <CheckCheck size={15} color={colors.primary} />}
          <Text style={styles.markAllText}>Đọc tất cả</Text>
        </Pressable>
      </View>
      <View style={styles.filterRow}>
        <Pressable accessibilityRole="button" onPress={() => setUnreadOnly((value) => !value)} style={[styles.filterChip, unreadOnly && styles.filterChipActive]}>
          <Text style={[styles.filterText, unreadOnly && styles.filterTextActive]}>Chưa đọc</Text>
        </Pressable>
        {TYPE_FILTERS.map((item) => (
          <Pressable key={item.key} accessibilityRole="button" onPress={() => setType(item.key)} style={[styles.filterChip, type === item.key && styles.filterChipActive]}>
            <Text style={[styles.filterText, type === item.key && styles.filterTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <PopupError error={error} onRetry={() => void loadPage(1, false)} />
    </View>
  ), [error, loadPage, markingAll, onMarkAllRead, type, unreadCount, unreadOnly]);

  const renderItem = useCallback(({ item }: { item: UserNotification }) => {
    const appearance = typeAppearance[item.type] || typeAppearance['he-thong'];
    const Icon = appearance.Icon;
    return (
      <Card style={[styles.notificationCard, !item.read && styles.unreadCard]}>
        <Pressable accessibilityRole="button" onPress={() => void onMarkRead(item)} style={styles.notificationPressable}>
          <View style={[styles.iconBadge, { backgroundColor: appearance.background }]}>
            <Icon size={18} color={appearance.color} />
          </View>
          <View style={styles.notificationCopy}>
            <View style={styles.notificationTitleRow}>
              <Text numberOfLines={2} style={[styles.notificationTitle, item.read && styles.readTitle]}>{item.title || 'Thông báo'}</Text>
              {!item.read ? <View style={styles.unreadDot} /> : null}
            </View>
            <Text style={styles.notificationBody}>{item.body || 'Không có nội dung.'}</Text>
            <View style={styles.metaRow}>
              <Text style={[styles.typeLabel, { color: appearance.color }]}>{appearance.label}</Text>
              <Text style={styles.dateText}>{formatNotificationTime(item.createdAt)}</Text>
            </View>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Xóa thông báo ${item.title}`} onPress={() => onDelete(item)} hitSlop={8} style={styles.deleteButton}>
          <Trash2 size={15} color={colors.muted} />
        </Pressable>
      </Card>
    );
  }, [onDelete, onMarkRead]);

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={!loading ? <Card style={styles.emptyCard}><Bell size={25} color="#B8C3D4" /><Text style={styles.emptyTitle}>{error ? 'Chưa tải được thông báo' : unreadOnly ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'}</Text><Text style={styles.subtitle}>Thông báo về công việc, kho và hệ thống sẽ hiển thị ở đây.</Text></Card> : null}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoading} size="small" color={colors.primary} /> : total > PAGE_SIZE ? <Text style={styles.listFooter}>Đã hiển thị {items.length}/{total} thông báo</Text> : null}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponentStyle={styles.headerComponent}
      />
      {loading && !refreshing && items.length === 0 ? <View pointerEvents="none" style={styles.loadingOverlay}><ActivityIndicator size="small" color={colors.primary} /></View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28, flexGrow: 1 },
  headerComponent: { marginBottom: 14 },
  listHeader: { gap: 13 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  titleCopy: { flex: 1, gap: 3 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  markAllButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white },
  markAllText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  filterChipActive: { borderColor: colors.primary, backgroundColor: '#EAF2FF' },
  filterText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  filterTextActive: { color: colors.primary },
  notificationCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10 },
  notificationPressable: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  unreadCard: { borderColor: '#B9D0FF', backgroundColor: '#FCFDFF' },
  iconBadge: { width: 38, height: 38, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  notificationCopy: { flex: 1, gap: 5 },
  notificationTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  notificationTitle: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  readTitle: { color: '#64748B', fontWeight: '600' },
  notificationBody: { color: '#64748B', fontSize: 10, lineHeight: 16 },
  unreadDot: { width: 8, height: 8, marginTop: 4, borderRadius: 4, backgroundColor: colors.primary },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 2 },
  typeLabel: { fontSize: 9, fontWeight: '800' },
  dateText: { color: '#98A3B5', fontSize: 9 },
  deleteButton: { padding: 3 },
  separator: { height: 8 },
  emptyCard: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 22 },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  listFooter: { paddingVertical: 14, color: colors.muted, fontSize: 10, textAlign: 'center' },
  footerLoading: { paddingVertical: 14 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
});

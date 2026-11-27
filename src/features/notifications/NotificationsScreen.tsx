import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  CheckCheck,
  ChevronLeft,
  MoreHorizontal,
  Trash2,
} from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { IgenInboxEmptyIllustration } from '@/components/EmptyStateIllustration';
import { NotificationTypeIcon } from '@/components/NotificationTypeIcons';
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

const typeLabels: Record<NotificationType, string> = {
  kho: 'Kho',
  task: 'Công việc',
  training: 'Đào tạo',
  'he-thong': 'Hệ thống',
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa rõ';

  const now = new Date();
  const timeStr = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDate) / 86_400_000);

  if (diffDays === 0) {
    const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
    if (minutes < 1) return 'Vừa xong';
    return `${timeStr} Hôm nay`;
  }
  if (diffDays === 1) return `${timeStr} Hôm qua`;
  if (date.getFullYear() === now.getFullYear()) {
    return `${timeStr} ${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
  }
  return `${timeStr} ${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function NotificationsScreen({ showBack = false }: { showBack?: boolean } = {}) {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
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
  const [menuState, setMenuState] = useState<{ item: UserNotification; top: number } | null>(null);

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
      setItems((previous) =>
        append
          ? [...previous, ...result.data.filter((item) => !previous.some((row) => row._id === item._id))]
          : result.data,
      );
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

  useFocusEffect(
    useCallback(() => {
      void loadPage(1, false);
    }, [loadPage]),
  );

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

  const onMarkRead = useCallback(
    async (item: UserNotification) => {
      if (item.read) return;
      setItems((previous) =>
        previous.map((row) => (row._id === item._id ? { ...row, read: true } : row)),
      );
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
          setItems((previous) =>
            previous.map((row) => (row._id === item._id ? updated : row)),
          );
        }
      } catch (cause) {
        setItems((previous) =>
          previous.map((row) => (row._id === item._id ? { ...row, read: false } : row)),
        );
        setUnreadCount((previous) => {
          const next = previous + 1;
          emitUnreadNotificationCount(next);
          return next;
        });
        Alert.alert(
          'Không cập nhật được thông báo',
          cause instanceof Error ? cause.message : 'Vui lòng thử lại.',
        );
      }
    },
    [unreadOnly],
  );

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
      } else {
        setItems((previous) => previous.map((item) => ({ ...item, read: true })));
      }
    } catch (cause) {
      Alert.alert(
        'Không cập nhật được thông báo',
        cause instanceof Error ? cause.message : 'Vui lòng thử lại.',
      );
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, unreadCount, unreadOnly]);

  const onDelete = useCallback((item: UserNotification) => {
    Alert.alert('Xóa thông báo?', `Xóa “${item.title}” khỏi danh sách thông báo của bạn?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
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
              Alert.alert(
                'Không xóa được thông báo',
                cause instanceof Error ? cause.message : 'Vui lòng thử lại.',
              );
            }
          })();
        },
      },
    ]);
  }, []);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <Svg
          pointerEvents="none"
          width="100%"
          height="100%"
          viewBox="0 0 360 120"
          preserveAspectRatio="none"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id="notifHeaderBg" x1="0" y1="0" x2="0.2" y2="1">
              <Stop offset="0" stopColor="#D8EFFC" stopOpacity="1" />
              <Stop offset="0.6" stopColor="#E9F4FD" stopOpacity="1" />
              <Stop offset="1" stopColor="#F5FAFE" stopOpacity="1" />
            </LinearGradient>
            <RadialGradient id="notifHeaderGlow" cx="88%" cy="12%" rx="48%" ry="72%">
              <Stop offset="0" stopColor="#8FD3FA" stopOpacity="0.42" />
              <Stop offset="1" stopColor="#8FD3FA" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="360" height="120" fill="url(#notifHeaderBg)" />
          <Rect x="0" y="0" width="360" height="120" fill="url(#notifHeaderGlow)" />
          {/* Soft geometric wave & concentric ring accents */}
          <Path
            d="M 190 120 C 235 84, 292 78, 360 56 L 360 120 Z"
            fill="#2463EB"
            fillOpacity={0.045}
          />
          <Circle
            cx="326"
            cy="16"
            r="56"
            fill="none"
            stroke="#2463EB"
            strokeOpacity={0.08}
            strokeWidth={1.2}
          />
          <Circle
            cx="326"
            cy="16"
            r="34"
            fill="none"
            stroke="#2463EB"
            strokeOpacity={0.07}
            strokeWidth={1}
          />
          <Circle cx="248" cy="22" r="2.2" fill="#2463EB" fillOpacity={0.12} />
          <Circle cx="262" cy="14" r="1.8" fill="#2463EB" fillOpacity={0.09} />
          <Circle cx="260" cy="30" r="1.6" fill="#2463EB" fillOpacity={0.1} />
          <Circle cx="274" cy="24" r="2" fill="#2463EB" fillOpacity={0.08} />
        </Svg>
        <View style={styles.titleRow}>
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              onPress={() => router.back()}
              hitSlop={8}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            >
              <ChevronLeft size={22} color={colors.ink} strokeWidth={2} />
            </Pressable>
          ) : null}
          <View style={styles.titleCopy}>
            <Text style={styles.title}>Thông báo</Text>
            <Text style={styles.subtitle}>
              {unreadCount ? `${unreadCount} thông báo chưa đọc` : 'Bạn đã xem hết thông báo'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={markingAll || unreadCount === 0}
            onPress={() => void onMarkAllRead()}
            style={[styles.markAllButton, (markingAll || unreadCount === 0) && styles.disabled]}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <CheckCheck size={15} strokeWidth={1.8} color={colors.primary} />
            )}
            <Text style={styles.markAllText}>Đọc tất cả</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setUnreadOnly((value) => !value)}
            style={[styles.filterChip, unreadOnly && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, unreadOnly && styles.filterTextActive]}>Chưa đọc</Text>
          </Pressable>
          {TYPE_FILTERS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              onPress={() => setType(item.key)}
              style={[styles.filterChip, type === item.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, type === item.key && styles.filterTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <PopupError error={error} onRetry={() => void loadPage(1, false)} />
      </View>
    ),
    [error, loadPage, markingAll, onMarkAllRead, type, unreadCount, unreadOnly],
  );

  const renderItem = useCallback(
    ({ item }: { item: UserNotification }) => {
      const label = typeLabels[item.type] || typeLabels['he-thong'];
      const iconType: NotificationType = item.type in typeLabels ? item.type : 'he-thong';
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => void onMarkRead(item)}
          style={({ pressed }) => [
            styles.notificationRow,
            !item.read && styles.unreadRow,
            pressed && styles.pressedRow,
          ]}
        >
          <View style={styles.iconWrap}>
            <NotificationTypeIcon type={iconType} size={38} />
          </View>
          <View style={styles.notificationCopy}>
            <View style={styles.metaTopRow}>
              <Text numberOfLines={1} style={styles.metaLine}>
                <Text style={styles.typeLabel}>{label}</Text>
                <Text style={styles.metaSeparator}> • </Text>
                <Text style={styles.dateText}>{formatNotificationTime(item.createdAt)}</Text>
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Tùy chọn thông báo ${item.title}`}
                hitSlop={10}
                onPress={(e) => {
                  const pageY = e.nativeEvent?.pageY ?? 180;
                  const top = Math.min(Math.max(70, pageY + 10), Math.max(90, windowHeight - 140));
                  setMenuState({ item, top });
                }}
                style={styles.moreButton}
              >
                <MoreHorizontal size={18} strokeWidth={1.8} color="#374151" />
              </Pressable>
            </View>
            <Text
              numberOfLines={2}
              style={[styles.notificationTitle, item.read && styles.readTitle]}
            >
              {item.title || 'Thông báo'}
            </Text>
            <Text numberOfLines={3} style={styles.notificationBody}>
              {item.body || 'Không có nội dung.'}
            </Text>
          </View>
        </Pressable>
      );
    },
    [onMarkRead, windowHeight],
  );

  return (
    <Screen backgroundColor="#D8EFFC">
      <FlatList
        style={styles.list}
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <IgenInboxEmptyIllustration width={144} height={106} />
              <Text style={styles.emptyTitle}>
                {error
                  ? 'Chưa tải được thông báo'
                  : unreadOnly
                    ? 'Không có thông báo chưa đọc'
                    : 'Chưa có thông báo'}
              </Text>
              <Text style={styles.emptySub}>
                Thông báo về công việc, kho và hệ thống sẽ hiển thị ở đây.
              </Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.footerLoading} size="small" color={colors.primary} />
          ) : total > PAGE_SIZE ? (
            <Text style={styles.listFooter}>
              Đã hiển thị {items.length}/{total} thông báo
            </Text>
          ) : undefined
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Quick action popover for ••• button */}
      <Modal
        visible={Boolean(menuState)}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuState(null)}
      >
        <Pressable style={styles.popoverBackdrop} onPress={() => setMenuState(null)}>
          {menuState ? (
            <Pressable
              style={[styles.popoverCard, { top: menuState.top }]}
              onPress={() => {}}
            >
              {!menuState.item.read ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const target = menuState.item;
                    setMenuState(null);
                    void onMarkRead(target);
                  }}
                  style={({ pressed }) => [styles.popoverItem, pressed && styles.popoverItemPressed]}
                >
                  <CheckCheck size={16} strokeWidth={1.7} color={colors.ink} />
                  <Text style={styles.popoverItemText}>Đánh dấu đã đọc</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const target = menuState.item;
                  setMenuState(null);
                  onDelete(target);
                }}
                style={({ pressed }) => [styles.popoverItem, pressed && styles.popoverItemPressed]}
              >
                <Trash2 size={16} strokeWidth={1.7} color="#DC2626" />
                <Text style={[styles.popoverItemText, styles.popoverDeleteText]}>Xóa thông báo</Text>
              </Pressable>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>

      {loading && !refreshing && items.length === 0 ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.white },
  content: { paddingBottom: 28, flexGrow: 1, backgroundColor: colors.white },
  listHeader: {
    backgroundColor: '#E9F4FD',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D6E6F5',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBE0F6',
  },
  backButtonPressed: { opacity: 0.72 },
  titleCopy: { flex: 1, gap: 2 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#5A6B84', fontSize: 12, fontWeight: '400', lineHeight: 16 },
  markAllButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBE0F6',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  markAllText: { color: colors.primary, fontSize: 11.5, fontWeight: '500' },
  filterRow: { flexDirection: 'row', gap: 7 },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBE0F6',
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
  },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: '#4B5C74', fontSize: 11.5, fontWeight: '400' },
  filterTextActive: { color: colors.white, fontWeight: '500' },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: colors.white,
  },
  unreadRow: { backgroundColor: '#F3F8FF' },
  pressedRow: { backgroundColor: '#EDF3FC' },
  iconWrap: {
    flexShrink: 0,
    marginTop: 1,
  },
  notificationCopy: { flex: 1 },
  metaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaLine: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  typeLabel: { color: colors.ink, fontSize: 12.5, fontWeight: '500' },
  metaSeparator: { color: '#9CA3AF', fontSize: 12.5, fontWeight: '400' },
  dateText: { color: '#6B7280', fontSize: 12.5, fontWeight: '400' },
  moreButton: { paddingLeft: 6, paddingVertical: 2 },
  notificationTitle: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20.5,
    fontWeight: '600',
  },
  readTitle: { color: '#1F2937', fontWeight: '500' },
  notificationBody: {
    marginTop: 4,
    color: '#4B5563',
    fontSize: 13.5,
    lineHeight: 19.5,
    fontWeight: '400',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8EDF4',
  },
  emptyWrap: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 28,
  },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  emptySub: { color: colors.muted, fontSize: 12.5, fontWeight: '400', textAlign: 'center', lineHeight: 18 },
  listFooter: { paddingVertical: 14, color: colors.muted, fontSize: 11, textAlign: 'center' },
  footerLoading: { paddingVertical: 14 },
  popoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
  },
  popoverCard: {
    position: 'absolute',
    right: 16,
    minWidth: 184,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5EAF2',
    paddingVertical: 5,
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  popoverItemPressed: { backgroundColor: '#F3F6FA' },
  popoverItemText: { color: colors.ink, fontSize: 13.5, fontWeight: '400' },
  popoverDeleteText: { color: '#DC2626' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
});

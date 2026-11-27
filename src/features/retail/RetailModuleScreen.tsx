import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type ViewStyle,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  BarChart3,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  MapPinned,
  Minus,
  Plus,
  ReceiptText,
  RotateCcw,
  RefreshCw,
  Search,
  ShoppingCart,
  ShieldCheck,
  Settings,
  Ticket,
  Wallet,
  FileText,
  X,
} from 'lucide-react-native';
import { FullScreenFormModal } from '@/components/FullScreenFormModal';
import { useAuth } from '@/core/auth/AuthProvider';
import { fetchCompanyBranches, type ErpBranch } from '@/features/overview/overviewApi';
import { colors } from '@/theme/colors';
import {
  retailApi,
  type CheckoutAttempt,
  type RetailCheckoutResult,
  type RetailOrder,
  type RetailCustomerOption,
  type RetailProduct,
  type RetailQuote,
  type RetailScope,
  type RetailShift,
  type RetailShiftCashier,
  type RetailShiftOpenInput,
} from '@/features/retail/retailApi';
import { getRetailTerminalId } from '@/features/retail/retailTerminal';
import { clearRetailCheckoutIntent, readRetailCheckoutIntent, saveRetailCheckoutIntent } from '@/features/retail/retailCheckoutIntent';
import { RetailAuxPanel, RetailShiftOpenModal, type RetailAuxTab } from '@/features/retail/RetailPanels';

type RetailTab = 'pos' | 'orders' | RetailAuxTab;
type CartLine = { product: RetailProduct; quantity: number; identifiers: string };
const money = (value?: number) => `${Math.round(Number(value || 0)).toLocaleString('vi-VN')} VND`;
const formatVndInput = (value: string | number | null | undefined) => {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
};
const parseVndInput = (value: string) => Number(String(value || '').replace(/[^\d]/g, '')) || 0;
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '—';
const splitIdentifiers = (value: string) => value.split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean);
const paymentMethodLabel = (method?: string) => ({
  cash: 'Tiền mặt',
  card: 'Thẻ',
  transfer: 'Chuyển khoản',
  ewallet: 'Ví điện tử',
} as Record<string, string>)[method || ''] || method || '—';

function orderStatusMeta(status?: string) {
  switch (status) {
    case 'completed':
      return { label: 'Hoàn tất', bg: '#ECFDF3', fg: '#027A48' };
    case 'confirmed':
      return { label: 'Đã xác nhận', bg: '#EFF6FF', fg: '#1D4ED8' };
    case 'cancelled':
      return { label: 'Đã hủy', bg: '#FEF3F2', fg: '#B42318' };
    case 'draft':
      return { label: 'Nháp', bg: '#F1F5F9', fg: '#475569' };
    default:
      return { label: status || 'Khác', bg: '#FFF7ED', fg: '#C2410C' };
  }
}

function paymentStatusMeta(status?: string, dueAmount?: number) {
  switch (status) {
    case 'paid':
      return { label: 'Đã thanh toán', bg: '#ECFDF3', fg: '#027A48' };
    case 'partial':
      return { label: `Còn nợ ${money(dueAmount)}`, bg: '#FFF7ED', fg: '#C2410C' };
    case 'unpaid':
      return { label: 'Chưa thanh toán', bg: '#FEF3F2', fg: '#B42318' };
    case 'refunded':
      return { label: 'Đã hoàn tiền', bg: '#F1F5F9', fg: '#475569' };
    default:
      return { label: status || '—', bg: '#F1F5F9', fg: '#475569' };
  }
}
const idempotencyKey = () => {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  return cryptoApi?.randomUUID?.() || `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
};

function hasPermission(userPermissions: string[] | undefined, permissions: string[]) {
  return Boolean(userPermissions?.some((permission) => permission === '*' || permissions.includes(permission)));
}

function buildOrderInput(lines: CartLine[], options?: { customerId?: string; couponCode?: string; pointsToRedeem?: number; orderDiscount?: number; taxRate?: number; shippingFee?: number; note?: string }) {
  return {
    items: lines.map(({ product, quantity, identifiers }) => {
      const codes = splitIdentifiers(identifiers);
      return {
        productId: product._id,
        quantity,
        discount: { type: 'amount', value: 0 },
        ...(product.trackingMode ? { trackingMode: product.trackingMode } : {}),
        ...(product.trackingMode === 'serial' ? { serialNumbers: codes } : {}),
        ...(product.trackingMode === 'unit_barcode' ? { internalBarcodes: codes } : {}),
      };
    }),
    orderDiscount: { type: 'amount', value: Number(options?.orderDiscount || 0) },
    shippingFee: Number(options?.shippingFee || 0),
    ...(options?.taxRate == null ? {} : { taxRate: options.taxRate }),
    ...(options?.customerId ? { customerId: options.customerId } : {}),
    ...(options?.couponCode?.trim() ? { couponCode: options.couponCode.trim() } : {}),
    ...(options?.pointsToRedeem ? { pointsToRedeem: options.pointsToRedeem } : {}),
    ...(options?.note?.trim() ? { note: options.note.trim() } : {}),
  };
}

function identifiersReady(lines: CartLine[]) {
  const all: string[] = [];
  for (const line of lines) {
    if (line.product.trackingMode !== 'serial' && line.product.trackingMode !== 'unit_barcode') continue;
    const codes = splitIdentifiers(line.identifiers);
    if (codes.length !== line.quantity) return false;
    all.push(...codes.map((code) => code.toLocaleUpperCase()));
  }
  return new Set(all).size === all.length;
}

function TabButton({ selected, label, icon: Icon, onPress }: { selected: boolean; label: string; icon: LucideIcon; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={[styles.tab, selected && styles.tabSelected]}>
      <Icon size={15} color={selected ? '#FFFFFF' : colors.muted} />
      <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function RetailModuleScreen() {
  const { user, activeBranchId, setActiveBranchId } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const permissions = user?.permissions;
  const canOperate = isAdmin || hasPermission(permissions, ['pos:manage', 'retail:manage']);
  const canManage = isAdmin || hasPermission(permissions, ['retail:manage']);
  const canManagePoints = isAdmin || hasPermission(permissions, ['*']) || (hasPermission(permissions, ['retail-points:manage']) && hasPermission(permissions, ['retail-coupon:manage']));
  const canRead = isAdmin || hasPermission(permissions, ['retail:read', 'retail:manage']);
  const hasRetailAccess = canOperate || canRead;
  const canSwitchBranch = isAdmin || !user?.branchId;
  const [branches, setBranches] = useState<ErpBranch[]>([]);
  const [branchPicker, setBranchPicker] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);
  const [terminalId, setTerminalId] = useState('');
  const [tab, setTab] = useState<RetailTab>('pos');
  const visibleTabs = useMemo<Array<{ id: RetailTab; label: string; icon: LucideIcon }>>(() => {
    const items: Array<{ id: RetailTab; label: string; icon: LucideIcon }> = [];
    if (canOperate) items.push({ id: 'pos', label: 'Quầy POS', icon: ShoppingCart }, { id: 'orders', label: 'Đơn bán', icon: ReceiptText });
    if (canRead) items.push(
      { id: 'warranty', label: 'Bảo hành', icon: ShieldCheck },
      { id: 'returns', label: 'Đổi trả', icon: RotateCcw },
      { id: 'invoices', label: 'Hóa đơn', icon: FileText },
      { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
    );
    if (canManage) items.push(
      { id: 'shifts', label: 'Ca POS', icon: Clock3 },
      { id: 'finance', label: 'Tài chính', icon: Wallet },
      { id: 'settings', label: 'Cài đặt', icon: Settings },
      { id: 'coupons', label: 'Ưu đãi', icon: Ticket },
    );
    return items;
  }, [canManage, canOperate, canRead]);

  useEffect(() => {
    if (visibleTabs.some((item) => item.id === tab)) return;
    setTab(visibleTabs[0]?.id || 'pos');
  }, [tab, visibleTabs]);

  const branchId = activeBranchId || user?.branchId || '';
  const branchName = branches.find((branch) => branch._id === branchId)?.name
    || (branchId === user?.branchId ? user?.branchName : undefined)
    || 'Chọn chi nhánh';

  useEffect(() => {
    if (!user?.companyCode || (!canSwitchBranch && user.branchId)) {
      if (user?.branchId) setActiveBranchId(user.branchId);
      return;
    }
    const controller = new AbortController();
    setBranchLoading(true);
    void fetchCompanyBranches(controller.signal, user.companyCode).then((list) => {
      if (controller.signal.aborted) return;
      setBranches(list);
      setActiveBranchId((current) => current && list.some((branch) => branch._id === current)
        ? current
        : user.branchId && list.some((branch) => branch._id === user.branchId)
          ? user.branchId
          : list[0]?._id ?? '');
    }).catch(() => {}).finally(() => {
      if (!controller.signal.aborted) setBranchLoading(false);
    });
    return () => controller.abort();
  }, [canSwitchBranch, setActiveBranchId, user?.branchId, user?.companyCode]);

  useEffect(() => {
    let active = true;
    setTerminalId('');
    if (!user?.companyCode || !branchId) return () => { active = false; };
    void getRetailTerminalId(user.companyCode, branchId).then((id) => { if (active) setTerminalId(id); });
    return () => { active = false; };
  }, [branchId, user?.companyCode]);

  const scope = useMemo<RetailScope | null>(() => user?.companyCode && branchId && terminalId
    ? { companyCode: user.companyCode, branchId, terminalId }
    : null, [branchId, terminalId, user?.companyCode]);

  const [shift, setShift] = useState<RetailShift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [cashiers, setCashiers] = useState<RetailShiftCashier[]>([]);
  const [cashiersLoading, setCashiersLoading] = useState(true);
  const [cashiersError, setCashiersError] = useState('');
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [shiftError, setShiftError] = useState('');
  const shiftRequestRef = useRef(0);
  const currentCashierId = String(user?.id || user?._id || '');

  const refreshShift = useCallback(async () => {
    if (!scope || !canOperate) return;
    const requestId = ++shiftRequestRef.current;
    setShiftLoading(true);
    try {
      const current = await retailApi.currentShift(scope);
      if (requestId === shiftRequestRef.current) {
        setShift(current);
        setShiftError('');
      }
    } catch (error) {
      if (requestId === shiftRequestRef.current) setShiftError(error instanceof Error ? error.message : 'Không tải được phiên POS.');
    } finally {
      if (requestId === shiftRequestRef.current) setShiftLoading(false);
    }
  }, [canOperate, scope]);

  useEffect(() => {
    setShift(null);
    if (!scope || !canOperate) {
      shiftRequestRef.current += 1;
      setShiftLoading(false);
      return;
    }
    void refreshShift();
  }, [canOperate, refreshShift, scope]);

  useEffect(() => {
    let active = true;
    if (!scope || !canManage) {
      setCashiers([]);
      setCashiersLoading(false);
      setCashiersError('');
      return () => { active = false; };
    }
    setCashiers([]);
    setCashiersLoading(true);
    setCashiersError('');
    void retailApi.cashiers(scope).then((result) => {
      if (active) setCashiers(result || []);
    }).catch((error) => {
      if (active) setCashiersError(error instanceof Error ? error.message : 'Không tải được danh sách nhân viên POS.');
    }).finally(() => {
      if (active) setCashiersLoading(false);
    });
    return () => { active = false; };
  }, [canManage, scope]);

  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState('');
  const productRequestRef = useRef(0);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<RetailCustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<RetailCustomerOption | null>(null);
  const [selectableCoupons, setSelectableCoupons] = useState<Array<{ _id: string; code: string; name: string; discountType: 'amount' | 'percent'; value: number; minSubtotal: number; maxDiscount: number | null }>>([]);
  const [couponCode, setCouponCode] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState('0');
  const [orderDiscountText, setOrderDiscountText] = useState('0');
  const [taxRateText, setTaxRateText] = useState('');
  const [shippingFeeText, setShippingFeeText] = useState('0');
  const [orderNote, setOrderNote] = useState('');
  const [checkoutMethod, setCheckoutMethod] = useState<'cash' | 'card' | 'transfer' | 'ewallet'>('cash');
  const [checkoutReference, setCheckoutReference] = useState('');
  const [quote, setQuote] = useState<RetailQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [cashText, setCashText] = useState('');
  const [cashTouched, setCashTouched] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [pendingAttempt, setPendingAttempt] = useState<CheckoutAttempt | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'uncertain' | 'not_found' | 'processing'>('uncertain');
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [pendingStorageError, setPendingStorageError] = useState('');
  const orderInput = useMemo(() => buildOrderInput(cartLines, {
    ...(selectedCustomer ? { customerId: selectedCustomer.customerId } : {}),
    couponCode,
    pointsToRedeem: Math.max(0, Math.floor(Number(pointsToRedeem) || 0)),
    orderDiscount: Math.max(0, Math.floor(parseVndInput(orderDiscountText))),
    ...(taxRateText.trim() ? { taxRate: Number(taxRateText) } : {}),
    shippingFee: Math.max(0, Math.floor(parseVndInput(shippingFeeText))),
    note: orderNote,
  }), [cartLines, couponCode, orderDiscountText, orderNote, pointsToRedeem, selectedCustomer, shippingFeeText, taxRateText]);
  const loadOrdersRef = useRef<(() => Promise<void>) | null>(null);
  const actorKey = user?.id || user?._id || user?.email || '';

  useEffect(() => {
    let active = true;
    setPendingAttempt(null);
    setPendingLoaded(false);
    setPendingStorageError('');
    if (!scope || !actorKey) return () => { active = false; };
    void readRetailCheckoutIntent(scope, actorKey).then((saved) => {
      if (!active) return;
      setPendingAttempt(saved);
      if (saved) setPendingStatus('uncertain');
    }).catch(() => {
      if (active) setPendingStorageError('Không đọc được yêu cầu thanh toán đã lưu trên thiết bị. Tạm dừng thanh toán mới và tải lại ứng dụng để đối chiếu.');
    }).finally(() => {
      if (active) setPendingLoaded(true);
    });
    return () => { active = false; };
  }, [actorKey, scope]);

  const refreshProducts = useCallback(async (search = productSearch) => {
    if (!scope || !shift || shift.terminalId !== scope.terminalId) return;
    const requestId = ++productRequestRef.current;
    setProductLoading(true);
    try {
      let result = search.trim()
        ? await retailApi.products(scope, '', search)
        : await retailApi.products(scope);
      if (search.trim() && result.total === 0) result = await retailApi.products(scope, search);
      if (requestId !== productRequestRef.current) return;
      setProducts(result.items || []);
      setProductError('');
    } catch (error) {
      if (requestId !== productRequestRef.current) return;
      setProductError(error instanceof Error ? error.message : 'Không tải được danh sách sản phẩm.');
    } finally {
      if (requestId === productRequestRef.current) setProductLoading(false);
    }
  }, [productSearch, scope, shift]);

  useEffect(() => {
    if (tab !== 'pos' || !scope || !shift || shift.terminalId !== scope.terminalId) {
      productRequestRef.current += 1;
      setProducts([]);
      setProductLoading(false);
      return;
    }
    productRequestRef.current += 1;
    const timer = setTimeout(() => { void refreshProducts(productSearch); }, productSearch ? 250 : 0);
    return () => clearTimeout(timer);
  }, [productSearch, refreshProducts, scope, shift, tab]);

  useEffect(() => {
    if (!scope || tab !== 'pos' || selectedCustomer || customerQuery.trim().length < 2) {
      setCustomerResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      void retailApi.searchCustomers(scope, customerQuery).then((result) => { if (active) setCustomerResults(result || []); })
        .catch(() => { if (active) setCustomerResults([]); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [customerQuery, scope, selectedCustomer, tab]);

  useEffect(() => {
    if (!scope || tab !== 'pos') return;
    let active = true;
    void retailApi.selectableCoupons(scope, selectedCustomer?.customerId).then((result) => { if (active) setSelectableCoupons(result || []); })
      .catch(() => { if (active) setSelectableCoupons([]); });
    return () => { active = false; };
  }, [scope, selectedCustomer, tab]);

  useEffect(() => {
    let current = true;
    setQuote(null);
    setQuoteError('');
    if (!scope || !cartLines.length) {
      setQuoteLoading(false);
      return;
    }
    if (!identifiersReady(cartLines)) {
      setQuoteLoading(false);
      setQuoteError('Nhập đủ mã IMEI/serial hoặc mã vạch theo số lượng để báo giá.');
      return;
    }
    const timer = setTimeout(() => {
      setQuoteLoading(true);
      void retailApi.quote(scope, orderInput).then((result) => {
        if (!current) return;
        setQuote(result);
        setQuoteError('');
      }).catch((error) => {
        if (!current) return;
        setQuoteError(error instanceof Error ? error.message : 'Không tính được báo giá.');
      }).finally(() => { if (current) setQuoteLoading(false); });
    }, 180);
    return () => { current = false; clearTimeout(timer); };
  }, [cartLines, orderInput, scope]);

  useEffect(() => {
    if (quote && !cashTouched) setCashText(formatVndInput(quote.grandTotal));
  }, [cashTouched, quote]);

  const addProduct = (product: RetailProduct) => {
    if (product.stock <= 0 || product.price <= 0 || pendingAttempt || !pendingLoaded || pendingStorageError) return;
    setCartLines((current) => {
      const index = current.findIndex((line) => line.product._id === product._id);
      const scannedIdentifier = product.trackingMode === 'serial'
        ? product.matchedSerialNumber
        : product.trackingMode === 'unit_barcode' ? product.matchedInternalBarcode : undefined;
      if (index < 0) return [...current, { product, quantity: 1, identifiers: scannedIdentifier || '' }];
      if (product.trackingMode === 'serial' || product.trackingMode === 'unit_barcode') {
        return [...current, { product, quantity: 1, identifiers: scannedIdentifier || '' }];
      }
      return current.map((line, lineIndex) => lineIndex === index
        ? { ...line, quantity: Math.min(product.stock, line.quantity + 1) }
        : line);
    });
  };

  const updateQuantity = (lineIndex: number, quantity: number) => {
    setCartLines((current) => quantity <= 0
      ? current.filter((_, index) => index !== lineIndex)
      : current.map((line, index) => index === lineIndex
        ? { ...line, quantity: Math.min(line.product.stock, Math.floor(quantity)) }
        : line));
  };

  const clearCart = () => {
    setCartLines([]);
    setSelectedCustomer(null);
    setCustomerQuery('');
    setCouponCode('');
    setPointsToRedeem('0');
    setOrderDiscountText('0');
    setTaxRateText('');
    setShippingFeeText('0');
    setOrderNote('');
    setCheckoutMethod('cash');
    setCheckoutReference('');
    setQuote(null);
    setQuoteError('');
    setCashText('');
    setCashTouched(false);
    setCheckoutError('');
  };

  const finishCheckout = async (result: RetailCheckoutResult) => {
    const code = result.order?.orderCode || result.order?._id || 'Đơn bán';
    const invoice = result.invoice?.invoiceNo ? `\nHóa đơn: ${result.invoice.invoiceNo}` : '';
    let intentCleared = !scope || !actorKey;
    if (scope && actorKey) {
      try {
        await clearRetailCheckoutIntent(scope, actorKey);
        intentCleared = true;
      } catch {
        setPendingStorageError('Đơn đã ghi nhận, nhưng không xóa được bản yêu cầu cũ trên thiết bị. Đối chiếu yêu cầu trước khi bán đơn tiếp theo.');
      }
    }
    if (intentCleared) setPendingAttempt(null);
    setPendingStatus('uncertain');
    clearCart();
    setCheckoutBusy(false);
    void refreshProducts('');
    if (tab === 'orders') void loadOrdersRef.current?.();
    Alert.alert('Đã thanh toán', `${code}${invoice}`);
  };

  const createCheckoutAttempt = () => {
    if (!scope || !shift || !quote || quoteLoading || !pendingLoaded || pendingAttempt || pendingStorageError || !cartLines.length || !identifiersReady(cartLines)) return null;
    const tenderedAmount = checkoutMethod === 'cash' ? (cashText.trim() ? Number(cashText.replace(/[^\d]/g, '')) : quote.grandTotal) : quote.grandTotal;
    if (!Number.isSafeInteger(tenderedAmount) || tenderedAmount < quote.grandTotal) {
      setCheckoutError('Tiền khách đưa phải bằng hoặc lớn hơn tổng thanh toán.');
      return null;
    }
    const payload = {
      input: orderInput,
      expectedGrandTotal: quote.grandTotal,
      payments: quote.grandTotal > 0
        ? [{ method: checkoutMethod, amount: quote.grandTotal, ...(checkoutMethod === 'cash' ? { tenderedAmount } : {}), ...(checkoutReference.trim() ? { reference: checkoutReference.trim() } : {}) }]
        : [],
      posSessionId: shift._id,
    };
    return { idempotencyKey: idempotencyKey(), payload };
  };

  const submitCheckout = async (attempt?: CheckoutAttempt) => {
    if (!scope || checkoutBusy) return;
    const checkout = attempt || createCheckoutAttempt();
    if (!checkout) return;
    setCheckoutBusy(true);
    setCheckoutError('');
    let requestSent = false;
    try {
      if (!attempt) {
        if (!actorKey) throw new Error('Không xác định được tài khoản đang thu ngân.');
        await saveRetailCheckoutIntent(scope, actorKey, checkout);
        setPendingAttempt(checkout);
      }
      requestSent = true;
      const result = await retailApi.checkout(scope, { ...checkout.payload, idempotencyKey: checkout.idempotencyKey });
      await finishCheckout(result);
    } catch (error) {
      if (!requestSent) {
        setCheckoutError(error instanceof Error ? error.message : 'Không lưu được yêu cầu thanh toán an toàn; chưa gửi giao dịch.');
        return;
      }
      setPendingStatus('uncertain');
      setCheckoutError(error instanceof Error ? error.message : 'Chưa xác định được kết quả thanh toán. Hãy đối chiếu trước khi thử lại.');
    } finally {
      setCheckoutBusy(false);
    }
  };

  const reconcileCheckout = async () => {
    if (!scope || !pendingAttempt || checkoutBusy) return;
    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      const result = await retailApi.reconcileCheckout(scope, pendingAttempt);
      if (result.status === 'completed' && result.order) {
        await finishCheckout({ order: result.order, invoice: result.invoice });
      } else if (result.status === 'not_found') {
        setPendingStatus('not_found');
        setCheckoutError('ERP chưa ghi nhận đơn. Có thể gửi lại đúng yêu cầu này.');
      } else if (result.status === 'processing') {
        setPendingStatus('processing');
        setCheckoutError('Yêu cầu vẫn đang được ERP xử lý. Hãy đối chiếu lại sau.');
      } else if (result.status === 'revoked') {
        await clearRetailCheckoutIntent(scope, actorKey);
        setPendingAttempt(null);
        setPendingStatus('uncertain');
        setCheckoutError('Yêu cầu cũ đã được thu hồi. Hãy báo giá lại trước khi bán.');
        setCartLines((current) => [...current]);
      } else {
        setCheckoutError(result.message || 'Yêu cầu đã được thu hồi. Hãy liên hệ quản lý để kiểm tra.');
      }
    } catch (error) {
      setPendingStatus('uncertain');
      setCheckoutError(error instanceof Error ? error.message : 'Không đối chiếu được giao dịch.');
    } finally {
      setCheckoutBusy(false);
    }
  };

  const revokeUnrecordedCheckout = async () => {
    if (!scope || !actorKey || !pendingAttempt || pendingStatus !== 'not_found' || checkoutBusy) return;
    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      const result = await retailApi.revokeCheckout(scope, pendingAttempt);
      if (result.status === 'completed' && result.order) {
        await finishCheckout({ order: result.order, invoice: result.invoice });
        return;
      }
      if (result.status === 'revoked') {
        await clearRetailCheckoutIntent(scope, actorKey);
        setPendingAttempt(null);
        setPendingStatus('uncertain');
        setQuote(null);
        setCheckoutError('Yêu cầu cũ đã được thu hồi an toàn. Kiểm tra phiên POS và báo giá lại trước khi bán.');
        setCartLines((current) => [...current]);
        await refreshShift();
      }
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Không thu hồi được yêu cầu thanh toán. Hãy tiếp tục đối chiếu.');
    } finally {
      setCheckoutBusy(false);
    }
  };

  const [orders, setOrders] = useState<RetailOrder[]>([]);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const ordersRequestRef = useRef(0);
  const [selectedOrder, setSelectedOrder] = useState<RetailOrder | null>(null);
  const [afterSaleRequest, setAfterSaleRequest] = useState<{ orderId: string; kind: 'return' | 'buyback'; requestId: number } | null>(null);
  const afterSaleRequestRef = useRef(0);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderActionBusy, setOrderActionBusy] = useState(false);
  const [orderActionError, setOrderActionError] = useState('');
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState<'cash' | 'card' | 'transfer' | 'ewallet'>('cash');
  const [collectReference, setCollectReference] = useState('');
  const collectAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelMethod, setCancelMethod] = useState<'cash' | 'card' | 'transfer' | 'ewallet'>('cash');
  const [cancelAttempt, setCancelAttempt] = useState<{ orderId: string; payload: Record<string, unknown>; status: 'uncertain' | 'not_found' | 'processing' } | null>(null);

  const loadOrders = useCallback(async (search = ordersSearch) => {
    if (!scope || !canOperate) return;
    const requestId = ++ordersRequestRef.current;
    setOrdersLoading(true);
    try {
      const result = await retailApi.orders(scope, search);
      if (requestId !== ordersRequestRef.current) return;
      setOrders(result.items || []);
      setOrdersError('');
    } catch (error) {
      if (requestId !== ordersRequestRef.current) return;
      setOrdersError(error instanceof Error ? error.message : 'Không tải được đơn bán.');
    } finally {
      if (requestId === ordersRequestRef.current) setOrdersLoading(false);
    }
  }, [canOperate, ordersSearch, scope]);
  loadOrdersRef.current = loadOrders;

  useEffect(() => {
    ordersRequestRef.current += 1;
    if (tab !== 'orders' || !scope || !canOperate) {
      setOrdersLoading(false);
      return;
    }
    const timer = setTimeout(() => { void loadOrders(ordersSearch); }, ordersSearch ? 250 : 0);
    return () => clearTimeout(timer);
  }, [canOperate, loadOrders, ordersSearch, scope, tab]);

  const openOrder = async (order: RetailOrder) => {
    if (!scope) return;
    setSelectedOrder(order);
    setOrderDetailLoading(true);
    setOrderActionError('');
    try {
      const detail = await retailApi.orderDetail(scope, order._id);
      setSelectedOrder(detail);
      setCollectAmount(formatVndInput(Math.max(0, detail.dueAmount || 0)));
    } catch (error) {
      setOrderActionError(error instanceof Error ? error.message : 'Không tải được chi tiết đơn bán.');
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const startAfterSaleFromOrder = (kind: 'return' | 'buyback') => {
    if (!selectedOrder || !canManage || orderDetailLoading || cancelAttempt) return;
    setAfterSaleRequest({ orderId: selectedOrder._id, kind, requestId: ++afterSaleRequestRef.current });
    setSelectedOrder(null);
    setTab('returns');
  };

  const clearAfterSaleRequest = useCallback(() => setAfterSaleRequest(null), []);

  const collectOrderDue = async () => {
    if (!scope || !selectedOrder || !canManage || orderActionBusy) return;
    const amount = Number(collectAmount.replace(/[^\d]/g, ''));
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > selectedOrder.dueAmount) {
      setOrderActionError('Số tiền thu phải lớn hơn 0 và không vượt quá công nợ còn lại.');
      return;
    }
    if (collectMethod === 'cash' && !shift?._id) {
      setOrderActionError('Cần có phiên POS đang mở để thu tiền mặt.');
      return;
    }
    setOrderActionBusy(true);
    setOrderActionError('');
    try {
      const payload = { payments: [{ method: collectMethod, amount, ...(collectReference.trim() ? { reference: collectReference.trim() } : {}) }], expectedVersion: selectedOrder.version || 0, ...(collectMethod === 'cash' && shift?._id ? { cashSessionId: shift._id } : {}) };
      const fingerprint = JSON.stringify({ orderId: selectedOrder._id, ...payload });
      if (collectAttemptRef.current?.fingerprint !== fingerprint) collectAttemptRef.current = { fingerprint, key: idempotencyKey() };
      const updated = await retailApi.collectPayment(scope, selectedOrder._id, {
        ...payload,
        idempotencyKey: collectAttemptRef.current.key,
      });
      collectAttemptRef.current = null;
      setSelectedOrder(updated);
      setCollectAmount(formatVndInput(Math.max(0, updated.dueAmount || 0)));
      setCollectReference('');
      await loadOrders();
    } catch (error) {
      setOrderActionError(error instanceof Error ? error.message : 'Chưa xác nhận được khoản thu. Kiểm tra lại đơn trước khi thử lần nữa.');
    } finally {
      setOrderActionBusy(false);
    }
  };

  const sendCancelAttempt = async () => {
    if (!scope || !cancelAttempt || orderActionBusy) return;
    setOrderActionBusy(true);
    setOrderActionError('');
    try {
      const updated = await retailApi.cancelOrder(scope, cancelAttempt.orderId, cancelAttempt.payload);
      setSelectedOrder(updated);
      setCancelAttempt(null);
      setCancelReason('');
      await loadOrders();
      Alert.alert('Đã hủy đơn', 'ERP đã ghi nhận kết quả hủy và hoàn tiền.');
    } catch (error) {
      setCancelAttempt((current) => current ? { ...current, status: 'uncertain' } : null);
      setOrderActionError(error instanceof Error ? error.message : 'Chưa rõ kết quả hủy. Đối chiếu yêu cầu cũ trước khi thử lại.');
    } finally {
      setOrderActionBusy(false);
    }
  };

  const startCancelOrder = () => {
    if (!scope || !selectedOrder || !canManage || orderActionBusy || !cancelReason.trim()) {
      setOrderActionError('Nhập lý do hủy đơn trước khi tiếp tục.');
      return;
    }
    if (cancelAttempt) {
      setOrderActionError('Đối chiếu hoặc thu hồi yêu cầu hủy cũ trước khi tạo yêu cầu khác.');
      return;
    }
    const refundAmount = Math.max(0, selectedOrder.paidAmount - Number((selectedOrder as RetailOrder & { refundedAmount?: number }).refundedAmount || 0));
    if (refundAmount > 0 && cancelMethod === 'cash' && !shift?._id) {
      setOrderActionError('Cần có phiên POS đang mở để hoàn tiền mặt.');
      return;
    }
    const payload = {
      reason: cancelReason.trim(),
      refunds: refundAmount > 0 ? [{ method: cancelMethod, amount: refundAmount }] : [],
      ...(refundAmount > 0 && cancelMethod === 'cash' && shift?._id ? { cashSessionId: shift._id } : {}),
      expectedVersion: selectedOrder.version || 0,
      idempotencyKey: idempotencyKey(),
    };
    Alert.alert('Xác nhận hủy đơn?', refundAmount ? `Đơn sẽ bị hủy và hoàn ${money(refundAmount)} qua ${cancelMethod === 'cash' ? 'tiền mặt' : cancelMethod === 'card' ? 'thẻ' : cancelMethod === 'transfer' ? 'chuyển khoản' : 'ví điện tử'}.` : 'Đơn sẽ bị hủy. Không có khoản thanh toán để hoàn.', [
      { text: 'Quay lại', style: 'cancel' },
      { text: 'Hủy đơn', style: 'destructive', onPress: () => { setCancelAttempt({ orderId: selectedOrder._id, payload, status: 'uncertain' }); void (async () => { if (!scope) return; setOrderActionBusy(true); setOrderActionError(''); try { const updated = await retailApi.cancelOrder(scope, selectedOrder._id, payload); setSelectedOrder(updated); setCancelAttempt(null); setCancelReason(''); await loadOrders(); Alert.alert('Đã hủy đơn', 'ERP đã ghi nhận kết quả hủy và hoàn tiền.'); } catch (error) { setOrderActionError(error instanceof Error ? error.message : 'Chưa rõ kết quả hủy. Đối chiếu yêu cầu cũ trước khi thử lại.'); } finally { setOrderActionBusy(false); } })(); } },
    ]);
  };

  const reconcileCancelOrder = async () => {
    if (!scope || !cancelAttempt || orderActionBusy) return;
    setOrderActionBusy(true); setOrderActionError('');
    try {
      const result = await retailApi.reconcileCancellation(scope, cancelAttempt.orderId, cancelAttempt.payload);
      if (result.status === 'completed' && result.order) { setSelectedOrder(result.order); setCancelAttempt(null); setCancelReason(''); await loadOrders(); }
      else if (result.status === 'not_found') setCancelAttempt((current) => current ? { ...current, status: 'not_found' } : null);
      else if (result.status === 'processing') setCancelAttempt((current) => current ? { ...current, status: 'processing' } : null);
      else if (result.status === 'revoked') setCancelAttempt(null);
      setOrderActionError(result.message || (result.status === 'completed' ? '' : 'Trạng thái yêu cầu hủy đã được đối chiếu.'));
    } catch (error) { setOrderActionError(error instanceof Error ? error.message : 'Không đối chiếu được yêu cầu hủy.'); }
    finally { setOrderActionBusy(false); }
  };

  const revokeCancelOrder = async () => {
    if (!scope || !cancelAttempt || cancelAttempt.status !== 'not_found' || orderActionBusy) return;
    setOrderActionBusy(true); setOrderActionError('');
    try { const result = await retailApi.revokeCancellation(scope, cancelAttempt.orderId, cancelAttempt.payload); setCancelAttempt(null); setOrderActionError(result.message || 'Đã thu hồi yêu cầu hủy chưa được ghi nhận.'); }
    catch (error) { setOrderActionError(error instanceof Error ? error.message : 'Không thu hồi được yêu cầu hủy. Hãy tiếp tục đối chiếu.'); }
    finally { setOrderActionBusy(false); }
  };

  const openShift = async (input: RetailShiftOpenInput) => {
    if (!scope || !canManage || shiftBusy) return;
    if (!input.cashierId || !Number.isSafeInteger(input.openingFloat) || input.openingFloat < 0) {
      setShiftError('Quỹ đầu ca phải là số nguyên không âm.');
      return;
    }
    setShiftBusy(true);
    setShiftError('');
    try {
      const opened = await retailApi.openShift(scope, input);
      setOpenShiftModal(false);
      const cashier = cashiers.find((item) => item.id === input.cashierId);
      if (input.cashierId === currentCashierId) {
        try {
          setShift(await retailApi.resumeShift(scope, opened._id, opened.terminalId || ''));
          setShiftError('');
        } catch (error) {
          await refreshShift();
          setShiftError(`Đã mở ca ${opened.shiftCode}, nhưng chưa thể tiếp tục trên thiết bị này: ${error instanceof Error ? error.message : 'Không kết nối được thiết bị POS.'}`);
        }
      } else {
        await refreshShift();
        setTab('shifts');
        Alert.alert('Đã mở ca POS', `${opened.shiftCode} · ${cashier?.name || 'Nhân viên bán hàng'}. Nhân viên đăng nhập tài khoản của mình để tiếp tục ca.`);
      }
    } catch (error) {
      setShiftError(error instanceof Error ? error.message : 'Không mở được phiên POS.');
    } finally {
      setShiftBusy(false);
    }
  };

  const resumeShift = async () => {
    if (!scope || !shift || shiftBusy) return;
    setShiftBusy(true);
    setShiftError('');
    try {
      setShift(await retailApi.resumeShift(scope, shift._id, shift.terminalId || ''));
    } catch (error) {
      setShiftError(error instanceof Error ? error.message : 'Không tiếp tục được phiên POS.');
    } finally {
      setShiftBusy(false);
    }
  };

  const closeShift = async () => {
    if (!scope || !shift || shiftBusy) return;
    setShiftBusy(true);
    setShiftError('');
    try {
      await retailApi.closeShift(scope, shift._id);
      setShift(null);
      clearCart();
      setCloseConfirm(false);
      await refreshShift();
    } catch (error) {
      setShiftError(error instanceof Error ? error.message : 'Không đóng được phiên POS.');
    } finally {
      setShiftBusy(false);
    }
  };

  const totalQuantity = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const cashAmount = cashText.trim() ? Number(cashText.replace(/[^\d]/g, '')) || 0 : quote?.grandTotal || 0;
  const changeAmount = quote ? Math.max(0, cashAmount - quote.grandTotal) : 0;
  const paymentAmountReady = checkoutMethod !== 'cash' || cashAmount >= (quote?.grandTotal || 0);
  const shiftOnThisTerminal = Boolean(scope && shift && shift.terminalId === scope.terminalId);
  const orderRefundableAmount = selectedOrder ? Math.max(0, selectedOrder.paidAmount - Number((selectedOrder as RetailOrder & { refundedAmount?: number }).refundedAmount || 0)) : 0;
  const selectedOrderCanCancel = Boolean(selectedOrder && ['draft', 'confirmed', 'completed'].includes(selectedOrder.status));

  return (
    <View style={styles.root}>
      <Stack.Screen options={{
        title: 'Bán lẻ',
        headerRight: branches.length > 0 && canSwitchBranch ? () => (
          <Pressable accessibilityRole="button" disabled={Boolean(pendingAttempt) || !pendingLoaded || shiftBusy} onPress={() => setBranchPicker(true)} style={[styles.branchButton, (Boolean(pendingAttempt) || !pendingLoaded || shiftBusy) && styles.buttonDisabled]}>
            <Text numberOfLines={1} style={styles.branchButtonText}>{branchName}</Text>
            <ChevronDown size={14} color={colors.primary} />
          </Pressable>
        ) : undefined,
      }} />

      {!hasRetailAccess ? (
        <View style={styles.stateBox}>
          <ShoppingCart size={28} color={colors.muted} />
          <Text style={styles.stateTitle}>Chưa có quyền sử dụng bán lẻ</Text>
          <Text style={styles.stateCopy}>Cần quyền retail:read để tra cứu hoặc pos:manage / retail:manage để vận hành bán hàng.</Text>
        </View>
      ) : !user?.companyCode || !branchId || !terminalId ? (
        <View style={styles.stateBox}>
          {branchLoading ? <ActivityIndicator color={colors.primary} /> : <MapPinned size={28} color={colors.muted} />}
          <Text style={styles.stateTitle}>{branchLoading ? 'Đang tải chi nhánh' : 'Chưa có chi nhánh bán hàng'}</Text>
          <Text style={styles.stateCopy}>Chọn chi nhánh được phân quyền để tải quầy POS.</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}>
            {visibleTabs.map((item) => <TabButton key={item.id} selected={tab === item.id} label={item.label} icon={item.icon} onPress={() => setTab(item.id)} />)}
          </ScrollView>

          {tab === 'pos' ? (
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={shiftLoading || productLoading} onRefresh={() => { void refreshShift(); void refreshProducts(); }} />}
            >
              {!!pendingStorageError && <Card style={styles.pendingCard}>
                <Text style={styles.cardTitle}>Chưa thể xác minh yêu cầu thanh toán</Text>
                <Text style={styles.errorText}>{pendingStorageError}</Text>
              </Card>}
              {!pendingLoaded && <Card style={styles.pendingCard}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Đang kiểm tra yêu cầu thanh toán đã lưu…</Text></Card>}
              {!!pendingAttempt && <Card style={styles.pendingCard}>
                <View style={styles.pendingHeading}><CircleAlert size={18} color="#C27617" /><Text style={styles.cardTitle}>Cần đối chiếu giao dịch</Text></View>
                <Text style={styles.cardCopy}>Mã yêu cầu {pendingAttempt.idempotencyKey.slice(0, 18)}… · {money(Number(pendingAttempt.payload.expectedGrandTotal || 0))}</Text>
                {!!checkoutError && <Text style={styles.errorText}>{checkoutError}</Text>}
                <PrimaryButton disabled={checkoutBusy} label={checkoutBusy ? 'Đang đối chiếu…' : 'Đối chiếu giao dịch'} onPress={() => void reconcileCheckout()} />
                {pendingStatus === 'not_found' && <>
                  <SecondaryButton disabled={checkoutBusy} label="Gửi lại đúng yêu cầu này" onPress={() => void submitCheckout(pendingAttempt)} />
                  <SecondaryButton disabled={checkoutBusy} label="Thu hồi để sửa giỏ hàng" onPress={() => void revokeUnrecordedCheckout()} />
                </>}
              </Card>}
              {shiftLoading ? (
                <Card><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Đang tải phiên bán hàng…</Text></Card>
              ) : !shift ? (
                <Card style={styles.shiftCard}>
                  <View style={styles.cardIcon}><Clock3 size={22} color={colors.primary} /></View>
                  <Text style={styles.cardTitle}>Chưa có phiên bán hàng</Text>
                  <Text style={styles.cardCopy}>{canManage ? 'Mở ca POS để bắt đầu bán tại chi nhánh này.' : 'Vui lòng nhờ quản lý mở ca POS cho tài khoản của bạn.'}</Text>
                  {canManage && <PrimaryButton disabled={shiftBusy} label="Mở ca POS" onPress={() => { setShiftError(''); setCashiersError(''); setOpenShiftModal(true); }} />}
                  {!!shiftError && <Text style={styles.errorText}>{shiftError}</Text>}
                </Card>
              ) : !shiftOnThisTerminal ? (
                <Card style={styles.shiftCard}>
                  <View style={styles.cardIcon}><CircleAlert size={22} color="#C27617" /></View>
                  <Text style={styles.cardTitle}>{shift.terminalId ? 'Phiên đang mở trên quầy khác' : 'Ca đang chờ gắn thiết bị'}</Text>
                  <Text style={styles.cardCopy}>{shift.terminalId ? 'Tiếp tục trên thiết bị này sẽ chuyển phiên khỏi quầy đang dùng.' : 'Tiếp tục ca trên thiết bị này để bắt đầu bán hàng.'}</Text>
                  <PrimaryButton disabled={shiftBusy} label={shiftBusy ? 'Đang tiếp tục…' : 'Tiếp tục phiên trên máy này'} onPress={() => void resumeShift()} />
                  <SecondaryButton disabled={shiftBusy} label="Tải lại phiên" onPress={() => void refreshShift()} />
                  {!!shiftError && <Text style={styles.errorText}>{shiftError}</Text>}
                </Card>
              ) : (
                <>
                  <View style={styles.shiftStrip}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shiftCode}>{shift.shiftCode}</Text>
                      <Text style={styles.shiftMeta}>Ca ngày {shift.businessDate} · Quỹ đầu ca {money(shift.openingFloat)}</Text>
                    </View>
                    <Pressable accessibilityRole="button" disabled={Boolean(pendingAttempt)} onPress={() => setCloseConfirm(true)} style={[styles.closeShiftButton, Boolean(pendingAttempt) && styles.buttonDisabled]}>
                      <Text style={styles.closeShiftText}>Đóng ca</Text>
                    </Pressable>
                  </View>

                  <View style={styles.searchBox}>
                    <Search size={18} color={colors.muted} />
                    <TextInput
                      value={productSearch}
                      onChangeText={setProductSearch}
                      placeholder="Tìm tên hàng, SKU hoặc mã vạch"
                      placeholderTextColor={colors.muted}
                      style={styles.searchInput}
                      returnKeyType="search"
                    />
                    {!!productSearch && <Pressable onPress={() => setProductSearch('')} style={styles.clearIconBtn}><X size={16} color={colors.muted} /></Pressable>}
                  </View>
                  {!!productError && <Text style={styles.errorText}>{productError}</Text>}
                  {productLoading && products.length === 0 ? <ActivityIndicator style={{ margin: 20 }} color={colors.primary} /> : (
                    <View style={styles.productGrid}>
                      {products.map((product) => (
                        <Pressable
                          key={product._id}
                          disabled={product.stock <= 0 || product.price <= 0 || Boolean(pendingAttempt) || !pendingLoaded || Boolean(pendingStorageError)}
                          onPress={() => addProduct(product)}
                          style={[styles.productCard, (product.stock <= 0 || product.price <= 0 || pendingAttempt || !pendingLoaded || pendingStorageError) && styles.disabledCard]}
                        >
                          <View style={styles.productTop}>
                            <Text numberOfLines={1} style={styles.productSku}>{product.sku}</Text>
                            <View style={styles.addBadge}><Plus size={14} color={colors.primary} /></View>
                          </View>
                          <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
                          <Text style={styles.productPrice}>{money(product.price)}</Text>
                          <View style={[styles.stockPill, product.stock <= 0 && styles.stockPillEmpty]}>
                            <Text style={[styles.productStock, product.stock <= 0 && styles.stockEmpty]}>
                              {product.stock > 0 ? `Tồn ${product.stock} ${product.unit}` : 'Hết hàng'}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {!productLoading && products.length === 0 && <Text style={styles.emptyText}>Không tìm thấy sản phẩm đang bán ở chi nhánh này.</Text>}

                  <View style={styles.sectionHeading}>
                    <Text style={styles.sectionTitle}>Giỏ hàng</Text>
                    <View style={styles.countPill}><Text style={styles.sectionCount}>{totalQuantity} sản phẩm</Text></View>
                  </View>
                  {cartLines.length === 0 ? (
                    <View style={styles.emptyCart}><ShoppingCart size={24} color={colors.muted} /><Text style={styles.emptyCartText}>Chọn sản phẩm để bắt đầu đơn bán.</Text></View>
                  ) : (
                    <View style={styles.cartList}>
                      {cartLines.map((line, index) => {
                        const tracked = line.product.trackingMode === 'serial' || line.product.trackingMode === 'unit_barcode';
                        return (
                          <View key={`${line.product._id}-${index}`} style={[styles.cartLine, index === cartLines.length - 1 && { borderBottomWidth: 0 }]}>
                            <View style={styles.cartLineHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.cartProductName}>{line.product.name}</Text>
                                <Text style={styles.cartProductMeta}>{line.product.sku} · {money(line.product.price)}</Text>
                              </View>
                              {tracked ? <Pressable disabled={Boolean(pendingAttempt)} onPress={() => updateQuantity(index, 0)} style={styles.removeButton}><X size={16} color="#C74848" /></Pressable> : (
                                <View style={styles.quantityControl}>
                                  <Pressable disabled={Boolean(pendingAttempt)} accessibilityLabel="Giảm số lượng" onPress={() => updateQuantity(index, line.quantity - 1)} style={styles.quantityButton}><Minus size={14} color={colors.ink} /></Pressable>
                                  <Text style={styles.quantityValue}>{line.quantity}</Text>
                                  <Pressable disabled={Boolean(pendingAttempt)} accessibilityLabel="Tăng số lượng" onPress={() => updateQuantity(index, line.quantity + 1)} style={styles.quantityButton}><Plus size={14} color={colors.ink} /></Pressable>
                                </View>
                              )}
                            </View>
                            {tracked && <>
                              <Text style={styles.fieldLabel}>{line.product.trackingMode === 'serial' ? 'IMEI / Serial' : 'Mã vạch từng đơn vị'} · {line.quantity} mã</Text>
                              <TextInput
                                value={line.identifiers}
                                editable={!pendingAttempt}
                                onChangeText={(identifiers) => setCartLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, identifiers } : item))}
                                placeholder="Quét hoặc nhập mã, phân tách bằng dấu cách"
                                placeholderTextColor={colors.muted}
                                style={styles.input}
                                autoCapitalize="characters"
                              />
                            </>}
                          </View>
                        );
                      })}
                      <Pressable disabled={Boolean(pendingAttempt)} onPress={clearCart} style={styles.clearCartButton}><Text style={styles.clearCartText}>Xóa giỏ hàng</Text></Pressable>
                    </View>
                  )}

                  {cartLines.length > 0 && (
                    <View style={styles.checkoutCard}>
                      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Thông tin đơn hàng</Text><Text style={styles.cashOnly}>POS</Text></View>
                      {selectedCustomer ? (
                        <View style={styles.customerSelected}><View style={{ flex: 1 }}><Text style={styles.cartProductName}>{selectedCustomer.name}</Text><Text style={styles.cartProductMeta}>{selectedCustomer.customerCode} · {selectedCustomer.phone}{selectedCustomer.tier?.name ? ` · ${selectedCustomer.tier.name}` : ''}</Text></View><Pressable onPress={() => { setSelectedCustomer(null); setCouponCode(''); setPointsToRedeem('0'); }} style={styles.clearIconBtn}><X size={16} color={colors.muted} /></Pressable></View>
                      ) : (
                        <>
                          <Text style={styles.fieldLabel}>Khách hàng (không bắt buộc)</Text>
                          <TextInput value={customerQuery} onChangeText={setCustomerQuery} style={styles.input} placeholder="Tìm tên, số điện thoại hoặc mã khách" placeholderTextColor={colors.muted} />
                          {customerResults.map((customer) => <Pressable key={customer.customerId} onPress={() => { setSelectedCustomer(customer); setCustomerQuery(''); setCustomerResults([]); }} style={styles.customerOption}><Text style={styles.cartProductName}>{customer.name}</Text><Text style={styles.cartProductMeta}>{customer.customerCode} · {customer.phone}</Text></Pressable>)}
                        </>
                      )}
                      <Text style={styles.fieldLabel}>Mã ưu đãi</Text>
                      <TextInput value={couponCode} onChangeText={setCouponCode} editable={!pendingAttempt} style={styles.input} placeholder="Nhập mã hoặc chọn ưu đãi bên dưới" placeholderTextColor={colors.muted} autoCapitalize="characters" />
                      {selectableCoupons.length > 0 && <View style={styles.paymentMethods}>{selectableCoupons.map((coupon) => <Pressable key={coupon._id} onPress={() => setCouponCode(coupon.code)} style={[styles.paymentMethod, couponCode === coupon.code && styles.paymentMethodSelected]}><Text style={[styles.paymentMethodText, couponCode === coupon.code && styles.paymentMethodTextSelected]}>{coupon.code}</Text></Pressable>)}</View>}
                      <View style={styles.posExtraFields}>
                        <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Giảm giá đơn (VND)</Text><TextInput value={orderDiscountText} onChangeText={(v) => setOrderDiscountText(formatVndInput(v))} keyboardType="numeric" style={styles.input} placeholder="0" placeholderTextColor={colors.muted} /></View>
                        <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Phí giao hàng (VND)</Text><TextInput value={shippingFeeText} onChangeText={(v) => setShippingFeeText(formatVndInput(v))} keyboardType="numeric" style={styles.input} placeholder="0" placeholderTextColor={colors.muted} /></View>
                      </View>
                      <View style={styles.posExtraFields}>
                        <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Thuế (%)</Text><TextInput value={taxRateText} onChangeText={(v) => setTaxRateText(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" style={styles.input} placeholder="Theo cài đặt ERP" placeholderTextColor={colors.muted} /></View>
                        <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Điểm sử dụng</Text><TextInput value={pointsToRedeem} onChangeText={(v) => setPointsToRedeem(v.replace(/[^\d]/g, ''))} keyboardType="number-pad" style={[styles.input, !selectedCustomer && styles.inputDisabled]} editable={Boolean(selectedCustomer)} placeholder="0" placeholderTextColor={colors.muted} /></View>
                      </View>
                      <Text style={styles.fieldLabel}>Ghi chú đơn hàng</Text>
                      <TextInput value={orderNote} onChangeText={setOrderNote} style={styles.input} placeholder="Ghi chú cho đơn bán" placeholderTextColor={colors.muted} />
                      {quoteLoading ? <View style={styles.quoteLoading}><ActivityIndicator color={colors.primary} /><Text style={styles.quoteLoadingText}>Đang tính giá từ ERP…</Text></View> : quote ? (
                        <>
                          <View style={styles.totalsBox}>
                            <View style={styles.totalRow}><Text style={styles.totalLabel}>Tạm tính</Text><Text style={styles.totalValue}>{money(quote.subtotal)}</Text></View>
                            {!!quote.orderDiscount && <View style={styles.totalRow}><Text style={styles.totalLabel}>Giảm giá</Text><Text style={[styles.totalValue, { color: '#027A48' }]}>−{money(quote.orderDiscount)}</Text></View>}
                            {!!quote.taxAmount && <View style={styles.totalRow}><Text style={styles.totalLabel}>Thuế ({quote.taxRate}%)</Text><Text style={styles.totalValue}>{money(quote.taxAmount)}</Text></View>}
                            <View style={[styles.totalRow, styles.grandTotalRow]}><Text style={styles.grandTotalLabel}>Tổng thanh toán</Text><Text style={styles.grandTotalValue}>{money(quote.grandTotal)}</Text></View>
                          </View>
                          <Text style={styles.fieldLabel}>Phương thức thanh toán</Text>
                          <View style={styles.paymentMethods}>{(['cash', 'card', 'transfer', 'ewallet'] as const).map((method) => <Pressable key={method} onPress={() => setCheckoutMethod(method)} style={[styles.paymentMethod, checkoutMethod === method && styles.paymentMethodSelected]}><Text style={[styles.paymentMethodText, checkoutMethod === method && styles.paymentMethodTextSelected]}>{paymentMethodLabel(method)}</Text></Pressable>)}</View>
                          {checkoutMethod !== 'cash' && <TextInput value={checkoutReference} onChangeText={setCheckoutReference} editable={!pendingAttempt} style={[styles.input, { marginTop: 10 }]} placeholder="Mã giao dịch / tham chiếu (nếu có)" placeholderTextColor={colors.muted} />}
                          {checkoutMethod === 'cash' && <><Text style={styles.fieldLabel}>Tiền khách đưa (VND)</Text><TextInput value={cashText} editable={!pendingAttempt} onChangeText={(value) => { setCashTouched(true); setCashText(formatVndInput(value)); }} keyboardType="numeric" style={styles.input} placeholder={formatVndInput(quote.grandTotal)} placeholderTextColor={colors.muted} />{cashAmount >= quote.grandTotal && <View style={styles.changeRow}><Text style={styles.totalLabel}>Tiền thối lại</Text><Text style={styles.changeValue}>{money(changeAmount)}</Text></View>}</>}
                          {!!quoteError && <Text style={styles.errorText}>{quoteError}</Text>}
                          {!!checkoutError && <Text style={styles.errorText}>{checkoutError}</Text>}
                          {pendingAttempt ? (
                            <Text style={styles.cardCopy}>Đối chiếu yêu cầu đang chờ ở đầu màn hình trước khi tiếp tục.</Text>
                          ) : (
                            <PrimaryButton
                              disabled={checkoutBusy || quoteLoading || !pendingLoaded || Boolean(pendingStorageError) || !identifiersReady(cartLines) || !paymentAmountReady || (Number(taxRateText) < 0) || (Number(pointsToRedeem) > 0 && !selectedCustomer)}
                              label={checkoutBusy ? 'Đang thanh toán…' : `Thanh toán ${money(quote.grandTotal)}`}
                              onPress={() => void submitCheckout()}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          {!!quoteError && <Text style={styles.errorText}>{quoteError}</Text>}
                          {!quoteError && <Text style={styles.cardCopy}>Báo giá sẽ được xác nhận từ ERP trước khi thu tiền.</Text>}
                        </>
                      )}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          ) : tab === 'orders' ? (
            <View style={styles.content}>
              <View style={styles.ordersSearchRow}>
                <View style={[styles.searchBox, { flex: 1, marginBottom: 0 }]}>
                  <Search size={18} color={colors.muted} />
                  <TextInput value={ordersSearch} onChangeText={setOrdersSearch} placeholder="Mã đơn, tên hoặc số điện thoại" placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" />
                  {!!ordersSearch && <Pressable onPress={() => setOrdersSearch('')} style={styles.clearIconBtn}><X size={16} color={colors.muted} /></Pressable>}
                </View>
                <Pressable onPress={() => void loadOrders()} style={styles.refreshButton}><RefreshCw size={18} color={colors.primary} /></Pressable>
              </View>
              {!!ordersError && <Text style={[styles.errorText, { paddingHorizontal: 14 }]}>{ordersError}</Text>}
              {ordersLoading && orders.length === 0 ? <ActivityIndicator style={{ margin: 24 }} color={colors.primary} /> : (
                <ScrollView contentContainerStyle={styles.orderList} refreshControl={<RefreshControl refreshing={ordersLoading} onRefresh={() => void loadOrders()} />}>
                  {orders.map((order) => <OrderCard key={order._id} order={order} onPress={() => void openOrder(order)} />)}
                  {!ordersLoading && orders.length === 0 && <Text style={styles.emptyText}>Chưa có đơn bán phù hợp.</Text>}
                </ScrollView>
              )}
            </View>
          ) : scope ? <RetailAuxPanel tab={tab} scope={scope} canManage={canManage} canManagePoints={canManagePoints} terminalId={terminalId} currentCashierId={currentCashierId} afterSaleRequest={afterSaleRequest} onAfterSaleRequestHandled={clearAfterSaleRequest} /> : <View style={styles.stateBox}><ActivityIndicator color={colors.primary} /><Text style={styles.stateCopy}>Đang chuẩn bị phạm vi chi nhánh…</Text></View>}
        </>
      )}

      <RetailShiftOpenModal
        visible={openShiftModal}
        cashiers={cashiers}
        cashiersLoading={cashiersLoading}
        saving={shiftBusy}
        error={cashiersError || shiftError}
        initialCashierId={currentCashierId}
        onClose={() => setOpenShiftModal(false)}
        onOpen={(input) => void openShift(input)}
      />

      <Modal visible={branchPicker} transparent animationType="fade" onRequestClose={() => setBranchPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBranchPicker(false)}>
          <Pressable style={styles.branchSheet} onPress={() => {}}>
            <View style={styles.modalHeading}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MapPinned size={18} color={colors.primary} />
                <Text style={styles.modalTitle}>Chọn chi nhánh</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setBranchPicker(false)} style={styles.modalCloseBtn}><X size={18} color={colors.muted} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 6, paddingTop: 6 }}>
              {branches.map((branch) => {
                const selected = branch._id === branchId;
                return <Pressable key={branch._id} disabled={Boolean(pendingAttempt) || shiftBusy} onPress={() => { setActiveBranchId(branch._id); setBranchPicker(false); clearCart(); }} style={[styles.branchRow, selected && styles.branchRowSelected, (Boolean(pendingAttempt) || shiftBusy) && styles.buttonDisabled]}>
                  <Text style={[styles.branchRowText, selected && styles.branchRowTextSelected]}>{branch.name}</Text>
                  {selected && <Check size={17} color={colors.primary} />}
                </Pressable>;
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={closeConfirm} transparent animationType="fade" onRequestClose={() => setCloseConfirm(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmSheet}>
            <Text style={styles.modalTitle}>Đóng phiên bán hàng?</Text>
            <Text style={[styles.cardCopy, { textAlign: 'left', marginTop: 8 }]}>Đơn bán trong phiên sẽ được chốt theo phiên POS hiện tại.</Text>
            {!!shiftError && <Text style={styles.errorText}>{shiftError}</Text>}
            <View style={styles.modalActionsRow}>
              <View style={{ flex: 1 }}><SecondaryButton disabled={shiftBusy} label="Quay lại" onPress={() => setCloseConfirm(false)} /></View>
              <View style={{ flex: 1 }}><PrimaryButton disabled={shiftBusy} label={shiftBusy ? 'Đang đóng…' : 'Đóng phiên'} onPress={() => void closeShift()} /></View>
            </View>
          </View>
        </View>
      </Modal>

      <FullScreenFormModal
        visible={Boolean(selectedOrder)}
        title="Chi tiết đơn bán"
        onClose={() => { if (!cancelAttempt) setSelectedOrder(null); }}
      >
        {orderDetailLoading ? <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} /> : selectedOrder && (() => {
          const statusMeta = orderStatusMeta(selectedOrder.status);
          const payMeta = paymentStatusMeta(selectedOrder.paymentStatus, selectedOrder.dueAmount);
          return (
            <View style={{ gap: 12, paddingTop: 2, paddingBottom: 8 }}>
                  <View style={styles.detailHero}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.orderCode, { flexShrink: 1 }]}>{selectedOrder.orderCode || selectedOrder._id}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: statusMeta.fg }]}>{statusMeta.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.orderCustomer}>{selectedOrder.customerName || 'Khách lẻ'}{selectedOrder.customerPhone ? ` · ${selectedOrder.customerPhone}` : ''}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={styles.orderDate}>{dateTime(selectedOrder.createdAt)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: payMeta.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: payMeta.fg }]}>{payMeta.label}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Sản phẩm ({selectedOrder.items.length})</Text>
                    {selectedOrder.items.map((item, index) => (
                      <View key={`${item.sku}-${index}`} style={[styles.orderDetailLine, index === selectedOrder.items.length - 1 && { borderBottomWidth: 0 }]}>
                        <Text style={styles.cartProductName}>{item.productName}</Text>
                        <Text style={styles.cartProductMeta}>{item.sku} · {item.quantity} × {money(item.unitPrice || 0)} = {money(item.lineTotal)}</Text>
                        {(item.serialNumbers?.length || item.internalBarcodes?.length) ? <Text style={styles.cartProductMeta}>IMEI / mã máy: {[...(item.serialNumbers || []), ...(item.internalBarcodes || [])].join(', ')}</Text> : null}
                      </View>
                    ))}
                  </View>

                  {canManage && <View style={styles.checkoutCard}>
                    <Text style={styles.detailSectionTitle}>Tạo chứng từ từ đơn này</Text>
                    <View style={styles.modalActionsRow}>
                      <View style={{ flex: 1 }}><SecondaryButton disabled={orderActionBusy || Boolean(cancelAttempt)} label="Trả hàng" onPress={() => startAfterSaleFromOrder('return')} /></View>
                      <View style={{ flex: 1 }}><SecondaryButton disabled={orderActionBusy || Boolean(cancelAttempt)} label="Thu mua lại" onPress={() => startAfterSaleFromOrder('buyback')} /></View>
                    </View>
                  </View>}

                  <View style={styles.totalsBox}>
                    <View style={styles.totalRow}><Text style={styles.totalLabel}>Tạm tính</Text><Text style={styles.totalValue}>{money(selectedOrder.subtotal)}</Text></View>
                    {!!selectedOrder.orderDiscount && <View style={styles.totalRow}><Text style={styles.totalLabel}>Giảm giá</Text><Text style={[styles.totalValue, { color: '#027A48' }]}>−{money(selectedOrder.orderDiscount)}</Text></View>}
                    {!!selectedOrder.taxAmount && <View style={styles.totalRow}><Text style={styles.totalLabel}>Thuế</Text><Text style={styles.totalValue}>{money(selectedOrder.taxAmount)}</Text></View>}
                    {!!selectedOrder.shippingFee && <View style={styles.totalRow}><Text style={styles.totalLabel}>Phí giao hàng</Text><Text style={styles.totalValue}>{money(selectedOrder.shippingFee)}</Text></View>}
                    <View style={[styles.totalRow, styles.grandTotalRow]}><Text style={styles.grandTotalLabel}>Tổng thanh toán</Text><Text style={styles.grandTotalValue}>{money(selectedOrder.grandTotal)}</Text></View>
                    <View style={styles.totalRow}><Text style={styles.totalLabel}>Đã thu</Text><Text style={[styles.totalValue, { color: '#027A48' }]}>{money(selectedOrder.paidAmount)}</Text></View>
                    {selectedOrder.dueAmount > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>Còn nợ</Text><Text style={[styles.totalValue, { color: '#B42318' }]}>{money(selectedOrder.dueAmount)}</Text></View>}
                  </View>

                  {Boolean(selectedOrder.payments?.length) && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Lịch sử thanh toán</Text>
                      {(selectedOrder.payments || []).map((payment, index) => (
                        <View key={index} style={[styles.orderDetailLine, index === (selectedOrder.payments?.length || 1) - 1 && { borderBottomWidth: 0 }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.cartProductName}>{paymentMethodLabel(payment.method)}</Text>
                            <Text style={[styles.totalValue, { color: colors.primary }]}>{money(payment.amount)}</Text>
                          </View>
                          <Text style={styles.cartProductMeta}>
                            {payment.paidAt ? dateTime(payment.paidAt) : '—'}{payment.reference ? ` · ${payment.reference}` : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {!!orderActionError && <Text style={styles.errorText}>{orderActionError}</Text>}

                  {canManage && selectedOrder.dueAmount > 0 && <View style={styles.checkoutCard}>
                    <Text style={styles.detailSectionTitle}>Thu công nợ</Text>
                    <Text style={styles.fieldLabel}>Số tiền thu (VND)</Text>
                    <TextInput value={collectAmount} onChangeText={(v) => setCollectAmount(formatVndInput(v))} keyboardType="numeric" style={styles.input} placeholder="Nhập số tiền" placeholderTextColor={colors.muted} />
                    <View style={styles.paymentMethods}>{(['cash', 'card', 'transfer', 'ewallet'] as const).map((method) => <Pressable key={method} onPress={() => setCollectMethod(method)} style={[styles.paymentMethod, collectMethod === method && styles.paymentMethodSelected]}><Text style={[styles.paymentMethodText, collectMethod === method && styles.paymentMethodTextSelected]}>{paymentMethodLabel(method)}</Text></Pressable>)}</View>
                    {collectMethod !== 'cash' && <TextInput value={collectReference} onChangeText={setCollectReference} style={[styles.input, { marginTop: 10 }]} placeholder="Mã tham chiếu (nếu có)" placeholderTextColor={colors.muted} />}
                    <PrimaryButton disabled={orderActionBusy} label={orderActionBusy ? 'Đang ghi nhận…' : 'Ghi nhận thanh toán'} onPress={() => void collectOrderDue()} />
                  </View>}

                  {canManage && selectedOrderCanCancel && <View style={[styles.checkoutCard, { borderColor: '#FECACA', backgroundColor: '#FFFBFB' }]}>
                    <Text style={[styles.detailSectionTitle, { color: '#B42318' }]}>Hủy đơn / hoàn tiền</Text>
                    <Text style={[styles.cardCopy, { textAlign: 'left', marginTop: 4 }]}>Số tiền có thể hoàn: {money(orderRefundableAmount)}. Hủy đơn không thể tự hoàn tác.</Text>
                    <TextInput value={cancelReason} onChangeText={setCancelReason} editable={!cancelAttempt && !orderActionBusy} style={[styles.input, { minHeight: 74, textAlignVertical: 'top', paddingTop: 10, marginTop: 10 }]} placeholder="Lý do hủy đơn (bắt buộc)" placeholderTextColor={colors.muted} multiline />
                    {orderRefundableAmount > 0 && <View style={styles.paymentMethods}>{(['cash', 'card', 'transfer', 'ewallet'] as const).map((method) => <Pressable key={method} disabled={Boolean(cancelAttempt)} onPress={() => setCancelMethod(method)} style={[styles.paymentMethod, cancelMethod === method && styles.paymentMethodSelected, cancelAttempt && styles.buttonDisabled]}><Text style={[styles.paymentMethodText, cancelMethod === method && styles.paymentMethodTextSelected]}>{paymentMethodLabel(method)}</Text></Pressable>)}</View>}
                    {cancelAttempt?.orderId === selectedOrder._id ? <><Text style={[styles.cardCopy, { textAlign: 'left' }]}>Yêu cầu {String(cancelAttempt.payload.idempotencyKey || '').slice(0, 18)}… · {cancelAttempt.status === 'not_found' ? 'ERP chưa ghi nhận' : cancelAttempt.status === 'processing' ? 'Đang xử lý' : 'Cần đối chiếu'}</Text><SecondaryButton disabled={orderActionBusy} label={orderActionBusy ? 'Đang đối chiếu…' : 'Đối chiếu trạng thái hủy'} onPress={() => void reconcileCancelOrder()} />{cancelAttempt.status === 'not_found' && <><SecondaryButton disabled={orderActionBusy} label="Gửi lại đúng yêu cầu hủy" onPress={() => void sendCancelAttempt()} /><SecondaryButton disabled={orderActionBusy} label="Thu hồi yêu cầu chưa ghi nhận" onPress={() => void revokeCancelOrder()} /></>}</> : <Pressable accessibilityRole="button" disabled={orderActionBusy || Boolean(cancelAttempt) || (orderRefundableAmount > 0 && cancelMethod === 'cash' && !shift)} onPress={startCancelOrder} style={[styles.dangerButton, (orderActionBusy || Boolean(cancelAttempt) || (orderRefundableAmount > 0 && cancelMethod === 'cash' && !shift)) && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>{orderActionBusy ? 'Đang hủy…' : orderRefundableAmount > 0 ? `Hủy đơn và hoàn ${money(orderRefundableAmount)}` : 'Hủy đơn'}</Text></Pressable>}
                  </View>}
            </View>
          );
        })()}
      </FullScreenFormModal>
    </View>
  );
}

function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function PrimaryButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

function SecondaryButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.secondaryButton, disabled && styles.buttonDisabled]}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>;
}

function OrderCard({ order, onPress }: { order: RetailOrder; onPress: () => void }) {
  const statusMeta = orderStatusMeta(order.status);
  const payMeta = paymentStatusMeta(order.paymentStatus, order.dueAmount);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} ellipsizeMode="middle" style={styles.orderCode}>{order.orderCode || order._id}</Text>
          <Text style={styles.orderDate}>{dateTime(order.createdAt)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusMeta.fg }]}>{statusMeta.label}</Text>
        </View>
      </View>
      <Text style={styles.orderCustomer}>{order.customerName || 'Khách lẻ'}{order.customerPhone ? ` · ${order.customerPhone}` : ''}</Text>
      <Text numberOfLines={2} style={styles.orderItems}>{order.items?.map((item) => `${item.productName} × ${item.quantity}`).join(' · ') || 'Không có dòng sản phẩm'}</Text>
      <View style={styles.orderFooter}>
        <View style={[styles.statusBadge, { backgroundColor: payMeta.bg }]}>
          <Text style={[styles.statusBadgeText, { color: payMeta.fg }]}>{payMeta.label}</Text>
        </View>
        <Text style={styles.orderTotal}>{money(order.grandTotal)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  branchSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  storeIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', borderRadius: 12 },
  branchLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  branchName: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 1 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#A6F4C5' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#12B76A' },
  liveText: { color: '#027A48', fontSize: 11, fontWeight: '800' },
  branchButton: { maxWidth: 160, minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  branchButtonText: { flexShrink: 1, color: colors.primary, fontSize: 12, fontWeight: '700' },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  tab: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 13, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E2E8F0' },
  tabSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: '#475569', fontSize: 12.5, fontWeight: '700' },
  tabTextSelected: { color: '#FFFFFF' },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 36, gap: 12 },
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  stateTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 12 },
  stateCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6, maxWidth: 300 },
  card: {
    alignItems: 'center',
    padding: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  shiftCard: { marginTop: 4 },
  cardIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', borderRadius: 14, marginBottom: 10 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  cardCopy: { color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  loadingText: { color: colors.muted, fontSize: 12.5, marginTop: 8 },
  fieldLabel: { alignSelf: 'flex-start', color: '#334155', fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: { width: '100%', minHeight: 44, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 12, color: colors.ink, fontSize: 14, backgroundColor: '#FFFFFF' },
  inputDisabled: { backgroundColor: '#F1F5F9', color: colors.muted },
  primaryButton: { minHeight: 46, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 12, borderRadius: 12, backgroundColor: colors.primary },
  dangerButton: { minHeight: 46, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 12, borderRadius: 12, backgroundColor: '#DC2626' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  secondaryButton: { minHeight: 44, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 10, borderRadius: 12, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  secondaryButtonText: { color: colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  buttonDisabled: { opacity: 0.45 },
  errorText: { alignSelf: 'stretch', color: '#B42318', fontSize: 12, lineHeight: 17, marginTop: 8, fontWeight: '600' },
  pendingCard: { alignItems: 'stretch', borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  pendingHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  shiftStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#A6F4C5', borderRadius: 14 },
  shiftCode: { color: '#027A48', fontSize: 13.5, fontWeight: '800' },
  shiftMeta: { color: '#065F46', fontSize: 12, marginTop: 3 },
  closeShiftButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FECACA' },
  closeShiftText: { color: '#B42318', fontSize: 12, fontWeight: '800' },
  searchBox: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DCE5F2', borderRadius: 99, backgroundColor: colors.white },
  searchInput: { flex: 1, minWidth: 0, color: '#111827', fontSize: 13.5, paddingVertical: 0 },
  clearIconBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  productCard: {
    width: '48.5%',
    minHeight: 134,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: colors.white,
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  disabledCard: { opacity: 0.45 },
  productTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  productSku: { flex: 1, color: '#64748B', fontSize: 11, fontWeight: '700' },
  addBadge: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  productName: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 8 },
  productPrice: { color: colors.primary, fontSize: 14, fontWeight: '800', marginTop: 6 },
  stockPill: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#ECFDF3' },
  stockPillEmpty: { backgroundColor: '#FEF3F2' },
  productStock: { color: '#027A48', fontSize: 11, fontWeight: '700' },
  stockEmpty: { color: '#B42318' },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  countPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#EFF6FF' },
  sectionCount: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  emptyCart: { minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 16, backgroundColor: '#FFFFFF' },
  emptyCartText: { color: colors.muted, fontSize: 13 },
  cartList: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, backgroundColor: colors.white },
  cartLine: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  cartLineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartProductName: { color: colors.ink, fontSize: 13.5, lineHeight: 18, fontWeight: '700' },
  cartProductMeta: { color: '#64748B', fontSize: 12, marginTop: 3 },
  orderDetailSheet: { maxHeight: '90%', padding: 18, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.white },
  orderDetailLine: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailHero: { padding: 14, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  detailSection: { padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  detailSectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  paymentMethods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  paymentMethod: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1' },
  paymentMethodSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  paymentMethodText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  paymentMethodTextSelected: { color: '#FFFFFF' },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quantityButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, backgroundColor: '#F8FAFC' },
  quantityValue: { color: colors.ink, fontSize: 14, fontWeight: '800', minWidth: 18, textAlign: 'center' },
  removeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FEF2F2' },
  clearCartButton: { alignSelf: 'flex-end', paddingVertical: 10, paddingHorizontal: 4 },
  clearCartText: { color: '#DC2626', fontSize: 12.5, fontWeight: '700' },
  checkoutCard: { padding: 15, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, backgroundColor: colors.white },
  customerSelected: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, marginTop: 8, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, backgroundColor: '#EFF6FF' },
  customerOption: { padding: 11, marginTop: 6, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: '#F8FAFC' },
  posExtraFields: { flexDirection: 'row', gap: 10 },
  cashOnly: { color: colors.primary, fontSize: 11, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: '#EFF6FF' },
  quoteLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  quoteLoadingText: { color: colors.muted, fontSize: 12.5 },
  totalsBox: { marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  totalLabel: { color: '#475569', fontSize: 13 },
  totalValue: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  grandTotalRow: { paddingVertical: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: '#CBD5E1' },
  grandTotalLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  grandTotalValue: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  changeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, paddingHorizontal: 2 },
  changeValue: { color: '#027A48', fontSize: 14, fontWeight: '800' },
  ordersSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 10 },
  refreshButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, backgroundColor: colors.white },
  orderList: { paddingHorizontal: 14, paddingBottom: 28, gap: 10 },
  orderCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: colors.white,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  orderHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  orderCode: { color: colors.ink, fontSize: 14.5, fontWeight: '800' },
  orderDate: { color: '#64748B', fontSize: 11.5, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  orderCustomer: { color: colors.ink, fontSize: 13, fontWeight: '700', marginTop: 10 },
  orderItems: { color: '#64748B', fontSize: 12, lineHeight: 17, marginTop: 4 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  orderTotal: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.48)' },
  branchSheet: { padding: 18, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.white },
  confirmSheet: { padding: 20, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.white },
  modalHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  branchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 12 },
  branchRowSelected: { backgroundColor: '#EFF6FF' },
  branchRowText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  branchRowTextSelected: { color: colors.primary, fontWeight: '800' },
  modalActionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
});

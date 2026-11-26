import { apiRequest } from '@/core/network/apiClient';

export type RetailScope = { companyCode: string; branchId: string; terminalId: string };
export type RetailTrackingMode = 'none' | 'quantity' | 'unit_barcode' | 'lot' | 'serial';
export type RetailProduct = {
  _id: string;
  productId: string;
  variantId: string;
  sku: string;
  barcode?: string;
  name: string;
  category?: string;
  unit: string;
  stock: number;
  price: number;
  trackingMode?: RetailTrackingMode;
  matchedSerialNumber?: string;
  matchedInternalBarcode?: string;
};
export type RetailOrder = {
  _id: string;
  orderCode?: string;
  customerName?: string;
  customerPhone?: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  createdAt?: string;
  businessDate?: string;
  items: Array<{ productName: string; sku: string; quantity: number; lineTotal: number; unitPrice?: number; discountAmount?: number; serialNumbers?: string[]; internalBarcodes?: string[] }>;
  subtotal?: number;
  orderDiscount?: number;
  taxAmount?: number;
  shippingFee?: number;
  version?: number;
  payments?: Array<{ method: string; amount: number; reference?: string; paidAt?: string }>;
};
export type RetailShift = {
  _id: string;
  shiftCode: string;
  terminalId?: string;
  cashierId?: string;
  cashierName?: string;
  status: 'open' | 'closed' | 'reconciled';
  openingFloat: number;
  businessDate: string;
  operationalEndsAt?: string;
  grossSales?: number;
  collectedAmount?: number;
  refundedAmount?: number;
  expectedCash?: number;
  countedCash?: number | null;
  varianceAmount?: number | null;
  cashMovements?: Array<{ type: 'in' | 'out'; amount: number; reason: string; at: string; byName: string }>;
};
export type RetailShiftCashier = { id: string; name: string };
export type RetailShiftOpenInput = { cashierId: string; openingFloat: number };
export type RetailQuote = { subtotal: number; orderDiscount: number; taxRate: number; taxAmount: number; shippingFee: number; grandTotal: number };
export type RetailCheckoutResult = {
  order: RetailOrder;
  invoice?: { invoiceNo?: string };
};
export type RetailAfterSale = {
  _id: string; code: string; type: 'return' | 'buyback'; orderId: string; orderCode: string;
  customerName?: string; items: Array<{ sku: string; productName: string; quantity: number; condition?: string; lineAmount: number; serialNumbers?: string[]; internalBarcodes?: string[] }>;
  totalAmount: number; paymentMethod: string; reason: string; businessDate: string; createdAt: string;
};
export type RetailInvoice = {
  _id: string; invoiceNo: string; orderId: string; orderCode: string; issuedAt: string; status: 'issued' | 'void';
  snapshot: { customerName: string; customerPhone?: string; cashierName: string; items: Array<{ productName: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }>; subtotal: number; orderDiscount: number; taxAmount: number; shippingFee: number; grandTotal: number; paidAmount?: number; dueAmount?: number; payments: Array<{ method: string; amount: number; reference?: string }> };
};
export type RetailReport = {
  range: { from: string; to: string };
  summary: { grossSales: number; refunds: number; netSales: number; orderCount: number; averageOrderValue: number; collectedAmount: number; dueAmount: number; totalCost?: number; grossProfit?: number; grossMarginPercent?: number };
  timeSeries: Array<{ businessDate: string; netSales: number; orderCount: number }>;
  paymentMix: Array<{ method: string; amount: number }>;
  cashiers?: Array<{ cashierId: string; cashierName: string; orderCount: number; netSales: number; averageOrderValue: number }>;
  shifts?: Array<{ shiftId: string; shiftCode: string; businessDate: string; cashierName: string; status: string; grossSales: number; collectedAmount: number; refundedAmount: number; varianceAmount?: number }>;
  debt: { totalDebt: number; overdueDebt: number; dueTodayDebt: number; upcomingDebt: number };
  products: Array<{ sku: string; productName: string; netQuantity: number; netSales: number; profit?: number }>;
  slowProducts?: Array<{ sku: string; productName: string; netQuantity: number; netSales: number; profit?: number }>;
};
export type RetailWarrantyRow = { id: string; orderId?: string; productId?: string; orderCode: string; invoiceNo?: string; customerName?: string; customerPhone?: string; sku?: string; productName: string; quantity: number; soldAt?: string; warrantyStartAt?: string; warrantyEndAt?: string; warrantyMonths?: number; status: string; daysLeft?: number | null };
export type RetailSettings = { companyCode: string; branchId: string; customerTiers: Array<{ code: string; name: string; minSpend: number }>; allowNegativeStock: boolean; maxDiscountPercent: number; defaultTaxRate: number; varianceReasonThreshold: number; orderPrefix: string; invoicePrefix: string; invoicePaperSize: 'A4' | 'A5' | '80mm' | '58mm'; invoiceTemplate: 'standard' };
export type RetailCoupon = { _id: string; code: string; name: string; discountType: 'amount' | 'percent'; value: number; minSubtotal: number; maxDiscount: number | null; usageLimit: number | null; usedCount: number; startsAt: string; endsAt: string; active: boolean; version: number };
export type RetailCustomerOption = { customerId: string; customerCode: string; name: string; phone: string; tier?: { code: string; name: string } };
export type RetailCouponAutomation = { _id: string; name: string; trigger: 'birthday' | 'order_total'; orderMinTotal: number | null; enabled: boolean; discountType: 'amount' | 'percent'; value: number; minSubtotal: number; maxDiscount: number | null; validityDays: number; version?: number };
export type RetailPointPolicy = { enabled: boolean; earnVndPerPoint: number; redeemVndPerPoint: number; maxRedeemPercent: number; version: number };
export type RetailPointCustomer = { _id: string; customerCode: string; name: string; phone: string; pointsBalance?: number };
export type RetailPointLedger = { _id: string; type: string; points: number; balanceAfter: number; reason: string; createdAt: string };
export type CheckoutAttempt = { idempotencyKey: string; payload: Record<string, unknown> };
type Envelope<T> = { success?: boolean; data: T };

function query(params: Record<string, string | number | undefined>) {
  const values = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') values.set(key, String(value));
  });
  const text = values.toString();
  return text ? `?${text}` : '';
}
const scopeQuery = (scope: RetailScope) => ({
  companyCode: scope.companyCode,
  branchId: scope.branchId,
  terminalId: scope.terminalId,
});
async function data<T>(path: string, options?: Parameters<typeof apiRequest>[1]): Promise<T> {
  return (await apiRequest<Envelope<T>>(path, options)).data;
}

export const retailApi = {
  products(scope: RetailScope, q = '', barcode?: string) {
    return data<{ items: RetailProduct[]; total: number; page: number; limit: number }>(
      `/retail/orders/products${query({ ...scopeQuery(scope), q: q.trim() || undefined, barcode: barcode?.trim() || undefined, page: 1, limit: 60 })}`,
    );
  },
  searchCustomers(scope: RetailScope, q: string) {
    return data<RetailCustomerOption[]>(`/customers/search${query({ companyCode: scope.companyCode, q: q.trim(), limit: 10 })}`);
  },
  selectableCoupons(scope: RetailScope, customerId?: string) {
    return data<Array<{ _id: string; code: string; name: string; discountType: 'amount' | 'percent'; value: number; minSubtotal: number; maxDiscount: number | null }>>(`/retail/coupons/selectable${query({ ...scopeQuery(scope), customerId })}`);
  },
  quote(scope: RetailScope, input: Record<string, unknown>) {
    return data<RetailQuote>(`/retail/orders/quote${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
  checkout(scope: RetailScope, input: Record<string, unknown>) {
    return data<RetailCheckoutResult>(`/retail/orders/checkout${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
  reconcileCheckout(scope: RetailScope, input: { idempotencyKey: string; payload: Record<string, unknown> }) {
    return data<{ status: 'completed' | 'not_found' | 'processing' | 'revoked'; message: string; order?: RetailOrder; invoice?: { invoiceNo?: string } }>(
      `/retail/orders/checkout/reconcile${query(scopeQuery(scope))}`, { method: 'POST', body: input },
    );
  },
  revokeCheckout(scope: RetailScope, input: { idempotencyKey: string; payload: Record<string, unknown> }) {
    return data<{ status: 'completed' | 'revoked'; message: string; order?: RetailOrder; invoice?: { invoiceNo?: string } }>(
      `/retail/orders/checkout/revoke${query(scopeQuery(scope))}`, { method: 'POST', body: input },
    );
  },
  orders(scope: RetailScope, q = '') {
    return data<{ items: RetailOrder[]; total: number; page: number; limit: number }>(
      `/retail/orders${query({ ...scopeQuery(scope), page: 1, limit: 50, q: q.trim() || undefined })}`,
    );
  },
  orderDetail(scope: RetailScope, id: string) {
    return data<RetailOrder>(`/retail/orders/${encodeURIComponent(id)}${query(scopeQuery(scope))}`);
  },
  warrantyOrders(scope: RetailScope, params: { q?: string; status?: string; days?: number; page?: number; limit?: number } = {}) {
    return data<{ items: RetailWarrantyRow[]; total: number; page: number; limit: number }>(`/retail/warranty/orders${query({ companyCode: scope.companyCode, branchId: scope.branchId, ...params })}`);
  },
  afterSales(scope: RetailScope, params: { q?: string; type?: string; page?: number; limit?: number } = {}) {
    return data<{ items: RetailAfterSale[]; total: number; page: number; limit: number }>(`/retail/after-sales${query({ companyCode: scope.companyCode, branchId: scope.branchId, ...params })}`);
  },
  createAfterSale(scope: RetailScope, input: Record<string, unknown>) {
    return data<RetailAfterSale>(`/retail/after-sales${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
  invoices(scope: RetailScope, params: { q?: string; status?: string; from?: string; to?: string; page?: number; limit?: number } = {}) {
    return data<{ items: RetailInvoice[]; total: number; page: number; limit: number }>(`/retail/invoices${query({ companyCode: scope.companyCode, branchId: scope.branchId, ...params })}`);
  },
  invoiceDetail(scope: RetailScope, id: string) {
    return data<RetailInvoice>(`/retail/invoices/${encodeURIComponent(id)}${query({ companyCode: scope.companyCode, branchId: scope.branchId })}`);
  },
  reprintInvoice(scope: RetailScope, id: string) {
    return data<RetailInvoice>(`/retail/invoices/${encodeURIComponent(id)}/reprint${query({ companyCode: scope.companyCode, branchId: scope.branchId })}`, { method: 'POST' });
  },
  report(scope: RetailScope, params: { preset?: '7d' | '30d'; from?: string; to?: string; salespersonId?: string; productId?: string; sku?: string; category?: string; brand?: string } = {}) {
    return data<RetailReport>(`/retail/reports/summary${query({ companyCode: scope.companyCode, branchId: scope.branchId, ...params })}`);
  },
  reportExportUrl(scope: RetailScope, params: { preset?: '7d' | '30d'; from?: string; to?: string; salespersonId?: string; productId?: string; sku?: string; category?: string; brand?: string } = {}) {
    return `/retail/reports/export${query({ companyCode: scope.companyCode, branchId: scope.branchId, ...params })}`;
  },
  settings(scope: RetailScope) {
    return data<RetailSettings>(`/retail/settings${query({ companyCode: scope.companyCode, branchId: scope.branchId })}`);
  },
  saveSettings(scope: RetailScope, input: Omit<RetailSettings, 'companyCode' | 'branchId'>) {
    return data<RetailSettings>(`/retail/settings${query({ companyCode: scope.companyCode, branchId: scope.branchId })}`, { method: 'PUT', body: input });
  },
  coupons(scope: RetailScope, page = 1) {
    return data<{ items: RetailCoupon[]; total: number }>(`/retail/coupons${query({ ...scopeQuery(scope), page })}`);
  },
  saveCoupon(scope: RetailScope, input: Record<string, unknown>, id?: string) {
    return data<RetailCoupon>(`/retail/coupons${id ? `/${encodeURIComponent(id)}` : ''}${query(scopeQuery(scope))}`, { method: id ? 'PUT' : 'POST', body: input });
  },
  couponAutomations(scope: RetailScope) {
    return data<RetailCouponAutomation[]>(`/retail/coupons/automations${query(scopeQuery(scope))}`);
  },
  saveCouponAutomation(scope: RetailScope, input: Omit<RetailCouponAutomation, '_id'>, id?: string) {
    return data<RetailCouponAutomation>(`/retail/coupons/automations${id ? `/${encodeURIComponent(id)}` : ''}${query(scopeQuery(scope))}`, { method: id ? 'PUT' : 'POST', body: input });
  },
  pointPolicy(scope: RetailScope) {
    return data<RetailPointPolicy>(`/retail/points/policy${query(scopeQuery(scope))}`);
  },
  savePointPolicy(scope: RetailScope, input: RetailPointPolicy) {
    return data<RetailPointPolicy>(`/retail/points/policy${query(scopeQuery(scope))}`, { method: 'PUT', body: input });
  },
  pointCustomers(scope: RetailScope, q: string) {
    return data<RetailPointCustomer[]>(`/retail/points/customers/search${query({ ...scopeQuery(scope), q })}`);
  },
  pointCustomer(scope: RetailScope, id: string) {
    return data<{ balance: number; ledger: RetailPointLedger[] }>(`/retail/points/customers/${encodeURIComponent(id)}${query(scopeQuery(scope))}`);
  },
  adjustPoints(scope: RetailScope, id: string, input: { points: number; reason: string; idempotencyKey: string }) {
    return data<Record<string, unknown>>(`/retail/points/customers/${encodeURIComponent(id)}/adjust${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
  shifts(scope: RetailScope, params: { page?: number; limit?: number; status?: string; from?: string; to?: string } = {}) {
    return data<{ items: RetailShift[]; total: number; page: number; limit: number }>(`/retail/shifts${query({ ...scopeQuery(scope), ...params })}`);
  },
  shiftDetail(scope: RetailScope, id: string) {
    return data<{ shift: RetailShift; orders?: RetailOrder[]; total?: number; page?: number }>(`/retail/shifts/${encodeURIComponent(id)}${query(scopeQuery(scope))}`);
  },
  moveShiftCash(scope: RetailScope, id: string, input: { type: 'in' | 'out'; amount: number; reason: string; idempotencyKey: string }) {
    return data<RetailShift>(`/retail/shifts/${encodeURIComponent(id)}/cash-movements${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
  reconcileShift(scope: RetailScope, id: string, input: { countedCash: number; varianceReason?: string }) {
    return data<RetailShift>(`/retail/shifts/${encodeURIComponent(id)}/reconcile${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
  async cashbook(scope: RetailScope, from: string, to: string) {
    return data<{ entries: Array<{ sourceKey: string; businessDate: string; account: string; direction: string; amount: number; description: string }>; summary: { cashNet: number; bankNet: number; count: number }; shiftsReconciliation: Array<{ shiftId: string; shiftCode: string; businessDate: string; status: string; expectedCash: number; countedCash: number | null; varianceAmount: number | null }>; period?: unknown; balanced?: boolean | null }>(`/retail/finance/cashbook/reconcile${query({ ...scopeQuery(scope), from, to })}`);
  },
  createCashVoucher(scope: RetailScope, input: { account: 'cash' | 'bank'; direction: 'in' | 'out'; profitCategory: 'other' | 'expense'; amount: number; reason: string; reference?: string; businessDate: string; idempotencyKey: string }) {
    return data<Record<string, unknown>>(`/retail/finance/cashbook/vouchers${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
  closeCashPeriod(scope: RetailScope, from: string, to: string) {
    return data<Record<string, unknown>>(`/retail/finance/cashbook/close${query(scopeQuery(scope))}`, { method: 'POST', body: { from, to } });
  },
  async profit(scope: RetailScope, from: string, to: string) {
    return data<{ summary: { revenue: number; knownCost: number; grossProfit: number | null; operatingExpense: number; commissionExpense: number; netProfit: number | null; missingCostCount: number; belowCostCount: number }; bySku: Array<{ sku: string; productName: string; revenue: number; cost: number; grossProfit: number | null; missingCostCount: number }> }>(`/retail/finance/profit${query({ ...scopeQuery(scope), from, to })}`);
  },
  currentShift(scope: RetailScope) {
    return data<RetailShift | null>(`/retail/shifts/current${query(scopeQuery(scope))}`);
  },
  cashiers(scope: RetailScope) {
    return data<RetailShiftCashier[]>(`/retail/shifts/cashiers${query(scopeQuery(scope))}`);
  },
  openShift(scope: RetailScope, input: RetailShiftOpenInput) {
    return data<RetailShift>(`/retail/shifts/open${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
  resumeShift(scope: RetailScope, id: string, expectedTerminalId?: string) {
    return data<RetailShift>(`/retail/shifts/${encodeURIComponent(id)}/resume${query(scopeQuery(scope))}`, {
      method: 'POST', body: { terminalId: scope.terminalId, expectedTerminalId },
    });
  },
  closeShift(scope: RetailScope, id: string, input: { countedCash?: number; varianceReason?: string } = {}) {
    return data<RetailShift>(`/retail/shifts/${encodeURIComponent(id)}/close${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
  pauseShift(scope: RetailScope, id: string, reason?: string) {
    return data<RetailShift>(`/retail/shifts/${encodeURIComponent(id)}/pause${query(scopeQuery(scope))}`, { method: 'POST', body: { reason } });
  },
  collectPayment(scope: RetailScope, id: string, input: { payments: Array<{ method: string; amount: number; reference?: string }>; idempotencyKey: string; expectedVersion: number; cashSessionId?: string }) {
    return data<RetailOrder>(`/retail/orders/${encodeURIComponent(id)}/payments${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
  cancelOrder(scope: RetailScope, id: string, input: Record<string, unknown>) {
    return data<RetailOrder>(`/retail/orders/${encodeURIComponent(id)}/cancel${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
  reconcileCancellation(scope: RetailScope, id: string, input: Record<string, unknown>) {
    return data<{ status: 'completed' | 'not_found' | 'processing' | 'conflict' | 'revoked'; message: string; order?: RetailOrder }>(`/retail/orders/${encodeURIComponent(id)}/cancel/reconcile${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
  revokeCancellation(scope: RetailScope, id: string, input: Record<string, unknown>) {
    return data<{ status: 'revoked'; message: string }>(`/retail/orders/${encodeURIComponent(id)}/cancel/revoke${query(scopeQuery(scope))}`, { method: 'POST', body: input });
  },
};

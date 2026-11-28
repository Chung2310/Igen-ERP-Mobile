import { apiRequest } from '@/core/network/apiClient';

export type ProductType = 'physical' | 'service' | 'bundle';
export type ProductStatus = 'draft' | 'active' | 'inactive' | 'archived';
export type TrackingMode = 'none' | 'quantity' | 'unit_barcode' | 'lot' | 'serial';
export type ResourceKind = 'categories' | 'brands' | 'units' | 'attributes';
export type ProductVariant = {
  _id: string; sku: string; barcode?: string; displayName?: string; unitCode: string;
  trackingMode: TrackingMode; status: 'active' | 'inactive' | 'discontinued';
  optionValues?: Array<{ code: string; value: string }>;
};
export type CatalogProduct = {
  _id: string; productCode: string; name: string; productType: ProductType;
  categoryCode: string; brandCode?: string; baseUnitCode: string; status: ProductStatus;
  shortDescription?: string; description?: string; variants?: ProductVariant[];
};
export type ProductResource = { _id: string; code: string; name: string; status: 'active' | 'inactive'; symbol?: string; defaultTrackingMode?: TrackingMode };
export type Warehouse = { _id: string; branchId: string; branchName?: string; code: string; name: string; kind: string; isDefault: boolean; isActive: boolean };
export type InventoryBalance = {
  _id: string; hasBalanceRecord?: boolean; hasMovementHistory?: boolean; warehouseId: string;
  productId: string; variantId?: string; sku: string; productName?: string; variantName?: string;
  trackingMode?: TrackingMode; quantity: number; reservedQuantity: number; minStock?: number;
  maxStock?: number; averageCost: number;
};
export type Supplier = { _id: string; code: string; name: string; phone?: string; email?: string; taxCode?: string; status: 'active' | 'inactive' };
export type ReceiptItem = { productId: string; variantId: string; sku: string; productName: string; displayName?: string; quantity: number; unitCost: number; trackingMode?: TrackingMode; serialNumbers?: string[]; unitDetails?: Array<{ internalBarcode?: string; serialNumber?: string; imei1?: string; imei2?: string }> };
export type GoodsReceipt = { _id: string; receiptCode: string; supplierId: string; supplierName: string; warehouseId: string; status: 'draft' | 'pending' | 'receiving' | 'confirmed' | 'cancelled'; items: ReceiptItem[]; subtotal: number; notes?: string; createdAt: string };
export type TransferDestination = { _id: string; branchId: string; branchName: string; name: string; code: string; isDefault: boolean };
export type InventoryTransfer = { _id: string; transferCode: string; fromWarehouseId: string; fromWarehouseName: string; toBranchId: string; toWarehouseId: string; toWarehouseName: string; status: 'in_transit' | 'received' | 'cancelled'; items: Array<{ productId: string; variantId: string; sku: string; productName: string; quantity: number }>; reason: string; createdAt: string };
export type StockLogItem = { productId: string; variantId?: string; sku: string; productName: string; quantity: number; unitCost?: number; unitPrice?: number; unitIdentifiers?: string[]; serialNumbers?: string[] };
export type StockLog = { _id: string; id?: string; type: 'nhập' | 'xuất'; purpose?: string; title: string; operatorName?: string; notes?: string; status: string; warehouseId?: string; items?: StockLogItem[]; quantity?: number; productName?: string; createdAt: string };
export type SerialUnit = { _id: string; productId: string; variantId?: string; sku: string; productName: string; internalBarcode: string; serialNumber: string; status: string; warehouseId?: string };
export type CountItem = { _id: string; productId: string; variantId?: string; sku: string; productName: string; systemQuantity: number; countedQuantity: number; quantityDelta: number };
export type InventoryCount = { _id: string; version: number; countCode: string; warehouseId: string; status: 'draft' | 'counting' | 'pending_approval' | 'completed' | 'cancelled' | 'conflict'; items: CountItem[] };

type Envelope<T> = { data: T };
function query(params: Record<string, string | number | boolean | undefined>) {
  const values = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') values.set(key, String(value)); });
  const text = values.toString();
  return text ? `?${text}` : '';
}
function envelope<T>(path: string, options?: Parameters<typeof apiRequest>[1]) {
  return apiRequest<Envelope<T>>(path, options).then((response) => response.data);
}
const branchHeaders = (branchId?: string) => branchId ? { 'x-branch-id': branchId } : undefined;
const branchParams = (branchId?: string) => ({ branchId });
function requestUuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => { const random = Math.random() * 16 | 0; return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16); }); }

export const inventoryApi = {
  listProducts: (params: { q?: string; status?: string; productType?: string; branchId?: string; categoryCode?: string; brandCode?: string; page?: number; limit?: number }) =>
    envelope<{ items: CatalogProduct[]; total: number; page: number; limit: number }>(`/inventory/catalog/products${query(params)}`),
  getProduct: (id: string) => envelope<CatalogProduct>(`/inventory/catalog/products/${encodeURIComponent(id)}`),
  createProduct: (input: Record<string, unknown>, branchId?: string) => envelope<CatalogProduct>(`/inventory/catalog/products/with-price${query(branchParams(branchId))}`, { method: 'POST', body: input }),
  updateProduct: (id: string, input: Record<string, unknown>) => envelope<CatalogProduct>(`/inventory/catalog/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
  deleteProduct: (id: string) => envelope<void>(`/inventory/catalog/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  createVariant: (id: string, input: Record<string, unknown>) => envelope<ProductVariant>(`/inventory/catalog/products/${encodeURIComponent(id)}/variants`, { method: 'POST', body: input }),
  updateVariant: (id: string, input: Record<string, unknown>) => envelope<ProductVariant>(`/inventory/catalog/variants/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
  deleteVariants: (ids: string[]) => envelope<{ deletedIds: string[] }>('/inventory/catalog/variants/bulk', { method: 'DELETE', body: { ids } }),
  listPrices: (branchId?: string, productId?: string) => envelope<{ items: Array<{ variantId: string; sellingPrice: number; costPrice?: number; status?: string }> }>(`/inventory/catalog/prices${query({ branchId, productId })}`).then((result) => result.items ?? []),
  upsertPrice: (variantId: string, branchId: string | undefined, sellingPrice: number, costPrice: number) => envelope(`/inventory/catalog/prices/${encodeURIComponent(variantId)}${query({ branchId })}`, { method: 'PUT', body: { sellingPrice, costPrice } }),
  listResources: (kind: ResourceKind) => envelope<ProductResource[]>(`/inventory/catalog/resources/${kind}?status=active`),
  createResource: (kind: ResourceKind, input: { code: string; name: string; symbol?: string; defaultTrackingMode?: TrackingMode }) => envelope<ProductResource>(`/inventory/catalog/resources/${kind}`, { method: 'POST', body: input }),
  updateResource: (kind: ResourceKind, id: string, input: Record<string, unknown>) => envelope<ProductResource>(`/inventory/catalog/resources/${kind}/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
  deleteResource: (kind: ResourceKind, id: string) => envelope(`/inventory/catalog/resources/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listWarehouses: (branchId?: string) => envelope<Warehouse[]>(`/inventory/warehouses${query(branchParams(branchId))}`, { headers: branchHeaders(branchId) }),
  listBalances: (branchId?: string, warehouseId?: string, includeCatalogZeroBalances = true) => envelope<InventoryBalance[]>(`/inventory/warehouses/balances${query({ ...branchParams(branchId), warehouseId, includeCatalogZeroBalances })}`, { headers: branchHeaders(branchId) }),
  updateThresholds: (id: string, input: { minStock: number; maxStock?: number }, branchId?: string) => envelope<InventoryBalance>(`/inventory/warehouses/balances/${encodeURIComponent(id)}/thresholds${query(branchParams(branchId))}`, { method: 'PATCH', headers: branchHeaders(branchId), body: input }),

  listSuppliers: () => envelope<Supplier[]>('/inventory/receiving/suppliers'),
  createSupplier: (input: Partial<Supplier> & { name: string }) => envelope<Supplier>('/inventory/receiving/suppliers', { method: 'POST', body: input }),
  updateSupplier: (id: string, input: Partial<Supplier>) => envelope<Supplier>(`/inventory/receiving/suppliers/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
  listReceipts: (branchId?: string, params: { page?: number; limit?: number; status?: string; q?: string } = {}) => envelope<{ items: GoodsReceipt[]; total: number; page: number; limit: number }>(`/inventory/receiving/receipts${query({ ...branchParams(branchId), ...params })}`, { headers: branchHeaders(branchId) }),
  createReceipt: (branchId: string | undefined, input: { supplierId: string; warehouseId: string; notes?: string; items: ReceiptItem[] }) => envelope<GoodsReceipt>(`/inventory/receiving/receipts${query(branchParams(branchId))}`, { method: 'POST', headers: branchHeaders(branchId), body: input }),
  updateReceipt: (id: string, branchId: string | undefined, input: { supplierId: string; notes?: string; items: ReceiptItem[] }) => envelope<GoodsReceipt>(`/inventory/receiving/receipts/${encodeURIComponent(id)}${query(branchParams(branchId))}`, { method: 'PATCH', headers: branchHeaders(branchId), body: input }),
  receiptAction: (id: string, action: 'submit' | 'start-receiving' | 'confirm' | 'cancel', branchId?: string, reason?: string) => envelope<GoodsReceipt>(`/inventory/receiving/receipts/${encodeURIComponent(id)}/${action}${query(branchParams(branchId))}`, { method: 'POST', headers: branchHeaders(branchId), body: action === 'cancel' ? { reason: reason || 'Hủy theo yêu cầu người dùng' } : undefined }),

  listDestinations: (branchId: string) => envelope<TransferDestination[]>(`/inventory/transfers/destinations${query(branchParams(branchId))}`, { headers: branchHeaders(branchId) }),
  listTransfers: (branchId: string, page = 1, status?: string, limit = 50) => envelope<{ items: InventoryTransfer[]; total: number; page: number; limit: number }>(`/inventory/transfers${query({ ...branchParams(branchId), status, page, limit })}`, { headers: branchHeaders(branchId) }),
  createTransfer: (branchId: string, input: Record<string, unknown>) => envelope<InventoryTransfer>(`/inventory/transfers${query(branchParams(branchId))}`, { method: 'POST', headers: branchHeaders(branchId), body: input }),
  transferAction: (branchId: string, id: string, action: 'accept' | 'cancel', reason?: string) => envelope<InventoryTransfer>(`/inventory/transfers/${encodeURIComponent(id)}/${action}${query(branchParams(branchId))}`, { method: 'POST', headers: branchHeaders(branchId), body: action === 'cancel' ? { reason: reason || 'Hủy theo yêu cầu người dùng' } : undefined }),

  listStockLogs: (branchId: string) => envelope<StockLog[]>('/crud/stock-logs?sort=-createdAt', { headers: branchHeaders(branchId) }),
  createStockLog: (branchId: string, input: Record<string, unknown>) => envelope<StockLog>('/crud/stock-logs', { method: 'POST', headers: branchHeaders(branchId), body: input }),
  updateStockLog: (branchId: string, id: string, input: Record<string, unknown>) => envelope<StockLog>(`/crud/stock-logs/${encodeURIComponent(id)}`, { method: 'PATCH', headers: branchHeaders(branchId), body: input }),
  deleteStockLog: (branchId: string, id: string) => envelope<void>(`/crud/stock-logs/${encodeURIComponent(id)}`, { method: 'DELETE', headers: branchHeaders(branchId) }),
  reverseStockLog: (branchId: string, id: string, reason: string) => envelope(`/inventory/stock-logs/${encodeURIComponent(id)}/reverse`, { method: 'POST', headers: branchHeaders(branchId), body: { reason } }),

  listSerials: (params: { companyCode?: string; branchId?: string; warehouseId?: string; serial?: string; status?: string; page?: number; limit?: number }) => envelope<{ items: SerialUnit[]; total: number; page: number; limit: number }>(`/inventory/serials${query(params)}`),
  importSerials: (input: { productId: string; variantId?: string; sku: string; productName: string; serialNumbers: string[]; warehouseId?: string }, branchId?: string) => envelope<SerialUnit[]>(`/inventory/serials${query(branchParams(branchId))}`, { method: 'POST', body: input }),
  transitionSerial: (id: string, toStatus: string, reason: string, branchId?: string) => envelope<SerialUnit>(`/inventory/serials/${encodeURIComponent(id)}/transition${query(branchParams(branchId))}`, { method: 'POST', body: { toStatus, eventType: 'manual_transition', reason } }),

  listCounts: (warehouseId?: string, branchId?: string) => envelope<InventoryCount[]>(`/inventory/counts${query({ warehouseId, branchId })}`, { headers: branchHeaders(branchId) }),
  createCount: (warehouseId: string, branchId?: string, notes?: string) => envelope<InventoryCount>(`/inventory/counts${query(branchParams(branchId))}`, { method: 'POST', headers: branchHeaders(branchId), body: { warehouseId, notes } }),
  countAction: (id: string, action: 'start' | 'submit' | 'approve' | 'cancel', branchId?: string, body?: Record<string, unknown>) => envelope<InventoryCount>(`/inventory/counts/${encodeURIComponent(id)}/${action}${query(branchParams(branchId))}`, { method: 'POST', headers: branchHeaders(branchId), body }),
  updateCountItem: (id: string, itemId: string, countedQuantity: number, expectedVersion: number, branchId?: string) => envelope<InventoryCount>(`/inventory/counts/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}${query(branchParams(branchId))}`, { method: 'PATCH', headers: branchHeaders(branchId), body: { countedQuantity, expectedVersion, requestId: requestUuid() } }),
  scanCount: (id: string, code: string, branchId?: string) => envelope<{ count: InventoryCount }>(`/inventory/counts/${encodeURIComponent(id)}/scan${query(branchParams(branchId))}`, { method: 'POST', headers: branchHeaders(branchId), body: { code } }),
};

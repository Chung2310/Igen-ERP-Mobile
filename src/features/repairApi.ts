import { apiRequest } from '@/core/network/apiClient';

export type RepairStatus =
  | 'received'
  | 'diagnosing'
  | 'quoted'
  | 'approved'
  | 'repairing'
  | 'waiting_parts'
  | 'waiting_supplier'
  | 'done'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type RepairTicket = {
  _id: string;
  ticketCode: string;
  status: RepairStatus;
  ticketType?: 'service' | 'warranty';
  customerId: string;
  customerCode?: string;
  customerName: string;
  customerPhone: string;
  device: { name: string; serialNumber?: string; imei?: string; condition?: string };
  coverage: {
    customer: { covered: boolean; startAt?: string; endAt?: string; daysLeft?: number };
    supplier: { covered: boolean; startAt?: string; endAt?: string; daysLeft?: number };
    costBearer: string;
  };
  symptom: string;
  diagnosis?: string;
  technicianName?: string;
  totalAmount: number;
  dueAmount: number;
  receivedAt: string;
  promisedAt?: string;
  completedAt?: string;
  deliveredAt?: string;
  paymentStatus?: string;
};

export type WarrantyLookupResult = {
  found: boolean;
  serialNumber?: string;
  internalBarcode?: string;
  product?: { productId?: string; sku?: string; name?: string };
  sold?: { at?: string; orderCode?: string; customerId?: string; customerCode?: string; customerName?: string; customerPhone?: string };
  customerWarranty?: { covered: boolean; startAt?: string; endAt?: string; daysLeft?: number };
  supplierWarranty?: { covered: boolean; startAt?: string; endAt?: string; daysLeft?: number; supplierName?: string };
  costBearer?: 'supplier' | 'shop' | 'customer';
  status?: string;
};

export type PhoneWarrantyLookupResult = {
  found: boolean;
  customer?: { customerId?: string; customerCode?: string; name?: string; phone?: string };
  totalDevices: number;
  devices: WarrantyLookupResult[];
  candidates?: Array<{ customerId: string; customerCode: string; name: string }>;
  needsIdentification?: boolean;
};

export type RepairRevenueRow = {
  key: string;
  branchId?: string;
  ticketCount: number;
  warrantyTicketCount: number;
  laborRevenue: number;
  partRevenue: number;
  revenue: number;
  collected: number;
  outstanding: number;
  technicianName?: string;
};

export type RepairRevenueReport = {
  groupBy: string;
  items: RepairRevenueRow[];
  total: RepairRevenueRow;
  refunds?: { amount: number; laborAmount: number; count: number; netRevenue: number };
};

export type RepairScope = { companyCode?: string; branchId?: string };
export type RepairTechnician = { _id: string; displayName?: string; email?: string; isActive?: boolean };
type Envelope<T> = { success?: boolean; data: T };

function queryPath(path: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const value = query.toString();
  return value ? `${path}?${value}` : path;
}

function scopedOptions(scope: RepairScope) {
  return {
    headers: {
      ...(scope.companyCode ? { 'x-company-code': scope.companyCode } : {}),
      ...(scope.branchId ? { 'x-branch-id': scope.branchId } : {}),
    },
  };
}

export type CreateRepairTicketPayload = {
  idempotencyKey: string;
  ticketType: 'warranty' | 'service';
  subjectType?: 'product' | 'equipment' | 'service';
  intakeSource?: 'external' | 'company_sale';
  customerId: string;
  symptom: string;
  promisedAt?: string;
  device: {
    productId?: string;
    serialNumber?: string;
    imei?: string;
    name: string;
    condition: string;
    accessories?: string[];
  };
};

export const repairApi = {
  async listTechnicians() {
    const result = await apiRequest<Envelope<RepairTechnician[]>>('/auth/users/colleagues');
    return (result.data || []).filter((person) => person._id && person.isActive !== false);
  },

  async board(scope: RepairScope) {
    const path = queryPath('/repair/tickets/board', { companyCode: scope.companyCode });
    return (await apiRequest<Envelope<Partial<Record<RepairStatus, RepairTicket[]>>>>(path, scopedOptions(scope))).data;
  },

  async createTicket(scope: RepairScope, payload: CreateRepairTicketPayload) {
    const path = queryPath('/repair/tickets', { companyCode: scope.companyCode });
    return (
      await apiRequest<Envelope<RepairTicket>>(path, {
        ...scopedOptions(scope),
        method: 'POST',
        body: payload,
      })
    ).data;
  },

  async lookupBySerial(scope: RepairScope, serial: string) {
    const path = queryPath(`/retail/warranty/lookup/${encodeURIComponent(serial)}`, {
      companyCode: scope.companyCode,
      branchId: scope.branchId,
    });
    return (await apiRequest<Envelope<WarrantyLookupResult>>(path, scopedOptions(scope))).data;
  },

  async lookupByPhone(scope: RepairScope, phone: string, customerId?: string) {
    const path = queryPath(`/retail/warranty/lookup-phone/${encodeURIComponent(phone)}`, {
      companyCode: scope.companyCode,
      branchId: scope.branchId,
      customerId,
    });
    return (await apiRequest<Envelope<PhoneWarrantyLookupResult>>(path, scopedOptions(scope))).data;
  },

  async transitionStatus(
    scope: RepairScope,
    ticketId: string,
    payload: { to: RepairStatus; note?: string; notifyCustomer?: boolean; technicianId?: string },
  ) {
    const path = queryPath(`/repair/tickets/${encodeURIComponent(ticketId)}/status`, {
      companyCode: scope.companyCode,
    });
    return (
      await apiRequest<Envelope<RepairTicket>>(path, {
        ...scopedOptions(scope),
        method: 'POST',
        body: payload,
      })
    ).data;
  },

  async revenueReport(
    scope: RepairScope,
    params: { from: string; to: string; groupBy: 'branch' | 'technician' | 'day' },
  ) {
    const path = queryPath('/repair/reports/revenue', {
      companyCode: scope.companyCode,
      branchId: scope.branchId,
      ...params,
    });
    return (await apiRequest<Envelope<RepairRevenueReport>>(path, scopedOptions(scope))).data;
  },
};

import { apiRequest } from '@/core/network/apiClient';
import type {
  CatalogItem,
  AcceptanceRecord,
  CompanyPrefill,
  QuotationContract,
  QuotationTemplate,
  SavedBudgetPlan,
  Quote,
  QuoteAnalysis,
  CustomerQuoteSuggestion,
  QuoteKind,
  QuoteListResponse,
  QuoteStatus,
  QuoteTemplate,
  QuotationScope,
  TemplateCategory,
} from '@/features/quotation/types';

function scopedPath(path: string, scope: QuotationScope) {
  const [pathname, queryString = ''] = path.split('?');
  const query = new URLSearchParams(queryString);
  if (scope.companyCode) query.set('companyCode', scope.companyCode);
  const search = query.toString();
  return `${pathname}${search ? `?${search}` : ''}`;
}

function scopedOptions(
  scope: QuotationScope,
  options: { method?: string; body?: unknown; headers?: Record<string, string>; responseType?: 'json' | 'blob' } = {},
) {
  return {
    ...options,
    headers: {
      ...(options?.headers as Record<string, string> | undefined),
      ...(scope.branchId ? { 'x-branch-id': scope.branchId } : {}),
    },
  };
}

export async function listQuotes(
  scope: QuotationScope,
  params: { kind: QuoteKind; status?: QuoteStatus; search?: string; page: number },
) {
  const query = new URLSearchParams({ page: String(params.page), sort: 'newest' });
  if (params.kind === 'customer') query.set('kind', 'customer');
  if (params.status) query.set('status', params.status);
  if (params.search?.trim()) query.set('search', params.search.trim());
  return apiRequest<QuoteListResponse>(scopedPath(`/quotation/quotes?${query}`, scope), scopedOptions(scope));
}

export async function getQuote(scope: QuotationScope, id: string) {
  const result = await apiRequest<{ quote: Quote }>(
    scopedPath(`/quotation/quotes/${encodeURIComponent(id)}`, scope),
    scopedOptions(scope),
  );
  return result.quote;
}

export async function updateQuote(scope: QuotationScope, quote: Quote, changes: Record<string, unknown>) {
  const result = await apiRequest<{ quote: Quote }>(scopedPath(`/quotation/quotes/${encodeURIComponent(quote._id)}`, scope), scopedOptions(scope, {
    method: 'PATCH', body: changes, headers: { 'If-Unmodified-Since': quote.updatedAt },
  }));
  return result.quote;
}

function revisionOptions(scope: QuotationScope, updatedAt: string, body?: unknown) {
  return scopedOptions(scope, {
    method: 'POST',
    body,
    headers: { 'If-Unmodified-Since': updatedAt },
  });
}

export async function submitQuoteForReview(scope: QuotationScope, quote: Quote) {
  const result = await apiRequest<{ quote: Quote }>(
    scopedPath(`/quotation/quotes/${encodeURIComponent(quote._id)}/submit-review`, scope),
    revisionOptions(scope, quote.updatedAt, {}),
  );
  return result.quote;
}

export async function approveQuote(scope: QuotationScope, quote: Quote) {
  const result = await apiRequest<{ quote: Quote }>(
    scopedPath(`/quotation/quotes/${encodeURIComponent(quote._id)}/approve`, scope),
    revisionOptions(scope, quote.updatedAt, {}),
  );
  return result.quote;
}

export async function rejectQuote(scope: QuotationScope, quote: Quote, reason: string) {
  const result = await apiRequest<{ quote: Quote }>(
    scopedPath(`/quotation/quotes/${encodeURIComponent(quote._id)}/reject`, scope),
    revisionOptions(scope, quote.updatedAt, { reason }),
  );
  return result.quote;
}

export async function deleteQuote(scope: QuotationScope, quote: Quote) {
  await apiRequest<{ deleted: boolean }>(
    scopedPath(`/quotation/quotes/${encodeURIComponent(quote._id)}`, scope),
    scopedOptions(scope, { method: 'DELETE', headers: { 'If-Unmodified-Since': quote.updatedAt } }),
  );
}

export async function loadQuoteTemplates(scope: QuotationScope, category: 'quote' | 'estimate') {
  const templates: QuoteTemplate[] = [];
  let cursor: string | null = null;
  let defaultTemplateId: string | null = null;
  do {
    const query = new URLSearchParams({ category });
    if (cursor) query.set('cursor', cursor);
    const page = await apiRequest<{
      templates: Array<QuoteTemplate & { _id?: string }>;
      nextCursor: string | null;
      defaultTemplateId: string | null;
    }>(scopedPath(`/quotation/quote-templates?${query}`, scope), scopedOptions(scope));
    templates.push(...page.templates.map((template) => ({
      ...template,
      id: template.id || template._id || '',
    })).filter((template) => template.id));
    if (!cursor) defaultTemplateId = page.defaultTemplateId;
    cursor = page.nextCursor;
  } while (cursor);
  return { templates, defaultTemplateId };
}

export async function loadCatalog(scope: QuotationScope) {
  const result = await apiRequest<{ items: CatalogItem[] }>(
    scopedPath('/quotation/catalog?status=active&page=1&pageSize=1000', scope),
    scopedOptions(scope),
  );
  return result.items;
}

export async function createQuoteRequest(
  scope: QuotationScope,
  input: { templateId: string; requestText: string; requestFileId?: string; customerName: string; customerEmail: string; customerPhone: string; idempotencyKey: string },
) {
  return apiRequest<{ request: { _id: string } }>(
    scopedPath('/quotation/quote-requests', scope),
    scopedOptions(scope, { method: 'POST', body: input }),
  );
}

export type ErpQuotationCustomer = { _id: string; customerCode: string; name: string; phone: string; email?: string };

export async function searchErpQuotationCustomers(scope: QuotationScope, query: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  const queryString = params.toString();
  const result = await apiRequest<{ customers: ErpQuotationCustomer[] }>(
    scopedPath(`/quotation/erp/customers${queryString ? `?${queryString}` : ''}`, scope), scopedOptions(scope),
  );
  return result.customers;
}

export async function uploadQuoteRequestFile(scope: QuotationScope, input: { file: Blob; filename: string }) {
  return apiRequest<{ file: { id: string; originalFilename: string; bytes: number } }>(
    scopedPath('/quotation/request-files', scope), scopedOptions(scope, {
      method: 'POST', body: input.file,
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(input.filename) },
    }),
  );
}

export async function analyzeQuoteRequest(scope: QuotationScope, requestId: string) {
  return apiRequest<{ analysis: QuoteAnalysis; candidates: CatalogItem[] }>(
    scopedPath(`/quotation/quote-requests/${encodeURIComponent(requestId)}/analyze`, scope),
    scopedOptions(scope, { method: 'POST', body: {} }),
  );
}

export async function createEstimate(
  scope: QuotationScope,
  input: {
    requestId: string;
    items: Array<{ catalogItemId: string; quantity: number; unit: string; attributes: Record<string, string>; catalogUpdatedAt: string }>;
    idempotencyKey: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  },
) {
  const result = await apiRequest<{ quote: Quote }>(
    scopedPath('/quotation/quotes', scope),
    scopedOptions(scope, { method: 'POST', body: input }),
  );
  return result.quote;
}

export async function queueDraftEstimateExport(scope: QuotationScope, quoteId: string) {
  return queueEstimateExport(scope, quoteId, true);
}

export async function queueEstimateExport(scope: QuotationScope, quoteId: string, draft: boolean) {
  const query = new URLSearchParams({ background: '1' });
  if (draft) query.set('draft', '1');
  return apiRequest<{ jobId: string; status: string }>(
    scopedPath(`/quotation/quotes/${encodeURIComponent(quoteId)}/export?${query}`, scope),
    scopedOptions(scope),
  );
}

export async function createCustomerQuote(
  scope: QuotationScope,
  input: {
    templateId: string;
    idempotencyKey: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    sourceRequirements: string;
    missingProducts: string[];
    items: Array<{ catalogItemId: string; quantity: number; unit: string; catalogUpdatedAt: string }>;
  },
) {
  const result = await apiRequest<{ quote: Quote }>(
    scopedPath('/quotation/customer-quotes', scope),
    scopedOptions(scope, { method: 'POST', body: input }),
  );
  return result.quote;
}

export async function suggestCustomerQuote(scope: QuotationScope, prompt: string) {
  return apiRequest<CustomerQuoteSuggestion>(scopedPath('/quotation/customer-quotes/suggest', scope), scopedOptions(scope, {
    method: 'POST', body: { prompt: prompt.trim() },
  }));
}

export async function createEstimateFromCustomerQuote(scope: QuotationScope, input: {
  sourceQuoteId: string;
  templateId: string;
  sourceRequirements: string;
  idempotencyKey: string;
}) {
  const result = await apiRequest<{ quote: Quote }>(scopedPath('/quotation/quotes/from-customer', scope), scopedOptions(scope, {
    method: 'POST', body: input,
  }));
  return result.quote;
}

export type GeneratedFileRef = { id: string; filename: string; mimeType?: string; createdAt?: string };
export type GeneratedExportJob = { id: string; status: 'queued' | 'running' | 'completed' | 'failed'; error?: string; filename?: string; fileId?: string; createdAt?: string; updatedAt?: string };

export async function getLatestGeneratedFile(scope: QuotationScope, sourceId: string, kind: string) {
  const query = new URLSearchParams({ sourceId, kind });
  return apiRequest<{ file: GeneratedFileRef | null; job: GeneratedExportJob | null }>(
    scopedPath(`/quotation/generated-export-files/latest?${query}`, scope), scopedOptions(scope),
  );
}

export async function getGeneratedExportJob(scope: QuotationScope, jobId: string) {
  return apiRequest<{ job: GeneratedExportJob }>(scopedPath(`/quotation/export-jobs/${encodeURIComponent(jobId)}`, scope), scopedOptions(scope));
}

export async function retryCustomerQuoteExport(scope: QuotationScope, quoteId: string) {
  return apiRequest<{ jobId: string; status: GeneratedExportJob['status'] }>(
    scopedPath(`/quotation/quotes/${encodeURIComponent(quoteId)}/export/retry`, scope), scopedOptions(scope, { method: 'POST', body: {} }),
  );
}

export async function downloadGeneratedFile(scope: QuotationScope, fileId: string) {
  return apiRequest<Blob>(scopedPath(`/quotation/files/${encodeURIComponent(fileId)}/download`, scope), scopedOptions(scope, { responseType: 'blob' }));
}

export async function downloadQuotationTemplate(scope: QuotationScope, id: string) {
  return apiRequest<Blob>(scopedPath(`/quotation/quote-template/${encodeURIComponent(id)}/file`, scope), scopedOptions(scope, { responseType: 'blob' }));
}

export async function downloadPriceListFile(scope: QuotationScope, id: string) {
  return apiRequest<Blob>(scopedPath(`/quotation/price-list/${encodeURIComponent(id)}/file`, scope), scopedOptions(scope, { responseType: 'blob' }));
}

export async function listAllQuoteTemplates(scope: QuotationScope, category: TemplateCategory) {
  if (category === 'acceptance' || category === 'settlement') {
    const endpoint = category === 'acceptance' ? '/quotation/acceptance-templates' : '/quotation/settlement-templates';
    const result = await apiRequest<{ templates: QuotationTemplate[] }>(scopedPath(endpoint, scope), scopedOptions(scope));
    return result.templates;
  }
  const templates: QuotationTemplate[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ category });
    if (cursor) query.set('cursor', cursor);
    const result = await apiRequest<{ templates: QuotationTemplate[]; nextCursor: string | null }>(
      scopedPath(`/quotation/quote-templates?${query}`, scope), scopedOptions(scope),
    );
    templates.push(...result.templates);
    cursor = result.nextCursor;
  } while (cursor);
  return templates;
}

export type PriceListColumnRole = 'sku' | 'name' | 'unit' | 'price' | 'currency' | 'description' | 'effectiveFrom' | 'effectiveTo' | 'attribute' | 'ignore';
export type PriceListSheetPreview = {
  sheet: string;
  headerRow: number;
  headerRows: Array<{ row: number; cells: string[]; roles: PriceListColumnRole[] }>;
  rows: Array<{ sheet: string; row: number; cells: string[] }>;
};

export async function previewPriceList(scope: QuotationScope, file: Blob, filename: string) {
  return apiRequest<{ preview: { sheets: PriceListSheetPreview[] } }>(scopedPath('/quotation/price-list/preview', scope), scopedOptions(scope, {
    method: 'POST', body: file,
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(filename) },
  }));
}

export async function importPriceList(scope: QuotationScope, file: Blob, filename: string, mappings: Array<{ sheet: string; headerRow: number; roles: PriceListColumnRole[] }>) {
  return apiRequest<{
    file: { _id: string; originalFilename: string; bytes: number; updatedAt: string; productCount?: number; skippedRows?: number };
    imported: { inserted: number; updated: number; skippedRows: number };
  }>(scopedPath('/quotation/price-list', scope), scopedOptions(scope, {
    method: 'POST', body: file,
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(filename),
      'X-Catalog-Import-Mapping': encodeURIComponent(JSON.stringify(mappings)),
    },
  }));
}

export async function uploadQuotationTemplate(scope: QuotationScope, input: { file: Blob; filename: string; category: TemplateCategory; name: string }) {
  const headers = {
    'Content-Type': 'application/octet-stream',
    'x-template-category': input.category,
    'x-template-name': encodeURIComponent(input.name),
    'x-file-name': encodeURIComponent(input.filename),
  };
  const result = await apiRequest<{ template: QuotationTemplate }>(
    scopedPath('/quotation/quote-template', scope),
    scopedOptions(scope, { method: 'POST', body: input.file, headers }),
  );
  return result.template;
}

export async function deleteQuotationTemplate(scope: QuotationScope, id: string) {
  return apiRequest<{ deleted: boolean }>(scopedPath(`/quotation/quote-template/${encodeURIComponent(id)}`, scope), scopedOptions(scope, { method: 'DELETE' }));
}

export async function moveQuotationTemplate(scope: QuotationScope, id: string, category: TemplateCategory) {
  return apiRequest<{ template: QuotationTemplate }>(scopedPath(`/quotation/quote-template/${encodeURIComponent(id)}/category`, scope), scopedOptions(scope, { method: 'PATCH', body: { category } }));
}

export const CATALOG_PAGE_SIZE = 50;

export async function listCatalogItemsPage(
  scope: QuotationScope,
  page: number,
  status: 'all' | 'active' | 'upcoming' | 'expired' | 'inactive' | 'deleted' = 'all',
  includeDeleted = status === 'deleted',
) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(CATALOG_PAGE_SIZE), status });
  if (includeDeleted) query.set('includeDeleted', 'all');
  return apiRequest<{ items: CatalogItem[]; nextPage: number | null }>(
    scopedPath(`/quotation/catalog?${query}`, scope),
    scopedOptions(scope),
  );
}

export async function listCatalogItems(scope: QuotationScope, status: 'all' | 'active' | 'upcoming' | 'expired' | 'inactive' | 'deleted' = 'all', includeDeleted = status === 'deleted') {
  const items: CatalogItem[] = [];
  let page = 1;
  let nextPage: number | null = 1;
  while (nextPage) {
    const result = await listCatalogItemsPage(scope, page, status, includeDeleted);
    items.push(...result.items);
    nextPage = result.nextPage;
    page = nextPage ?? page;
  }
  return items;
}

export async function createCatalogItem(scope: QuotationScope, item: Omit<CatalogItem, '_id' | 'createdAt' | 'updatedAt'>) {
  const result = await apiRequest<{ item: CatalogItem }>(scopedPath('/quotation/catalog', scope), scopedOptions(scope, { method: 'POST', body: item, headers: { 'Idempotency-Key': makeOperationKey() } }));
  return result.item;
}

function makeOperationKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export async function updateCatalogItem(scope: QuotationScope, item: CatalogItem, changes: Partial<CatalogItem>) {
  const result = await apiRequest<{ item: CatalogItem }>(scopedPath(`/quotation/catalog/${encodeURIComponent(item._id)}`, scope), scopedOptions(scope, {
    method: 'PATCH', body: { ...item, ...changes }, headers: { 'If-Unmodified-Since': item.updatedAt || item.createdAt || '' },
  }));
  return result.item;
}

export async function duplicateCatalogItem(scope: QuotationScope, item: CatalogItem, input: Record<string, unknown>) {
  const result = await apiRequest<{ item: CatalogItem }>(scopedPath(`/quotation/catalog/${encodeURIComponent(item._id)}/duplicate`, scope), scopedOptions(scope, {
    method: 'POST', body: { ...input, sourceUpdatedAt: item.updatedAt || item.createdAt }, headers: { 'Idempotency-Key': makeOperationKey() },
  }));
  return result.item;
}

export async function changeCatalogItemState(scope: QuotationScope, item: CatalogItem, action: 'delete' | 'restore') {
  return apiRequest<{ items: CatalogItem[]; count: number }>(scopedPath(`/quotation/catalog/${encodeURIComponent(item._id)}${action === 'restore' ? '/restore' : ''}`, scope), scopedOptions(scope, {
    method: action === 'delete' ? 'DELETE' : 'POST', body: action === 'restore' ? {} : undefined,
    headers: { 'If-Unmodified-Since': item.updatedAt || item.createdAt || '', 'Idempotency-Key': makeOperationKey() },
  }));
}

export type CatalogBulkAction = 'activate' | 'deactivate' | 'delete' | 'restore' | 'price';

export async function previewCatalogBulk(scope: QuotationScope, action: CatalogBulkAction, items: CatalogItem[], adjustment?: { mode: 'amount' | 'percent'; value: number }) {
  return apiRequest<{ previewHash: string; rows: Array<{ id: string; sku: string; name: string; currency: string; before: Record<string, unknown>; after: Record<string, unknown> }> }>(scopedPath('/quotation/catalog/bulk/preview', scope), scopedOptions(scope, {
    method: 'POST', body: { action, selection: items.map((item) => ({ id: item._id, updatedAt: item.updatedAt || item.createdAt })), ...(adjustment ? { adjustment } : {}) },
  }));
}

export async function applyCatalogBulk(scope: QuotationScope, action: CatalogBulkAction, items: CatalogItem[], previewHash: string, adjustment?: { mode: 'amount' | 'percent'; value: number }) {
  return apiRequest<{ count: number; items: CatalogItem[] }>(scopedPath('/quotation/catalog/bulk', scope), scopedOptions(scope, {
    method: 'POST', body: { action, selection: items.map((item) => ({ id: item._id, updatedAt: item.updatedAt || item.createdAt })), ...(adjustment ? { adjustment } : {}), previewHash },
    headers: { 'Idempotency-Key': makeOperationKey() },
  }));
}

export async function listBudgetPlans(scope: QuotationScope) {
  const result = await apiRequest<{ plans: SavedBudgetPlan[] }>(scopedPath('/quotation/budget-plans', scope), scopedOptions(scope));
  return result.plans;
}

export async function createBudgetPlan(scope: QuotationScope, description: string, budget: number, area?: number, floors?: number) {
  return apiRequest<SavedBudgetPlan>(scopedPath('/quotation/budget-plans/suggest', scope), scopedOptions(scope, { method: 'POST', body: { description, budget, ...(area === undefined ? {} : { area }), ...(floors === undefined ? {} : { floors }) } }));
}

export async function updateBudgetPlan(scope: QuotationScope, id: string, change: Record<string, unknown>) {
  return apiRequest<SavedBudgetPlan>(scopedPath(`/quotation/budget-plans/${encodeURIComponent(id)}`, scope), scopedOptions(scope, { method: 'PATCH', body: change }));
}

export async function queueBudgetExport(scope: QuotationScope, id: string, templateId = 'none') {
  const query = new URLSearchParams({ background: '1', templateId });
  return apiRequest<{ jobId: string; status: string }>(scopedPath(`/quotation/budget-plans/${encodeURIComponent(id)}/export?${query}`, scope), scopedOptions(scope));
}

export async function listContracts(scope: QuotationScope) {
  const result = await apiRequest<{ contracts: QuotationContract[] }>(scopedPath('/quotation/contracts', scope), scopedOptions(scope));
  return result.contracts;
}

export async function getContract(scope: QuotationScope, id: string) {
  const result = await apiRequest<{ contract: QuotationContract }>(scopedPath(`/quotation/contracts/${encodeURIComponent(id)}`, scope), scopedOptions(scope));
  return result.contract;
}

export async function getContractPrefill(scope: QuotationScope) {
  const result = await apiRequest<{ company: CompanyPrefill }>(scopedPath('/quotation/contracts/prefill', scope), scopedOptions(scope));
  return result.company;
}

export async function createContract(scope: QuotationScope, input: Record<string, unknown>) {
  const result = await apiRequest<{ contract: QuotationContract }>(scopedPath('/quotation/contracts', scope), scopedOptions(scope, { method: 'POST', body: input }));
  return result.contract;
}

export async function updateContract(scope: QuotationScope, contract: QuotationContract, input: Record<string, unknown>) {
  const result = await apiRequest<{ contract: QuotationContract }>(scopedPath(`/quotation/contracts/${encodeURIComponent(contract._id)}`, scope), scopedOptions(scope, {
    method: 'PATCH', body: input, headers: { 'If-Unmodified-Since': contract.updatedAt },
  }));
  return result.contract;
}

export async function signContract(scope: QuotationScope, contract: QuotationContract, signedDate: string) {
  const result = await apiRequest<{ contract: QuotationContract }>(scopedPath(`/quotation/contracts/${encodeURIComponent(contract._id)}/sign`, scope), scopedOptions(scope, {
    method: 'POST', body: { signedDate }, headers: { 'If-Unmodified-Since': contract.updatedAt },
  }));
  return result.contract;
}

export async function queueContractFile(scope: QuotationScope, id: string) {
  return apiRequest<{ jobId: string; status: string }>(scopedPath(`/quotation/contracts/${encodeURIComponent(id)}/file?background=1`, scope), scopedOptions(scope));
}

export async function listAcceptanceRecords(scope: QuotationScope) {
  const result = await apiRequest<{ records: AcceptanceRecord[] }>(scopedPath('/quotation/acceptance-records', scope), scopedOptions(scope));
  return result.records;
}

export async function createAcceptanceRecord(scope: QuotationScope, input: Record<string, unknown>) {
  const result = await apiRequest<{ record: AcceptanceRecord }>(scopedPath('/quotation/acceptance-records', scope), scopedOptions(scope, { method: 'POST', body: input }));
  return result.record;
}

export async function updateAcceptanceRecord(scope: QuotationScope, record: AcceptanceRecord, input: Record<string, unknown>) {
  const result = await apiRequest<{ record: AcceptanceRecord }>(scopedPath(`/quotation/acceptance-records/${encodeURIComponent(record._id)}`, scope), scopedOptions(scope, { method: 'PATCH', body: input, headers: { 'If-Unmodified-Since': record.updatedAt } }));
  return result.record;
}

export async function completeAcceptanceRecord(scope: QuotationScope, record: AcceptanceRecord) {
  const result = await apiRequest<{ record: AcceptanceRecord }>(scopedPath(`/quotation/acceptance-records/${encodeURIComponent(record._id)}/complete`, scope), scopedOptions(scope, { method: 'POST', body: {}, headers: { 'If-Unmodified-Since': record.updatedAt } }));
  return result.record;
}

export async function getAcceptanceRecord(scope: QuotationScope, id: string) {
  return apiRequest<{ record: AcceptanceRecord; contract: QuotationContract }>(scopedPath(`/quotation/acceptance-records/${encodeURIComponent(id)}`, scope), scopedOptions(scope));
}

export async function queueAcceptanceFile(scope: QuotationScope, id: string) {
  return apiRequest<{ jobId: string; status: string }>(scopedPath(`/quotation/acceptance-records/${encodeURIComponent(id)}/file?background=1`, scope), scopedOptions(scope));
}

export async function queueSettlementFile(scope: QuotationScope, id: string) {
  return apiRequest<{ jobId: string; status: string }>(scopedPath(`/quotation/acceptance-records/${encodeURIComponent(id)}/settlement/file?background=1`, scope), scopedOptions(scope));
}

export async function loadDocumentTemplates(scope: QuotationScope, category: 'contract' | 'acceptance' | 'settlement') {
  const endpoint = category === 'contract' ? '/quotation/contract-templates' : category === 'acceptance' ? '/quotation/acceptance-templates' : '/quotation/settlement-templates';
  const result = await apiRequest<{ templates: Array<QuotationTemplate & { _id?: string }> }>(scopedPath(endpoint, scope), scopedOptions(scope));
  return (result.templates ?? []).map((template) => ({
    ...template,
    id: template.id || template._id || '',
  })).filter((template) => Boolean(template.id));
}

export async function loadPriceLists(scope: QuotationScope) {
  const result = await apiRequest<{ files: Array<{ _id: string; originalFilename: string; bytes: number; updatedAt?: string; productCount?: number; skippedRows?: number }> }>(scopedPath('/quotation/price-list', scope), scopedOptions(scope));
  return result.files;
}

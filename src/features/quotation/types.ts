export type QuoteKind = 'estimate' | 'customer';
export type QuoteStatus = 'draft' | 'needs_info' | 'pending_review' | 'approved' | 'rejected';

export type QuoteLine = {
  source?: 'catalog' | 'supplemental';
  supplementalFor?: string;
  catalogItemId: string;
  sku: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  currency: string;
  lineTotal: number;
  priceUnavailable?: boolean;
};

export type Quote = {
  _id: string;
  kind?: QuoteKind;
  quoteNumber: string;
  requestId: string;
  requestText?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  lines: QuoteLine[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  shippingFee?: number | null;
  taxRateConfirmed?: boolean;
  shippingFeeConfirmed?: boolean;
  validityDays?: number | null;
  completionDate?: string | null;
  total: number;
  currency: string;
  informationNeeded: string[];
  missingProducts?: string[];
  suggestedProducts?: Array<{ informationField?: string; name?: string; description?: string; unit?: string; quantity?: number }>;
  sourceRequirements?: string;
  sourceQuote?: { id: string; quoteNumber: string };
  requestFile?: { id: string; originalFilename: string };
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  rejectionReason?: string;
  template?: { id: string; name?: string; originalFilename: string };
  additionalInformation?: Record<string, string>;
  revisionRequirements?: string;
  requiresAiRecalculation?: boolean;
};

export type QuoteListStats = {
  total: number;
  drafts: number;
  pending: number;
  approved: number;
  needsInfo: number;
  rejected: number;
  approvedRevenue: number;
};

export type QuoteListResponse = {
  quotes: Quote[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  stats: QuoteListStats;
};

export type QuoteTemplate = {
  id: string;
  name?: string;
  originalFilename: string;
  extension?: string;
};

export type CustomerQuoteSuggestion = {
  items: Array<{ catalogItemId: string; quantity: number; unit: string }>;
  missingProducts: string[];
  questions: string[];
  notes: string[];
};

export type CatalogItem = {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  unit: string;
  price: number;
  currency: string;
  active: boolean;
  attributes?: Record<string, string>;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
};

export type AnalysisItem = {
  catalogItemId: string;
  quantity: number;
  unit: string;
  attributes: Record<string, string>;
  evidence?: string;
};

export type QuoteAnalysis = {
  status: 'matched' | 'ambiguous' | 'not_found';
  items: AnalysisItem[];
  missingFields: string[];
  suggestedProducts?: Array<{ name: string; description?: string; unit?: string; quantity?: number }>;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
};

export type QuotationScope = { companyCode?: string; branchId?: string };

export type TemplateCategory = 'quote' | 'estimate' | 'contract' | 'acceptance' | 'settlement';

export type QuotationTemplate = QuoteTemplate & {
  extension: string;
  bytes?: number;
  createdAt?: string;
  category?: TemplateCategory;
};

export type BudgetLine = {
  catalogItemId: string;
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
  currency: string;
  quantity: number | null;
  lineTotal: number | null;
  reason: string;
  quantityBasis?: 'measured' | 'estimated';
  quantityNote?: string;
};

export type BudgetPlanResult = {
  scope: string;
  budget: number;
  currency: string;
  lines: BudgetLine[];
  knownTotal: number | null;
  total: number | null;
  difference: number | null;
  questions: string[];
  missingProducts: string[];
  assumptions: string[];
  assumptionConfirmations?: boolean[];
  resolvedMissingProducts?: string[];
  provisional?: boolean;
};

export type SavedBudgetPlan = {
  id: string;
  input: { description: string; budget: number; area?: number; floors?: number };
  result: BudgetPlanResult;
  createdAt: string;
  updatedAt?: string;
};

export type QuotationContract = {
  _id: string;
  quoteId: string;
  quoteNumber: string;
  contractNumber: string;
  template?: { id: string; name?: string; originalFilename: string };
  status: 'draft' | 'signed';
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerTaxId: string;
  customerRepresentative: string;
  companyName: string;
  companyAddress: string;
  companyTaxId: string;
  companyRepresentative: string;
  companyPhone: string;
  companyEmail: string;
  lines: QuoteLine[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  shippingFee: number;
  total: number;
  currency: string;
  scope: string;
  projectName: string;
  projectAddress: string;
  deliverables: string;
  depositAmount: number;
  bankDetails: string;
  otherTerms: string;
  paymentTerms: string;
  deliveryTerms: string;
  signingPlace: string;
  signedDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AcceptanceLine = { lineIndex: number; acceptedQuantity: number; acceptedDetails?: string };

export type AcceptanceRecord = {
  _id: string;
  contractId: string;
  contractNumber: string;
  acceptanceNumber: string;
  template?: { id: string; name?: string; originalFilename: string };
  status: 'draft' | 'completed';
  acceptedDate: string;
  startTime: string;
  endTime: string;
  location: string;
  result: string;
  handoverDetails: string;
  qualityAssessment: string;
  settlementAmount: number;
  amountPaid: number;
  paymentDueDays: number | null;
  notes: string;
  lines: AcceptanceLine[];
  createdAt: string;
  updatedAt: string;
};

export type CompanyPrefill = { name: string; address: string; taxId: string; representativeName: string; phone: string; email: string };

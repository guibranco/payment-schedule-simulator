export type CollectionFrequency = 'Monthly' | 'Annual';

export interface AdminFee {
  amountDue: number;
  taxAmount: number;
}

export interface PaymentScheduleInput {
  collectionFrequency: CollectionFrequency;
  scheduleStartDate: string;
  scheduleEndDate: string;
  collectionDay: number | null;
  effectiveDate: string;
  dueDate: string | null;
  netAmount: number;
  // Tax label -> effective date -> amount. Unlike the flat, already-computed
  // taxesAndLevies on a ScheduleItem, the calculate request keys each tax rate
  // by the date it takes effect (see CalculateScheduleRequestV2 in the API's swagger).
  taxesAndLevies: Record<string, Record<string, number>>;
  adminFees: Record<string, AdminFee>;
  currentSchedule?: PaymentScheduleResponse;
}

export interface ScheduleItem {
  id: string;
  collectionType: string;
  periodStartDate: string;
  periodEndDate: string;
  adjustmentDate: string;
  dueDate: string;
  amountDue: number;
  netAmount: number;
  taxesAndLevies: Record<string, number>;
  adminFees: Record<string, AdminFee>;
  collectionItemCreatedDate?: string;
  succeeded: boolean | null;
  originalItem?: ScheduleItem | null;
}

export interface PaymentScheduleResponse {
  id: string;
  token: string;
  hash: string;
  collectionFrequency: string;
  collectionDay: number;
  inceptionDate: string;
  coverStartDate: string;
  coverEndDate: string;
  scheduleItems: ScheduleItem[];
}

// Collections reconciliation types

export interface CollectionProviderDetails {
  processingDate?: string;
  filename?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

/**
 * A single collection attempt returned by the Collections Service for a schedule.
 * `paymentScheduleItemIds` links it back to one or more ScheduleItem.id values —
 * a batched/annual collection can cover several schedule items at once.
 */
export interface CollectionTransaction {
  batchId?: string;
  collectionId?: string;
  paymentScheduleItemIds: string[];
  documentId?: string;
  isResubmission?: boolean;
  resubmissionId?: string | null;
  amountDue: number;
  dueDate?: string;
  valueDate?: string;
  collectionStatus: string;
  transactionReference?: string;
  originalTransactionReference?: string | null;
  providerDetails?: CollectionProviderDetails;
  createdDate?: string;
  modifiedDate?: string;
}

export type ReconciledStatus = 'collected' | 'rejected' | 'refunded' | 'pending';

export interface ItemReconciliation {
  status: ReconciledStatus;
  transactions: CollectionTransaction[];
  latestTransaction: CollectionTransaction | null;
  amountMismatch: boolean;
  statusMismatch: boolean;
}

export interface ReconciliationSummary {
  totalItems: number;
  collected: number;
  rejected: number;
  refunded: number;
  pending: number;
  mismatches: number;
}

// API Error Types
export interface ValidationError {
  propertyName: string;
  errorMessage: string;
  attemptedValue: any;
  customState: any;
  severity: string;
  errorCode: string;
  formattedMessagePlaceholderValues: Record<string, any>;
}

export interface ProblemDetailsError {
  type: string;
  title: string;
  status: number;
  errors: Record<string, string[]>;
  traceId: string;
}

export interface ApiErrorResponse {
  message: string;
  details: string[];
  type: 'validation' | 'problem-details' | 'generic';
}
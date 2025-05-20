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
  taxesAndLevies: Record<string, number>;
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
import { AdminFee, PaymentScheduleInput, PaymentScheduleResponse, ScheduleItem } from '../types';

export type ScheduleFormat = 'response' | 'request' | 'policyAdmin' | 'rerates';

export const FORMAT_LABELS: Record<ScheduleFormat, string> = {
  response: 'Payment Schedule Service Response',
  request: 'Payment Schedule Service Request',
  policyAdmin: 'Policy Admin CosmosDB Document',
  rerates: 'Rerates CosmosDB Document'
};

export interface DetectedSchedule {
  format: ScheduleFormat;
  schedule: PaymentScheduleResponse | null;
  input: PaymentScheduleInput | null;
}

function keysLower(obj: any): Set<string> {
  return new Set(Object.keys(obj || {}).map((k) => k.toLowerCase()));
}

function getCI(obj: any, key: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  const foundKey = Object.keys(obj).find((k) => k.toLowerCase() === key.toLowerCase());
  return foundKey ? obj[foundKey] : undefined;
}

function normalizeFrequencyLabel(frequency: string): 'Monthly' | 'Annual' {
  return (frequency || '').toLowerCase() === 'monthly' ? 'Monthly' : 'Annual';
}

function normalizeAdminFees(fees: any): Record<string, AdminFee> {
  const result: Record<string, AdminFee> = {};
  for (const [key, value] of Object.entries(fees || {})) {
    const fee = value as any;
    result[key] = {
      amountDue: Number(fee?.AmountDue ?? fee?.amountDue ?? 0),
      taxAmount: Number(fee?.TaxAmount ?? fee?.taxAmount ?? 0)
    };
  }
  return result;
}

/**
 * Normalizes a request-format taxesAndLevies map (tax label -> effective date -> amount)
 * from raw JSON, coercing amounts to numbers.
 */
function normalizeTaxesAndLevies(taxes: any): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const [key, value] of Object.entries(taxes || {})) {
    const dates: Record<string, number> = {};
    for (const [date, amount] of Object.entries((value as object) || {})) {
      dates[date] = Number(amount || 0);
    }
    result[key] = dates;
  }
  return result;
}

function normalizePascalItem(item: any): ScheduleItem {
  return {
    id: item.Id,
    collectionType: item.CollectionType || 'Full',
    periodStartDate: item.PeriodStartDate,
    periodEndDate: item.PeriodEndDate,
    adjustmentDate: item.AdjustmentDate || null,
    dueDate: item.DueDate,
    amountDue: Number(item.AmountDue || 0),
    netAmount: Number(item.NetAmount || 0),
    taxesAndLevies: item.TaxesAndLevies || {},
    adminFees: normalizeAdminFees(item.AdminFees),
    collectionItemCreatedDate: item.CollectionItemCreatedDate || undefined,
    succeeded: item.Succeeded !== undefined ? item.Succeeded : null,
    originalItem: item.OriginalItem ? normalizePascalItem(item.OriginalItem) : null
  };
}

function normalizeCamelItem(item: any): ScheduleItem {
  return {
    id: item.id,
    collectionType: item.collectionType || 'full',
    periodStartDate: item.periodStartDate,
    periodEndDate: item.periodEndDate,
    adjustmentDate: item.adjustmentDate || null,
    dueDate: item.dueDate,
    amountDue: Number(item.amountDue || 0),
    netAmount: Number(item.netAmount || 0),
    taxesAndLevies: item.taxesAndLevies || {},
    adminFees: normalizeAdminFees(item.adminFees),
    collectionItemCreatedDate: item.collectionItemCreatedDate || undefined,
    succeeded: item.succeeded !== undefined ? item.succeeded : null,
    originalItem: item.originalItem ? normalizeCamelItem(item.originalItem) : null
  };
}

/**
 * Detects which of the four supported payment schedule JSON shapes was provided.
 *
 * Detection relies on structural markers rather than exact key casing, since
 * Policy Admin/Rerates CosmosDB documents use PascalCase while the Payment
 * Schedule Service uses camelCase:
 * - `scheduleItems`/`ScheduleItems` (array) distinguishes Response/Policy Admin from Rerates (`Items`).
 * - `PolicyNumber`/`RiskId`/`RiskCode`/`SchemaVersion` distinguish Policy Admin from a plain Response.
 * - Presence of `Items` alongside `collectionFrequency` identifies a Rerates document.
 * - Otherwise, top-level `collectionFrequency`/`scheduleStartDate`/`effectiveDate`/`netAmount` identify a Request.
 */
export function detectScheduleFormat(json: any): ScheduleFormat {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('Input must be a JSON object.');
  }

  const keys = keysLower(json);
  const hasScheduleItems = keys.has('scheduleitems') && Array.isArray(getCI(json, 'scheduleItems'));
  const hasItems = keys.has('items') && Array.isArray(getCI(json, 'items'));
  const hasPolicyAdminMarkers =
    keys.has('policynumber') || keys.has('riskid') || keys.has('riskcode') || keys.has('schemaversion');

  if (hasScheduleItems) {
    return hasPolicyAdminMarkers ? 'policyAdmin' : 'response';
  }

  if (hasItems && keys.has('collectionfrequency')) {
    return 'rerates';
  }

  if (
    keys.has('collectionfrequency') &&
    keys.has('schedulestartdate') &&
    keys.has('effectivedate') &&
    getCI(json, 'netAmount') != null &&
    !isNaN(Number(getCI(json, 'netAmount')))
  ) {
    return 'request';
  }

  throw new Error(
    `Unrecognized JSON format. Expected one of: ${Object.values(FORMAT_LABELS).join(', ')}.`
  );
}

function convertResponse(json: any): PaymentScheduleResponse {
  return {
    id: json.id,
    token: json.token || '',
    hash: json.hash || '',
    collectionFrequency: (json.collectionFrequency || '').toLowerCase(),
    collectionDay: json.collectionDay,
    inceptionDate: json.inceptionDate,
    coverStartDate: json.coverStartDate,
    coverEndDate: json.coverEndDate,
    scheduleItems: (json.scheduleItems || []).map(normalizeCamelItem)
  };
}

function convertPolicyAdmin(json: any): PaymentScheduleResponse {
  return {
    id: json.PaymentScheduleId,
    token: json.Token || '',
    hash: json.Hash || '',
    collectionFrequency: (json.CollectionFrequency || '').toLowerCase(),
    collectionDay: json.CollectionDay,
    inceptionDate: json.InceptionDate,
    coverStartDate: json.CoverStartDate,
    coverEndDate: json.CoverEndDate,
    scheduleItems: (json.ScheduleItems || []).map(normalizePascalItem)
  };
}

function convertRerates(json: any): PaymentScheduleResponse {
  return {
    id: json.PaymentScheduleId,
    token: json.Token || '',
    hash: json.Hash || '',
    collectionFrequency: (json.CollectionFrequency || '').toLowerCase(),
    collectionDay: json.CollectionDay,
    inceptionDate: json.InceptionDate,
    coverStartDate: json.CoverStartDate,
    coverEndDate: json.CoverEndDate,
    scheduleItems: (json.Items || []).map(normalizePascalItem)
  };
}

/**
 * Derives a best-effort PaymentScheduleInput from an already-computed schedule.
 * Used for Response/Policy Admin/Rerates formats where the original request
 * parameters are not available, so amounts are approximated from the items.
 */
export function deriveInputFromResponse(schedule: PaymentScheduleResponse): PaymentScheduleInput {
  // The API's calculate request keys each tax rate by the date it takes effect, but a
  // computed ScheduleItem only ever carries the flat, already-resolved amount, so the
  // real effective date isn't recoverable here — approximated with the .NET-style
  // "unspecified date" sentinel used elsewhere in this app (e.g. default scheduleEndDate).
  const taxesAndLevies: Record<string, Record<string, number>> = {};
  for (const [key, amount] of Object.entries(schedule.scheduleItems[0]?.taxesAndLevies || {})) {
    taxesAndLevies[key] = { '0001-01-01': Number(amount || 0) };
  }

  return {
    collectionFrequency: normalizeFrequencyLabel(schedule.collectionFrequency),
    scheduleStartDate: schedule.coverStartDate,
    scheduleEndDate: schedule.coverEndDate,
    collectionDay: schedule.collectionDay,
    effectiveDate: schedule.inceptionDate,
    dueDate: schedule.scheduleItems[0]?.dueDate || null,
    netAmount: schedule.scheduleItems.reduce((sum, item) => sum + item.netAmount, 0),
    taxesAndLevies,
    adminFees: schedule.scheduleItems.reduce<Record<string, AdminFee>>((fees, item) => {
      for (const [key, value] of Object.entries(item.adminFees || {})) {
        const existing = fees[key] ?? { amountDue: 0, taxAmount: 0 };
        fees[key] = {
          amountDue: existing.amountDue + Number(value.amountDue || 0),
          taxAmount: existing.taxAmount + Number(value.taxAmount || 0)
        };
      }
      return fees;
    }, {}),
    currentSchedule: schedule
  };
}

function toPascalAdminFees(fees: Record<string, AdminFee>): Record<string, { AmountDue: number; TaxAmount: number }> {
  const result: Record<string, { AmountDue: number; TaxAmount: number }> = {};
  for (const [key, value] of Object.entries(fees || {})) {
    result[key] = { AmountDue: value.amountDue, TaxAmount: value.taxAmount };
  }
  return result;
}

function toPascalItem(item: ScheduleItem): any {
  return {
    Id: item.id,
    CollectionType: item.collectionType,
    PeriodStartDate: item.periodStartDate,
    PeriodEndDate: item.periodEndDate,
    AdjustmentDate: item.adjustmentDate,
    DueDate: item.dueDate,
    AmountDue: item.amountDue,
    NetAmount: item.netAmount,
    TaxesAndLevies: item.taxesAndLevies,
    AdminFees: toPascalAdminFees(item.adminFees),
    OriginalItem: item.originalItem ? toPascalItem(item.originalItem) : null,
    CollectionItemCreatedDate: item.collectionItemCreatedDate ?? null,
    Succeeded: item.succeeded
  };
}

function toFrequencyLabel(frequency: string): string {
  return frequency ? frequency.charAt(0).toUpperCase() + frequency.slice(1).toLowerCase() : frequency;
}

/**
 * Re-serializes a normalized PaymentScheduleResponse as a Policy Admin CosmosDB
 * document. Fields that only exist on the original CosmosDB document and aren't
 * tracked on the canonical response (PolicyNumber, RiskId, etc.) are omitted.
 */
export function convertResponseToPolicyAdminDocument(schedule: PaymentScheduleResponse): object {
  return {
    PaymentScheduleId: schedule.id,
    Token: schedule.token,
    Hash: schedule.hash,
    CollectionFrequency: toFrequencyLabel(schedule.collectionFrequency),
    CollectionDay: schedule.collectionDay,
    InceptionDate: schedule.inceptionDate,
    CoverStartDate: schedule.coverStartDate,
    CoverEndDate: schedule.coverEndDate,
    ScheduleItems: schedule.scheduleItems.map(toPascalItem),
    // Schema versioning marker present on every real Policy Admin document (not
    // policy-specific data), kept so this re-serialization is still detected as
    // 'policyAdmin' rather than a plain Response if pasted back into the tool.
    SchemaVersion: 0
  };
}

/**
 * Re-serializes a normalized PaymentScheduleResponse as a Rerates CosmosDB
 * document. Fields only present on the original document (PolicyNumber, BatchId,
 * etc.) are omitted since they aren't tracked on the canonical response.
 */
export function convertResponseToReratesDocument(schedule: PaymentScheduleResponse): object {
  return {
    PaymentScheduleId: schedule.id,
    Token: schedule.token,
    Hash: schedule.hash,
    CollectionFrequency: toFrequencyLabel(schedule.collectionFrequency),
    CollectionDay: schedule.collectionDay,
    InceptionDate: schedule.inceptionDate,
    CoverStartDate: schedule.coverStartDate,
    CoverEndDate: schedule.coverEndDate,
    Items: schedule.scheduleItems.map(toPascalItem)
  };
}

/**
 * Re-serializes a normalized PaymentScheduleResponse as a Payment Schedule
 * Service Request (amendment), deriving the input parameters from the schedule.
 */
export function convertResponseToRequest(schedule: PaymentScheduleResponse): PaymentScheduleInput {
  return deriveInputFromResponse(schedule);
}

/**
 * Re-serializes a normalized PaymentScheduleResponse into any of the 4
 * supported JSON shapes, for the "View JSON as..." format picker.
 */
export function convertResponseToFormat(schedule: PaymentScheduleResponse, format: ScheduleFormat): object {
  switch (format) {
    case 'policyAdmin':
      return convertResponseToPolicyAdminDocument(schedule);
    case 'rerates':
      return convertResponseToReratesDocument(schedule);
    case 'request':
      return convertResponseToRequest(schedule);
    case 'response':
    default:
      return schedule;
  }
}

/**
 * Detects the format of a pasted/uploaded JSON document and normalizes it into
 * a PaymentScheduleResponse for display (when available) plus a PaymentScheduleInput
 * suitable for handing off to the New/Amend Schedule form.
 *
 * For the Request format, the original input parameters are used verbatim (more
 * accurate than deriving them from computed schedule items), and the schedule
 * shown is the request's embedded `currentSchedule`, if any.
 */
export function detectAndNormalizeSchedule(json: any): DetectedSchedule {
  const format = detectScheduleFormat(json);

  if (format === 'response') {
    const schedule = convertResponse(json);
    return { format, schedule, input: deriveInputFromResponse(schedule) };
  }

  if (format === 'policyAdmin') {
    const schedule = convertPolicyAdmin(json);
    return { format, schedule, input: deriveInputFromResponse(schedule) };
  }

  if (format === 'rerates') {
    const schedule = convertRerates(json);
    return { format, schedule, input: deriveInputFromResponse(schedule) };
  }

  // format === 'request'
  const schedule = json.currentSchedule ? convertResponse(json.currentSchedule) : null;
  const input: PaymentScheduleInput = {
    collectionFrequency: normalizeFrequencyLabel(json.collectionFrequency),
    scheduleStartDate: json.scheduleStartDate,
    scheduleEndDate: json.scheduleEndDate || '0001-01-01',
    collectionDay: json.collectionDay ?? null,
    effectiveDate: json.effectiveDate,
    dueDate: json.dueDate || null,
    netAmount: Number(json.netAmount || 0),
    taxesAndLevies: normalizeTaxesAndLevies(json.taxesAndLevies),
    adminFees: normalizeAdminFees(json.adminFees),
    currentSchedule: schedule || undefined
  };
  return { format, schedule, input };
}

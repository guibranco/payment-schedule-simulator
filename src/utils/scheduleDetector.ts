import type {
  AdminFee,
  PaymentScheduleInput,
  PaymentScheduleResponse,
  ScheduleItem,
} from "../types";

export type ScheduleFormat =
  | "response"
  | "request"
  | "policyAdmin"
  | "rerates"
  | "seq";

export const FORMAT_LABELS: Record<ScheduleFormat, string> = {
  response: "Payment Schedule Service Response",
  request: "Payment Schedule Service Request",
  policyAdmin: "Policy Admin CosmosDB Document",
  rerates: "Rerates CosmosDB Document",
  seq: "SEQ Log (Policy Admin Raw Request)",
};

export interface DetectedSchedule {
  format: ScheduleFormat;
  schedule: PaymentScheduleResponse | null;
  input: PaymentScheduleInput | null;
}

/** A parsed JSON object whose shape hasn't been validated yet. */
type JsonObject = Record<string, unknown>;

/** An admin fee as found in raw JSON, in either casing, with amounts possibly as strings. */
interface RawAdminFee {
  AmountDue?: number | string;
  amountDue?: number | string;
  TaxAmount?: number | string;
  taxAmount?: number | string;
}

/** A schedule item as serialized by Policy Admin/Rerates/SEQ (PascalCase). */
interface RawPascalItem {
  Id: string;
  CollectionType?: string | number;
  PeriodStartDate: string;
  PeriodEndDate: string;
  AdjustmentDate?: string | null;
  DueDate: string;
  AmountDue?: number;
  NetAmount?: number;
  TaxesAndLevies?: Record<string, number>;
  AdminFees?: Record<string, RawAdminFee>;
  OriginalItem?: RawPascalItem | null;
  CollectionItemCreatedDate?: string | null;
  Succeeded?: boolean | null;
}

/** A schedule item as returned by the Payment Schedule Service (camelCase). */
interface RawCamelItem {
  id: string;
  collectionType?: string;
  periodStartDate: string;
  periodEndDate: string;
  adjustmentDate?: string | null;
  dueDate: string;
  amountDue?: number;
  netAmount?: number;
  taxesAndLevies?: Record<string, number>;
  adminFees?: Record<string, RawAdminFee>;
  originalItem?: RawCamelItem | null;
  collectionItemCreatedDate?: string | null;
  succeeded?: boolean | null;
}

/** A Payment Schedule Service Response (camelCase). */
interface RawResponse {
  id: string;
  token?: string;
  hash?: string;
  collectionFrequency?: string;
  collectionDay: number;
  inceptionDate: string;
  coverStartDate: string;
  coverEndDate: string;
  scheduleItems?: RawCamelItem[];
}

/** The schedule fields shared by the PascalCase CosmosDB documents and SEQ logs. */
interface RawPascalSchedule {
  Token?: string;
  Hash?: string;
  CollectionFrequency?: string | number;
  CollectionDay: number;
  InceptionDate: string;
  CoverStartDate: string;
  CoverEndDate: string;
  ModifiedBy?: string | null;
}

/** The policy/risk a CosmosDB schedule document belongs to. */
interface RawPolicyRisk {
  PolicyNumber?: string | null;
  RiskId?: number | null;
}

/** A Policy Admin CosmosDB document. */
interface RawPolicyAdminDocument extends RawPascalSchedule, RawPolicyRisk {
  PaymentScheduleId: string;
  ScheduleItems?: RawPascalItem[];
  RiskTotalAnnualisedPremium?: number | null;
  RiskStatus?: string | null;
}

/** A Rerates CosmosDB document. */
interface RawReratesDocument extends RawPascalSchedule, RawPolicyRisk {
  PaymentScheduleId: string;
  Items?: RawPascalItem[];
}

/** The `CurrentSchedule` embedded in a SEQ-logged Policy Admin request. */
interface RawSeqSchedule extends RawPascalSchedule {
  Id: string;
  ScheduleItems?: RawPascalItem[];
}

/** A Payment Schedule Service Request (camelCase). */
interface RawRequest {
  collectionFrequency: string | number;
  scheduleStartDate: string;
  scheduleEndDate?: string | null;
  collectionDay?: number | null;
  effectiveDate: string;
  dueDate?: string | null;
  netAmount: number | string;
  taxesAndLevies?: unknown;
  adminFees?: Record<string, RawAdminFee>;
  currentSchedule?: RawResponse | null;
}

/** A SEQ log entry of Policy Admin's raw calculate request (PascalCase, integer enums). */
interface RawSeqRequest {
  CollectionFrequency: string | number;
  ScheduleStartDate: string;
  ScheduleEndDate?: string | null;
  CollectionDay?: number | null;
  EffectiveDate: string;
  DueDate?: string | null;
  NetAmount: number | string;
  TaxesAndLevies?: unknown;
  AdminFees?: Record<string, RawAdminFee>;
  CurrentSchedule?: RawSeqSchedule | null;
}

/** The PascalCase item shape written back out when re-serializing to a CosmosDB document. */
interface PascalScheduleItem {
  Id: string;
  CollectionType: string;
  PeriodStartDate: string;
  PeriodEndDate: string;
  AdjustmentDate: string | null;
  DueDate: string;
  AmountDue: number;
  NetAmount: number;
  TaxesAndLevies: Record<string, number>;
  AdminFees: Record<string, { AmountDue: number; TaxAmount: number }>;
  OriginalItem: PascalScheduleItem | null;
  CollectionItemCreatedDate: string | null;
  Succeeded: boolean | null;
}

/** The object's own keys, lower-cased, for case-insensitive structural detection. */
function keysLower(obj: object): Set<string> {
  return new Set(Object.keys(obj).map((k) => k.toLowerCase()));
}

/** Reads a property by name, ignoring the key's casing. */
function getCI(obj: JsonObject, key: string): unknown {
  const foundKey = Object.keys(obj).find(
    (k) => k.toLowerCase() === key.toLowerCase(),
  );
  return foundKey ? obj[foundKey] : undefined;
}

/** A collection frequency's display label, as used in requests and CosmosDB documents. */
type FrequencyLabel = "Monthly" | "Annual";

// SEQ logs Policy Admin's raw request, which serializes CollectionFrequency/CollectionType
// enums as their underlying integers rather than the string labels used everywhere else.
const COLLECTION_FREQUENCY_LABELS: Record<number, FrequencyLabel> = {
  1: "Monthly",
  2: "Annual",
};
const COLLECTION_TYPE_LABELS: Record<number, string> = {
  1: "Full",
  2: "ProRata",
};

/** Normalizes a collection frequency (string label or SEQ integer enum) to its label, defaulting to Annual. */
function normalizeFrequencyLabel(
  frequency: string | number | undefined,
): FrequencyLabel {
  if (typeof frequency === "number") {
    return COLLECTION_FREQUENCY_LABELS[frequency] ?? "Annual";
  }
  return (frequency || "").toLowerCase() === "monthly" ? "Monthly" : "Annual";
}

/** Normalizes a Collection Type (string label or SEQ integer enum) to its label, defaulting to Full. */
function normalizeCollectionType(
  collectionType: string | number | undefined,
): string {
  if (typeof collectionType === "number") {
    return COLLECTION_TYPE_LABELS[collectionType] ?? String(collectionType);
  }
  return collectionType || "Full";
}

/** Normalizes raw admin fees in either casing, coercing amounts to numbers. */
function normalizeAdminFees(
  fees: Record<string, RawAdminFee> | undefined,
): Record<string, AdminFee> {
  const result: Record<string, AdminFee> = {};
  for (const [key, fee] of Object.entries(fees || {})) {
    result[key] = {
      amountDue: Number(fee?.AmountDue ?? fee?.amountDue ?? 0),
      taxAmount: Number(fee?.TaxAmount ?? fee?.taxAmount ?? 0),
    };
  }
  return result;
}

/**
 * Normalizes a request-format taxesAndLevies map (tax label -> effective date -> amount)
 * from raw JSON, coercing amounts to numbers.
 */
function normalizeTaxesAndLevies(
  taxes: unknown,
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const [key, value] of Object.entries(taxes || {})) {
    if (value && typeof value === "object") {
      const dates: Record<string, number> = {};
      for (const [date, amount] of Object.entries(value)) {
        dates[date] = Number(amount || 0);
      }
      result[key] = dates;
    }
  }
  return result;
}

/** Converts a PascalCase schedule item (and its Basis Item) to the canonical ScheduleItem. */
function normalizePascalItem(item: RawPascalItem): ScheduleItem {
  return {
    id: item.Id,
    collectionType: normalizeCollectionType(item.CollectionType),
    periodStartDate: item.PeriodStartDate,
    periodEndDate: item.PeriodEndDate,
    adjustmentDate: item.AdjustmentDate || null,
    dueDate: item.DueDate,
    amountDue: Number(item.AmountDue || 0),
    netAmount: Number(item.NetAmount || 0),
    taxesAndLevies: item.TaxesAndLevies || {},
    adminFees: normalizeAdminFees(item.AdminFees),
    collectionItemCreatedDate: item.CollectionItemCreatedDate || undefined,
    succeeded: item.Succeeded ?? null,
    originalItem: item.OriginalItem
      ? normalizePascalItem(item.OriginalItem)
      : null,
  };
}

/** Converts a camelCase schedule item (and its Basis Item) to the canonical ScheduleItem. */
function normalizeCamelItem(item: RawCamelItem): ScheduleItem {
  return {
    id: item.id,
    collectionType: item.collectionType || "full",
    periodStartDate: item.periodStartDate,
    periodEndDate: item.periodEndDate,
    adjustmentDate: item.adjustmentDate || null,
    dueDate: item.dueDate,
    amountDue: Number(item.amountDue || 0),
    netAmount: Number(item.netAmount || 0),
    taxesAndLevies: item.taxesAndLevies || {},
    adminFees: normalizeAdminFees(item.adminFees),
    collectionItemCreatedDate: item.collectionItemCreatedDate || undefined,
    succeeded: item.succeeded ?? null,
    originalItem: item.originalItem
      ? normalizeCamelItem(item.originalItem)
      : null,
  };
}

/**
 * Detects which of the five supported payment schedule JSON shapes was provided.
 *
 * Detection relies on structural markers rather than exact key casing, since
 * Policy Admin/Rerates CosmosDB documents use PascalCase while the Payment
 * Schedule Service uses camelCase:
 * - `scheduleItems`/`ScheduleItems` (array) distinguishes Response/Policy Admin from Rerates (`Items`).
 * - `PolicyNumber`/`RiskId`/`RiskCode`/`SchemaVersion` distinguish Policy Admin from a plain Response.
 * - Presence of `Items` alongside `collectionFrequency` identifies a Rerates document.
 * - Otherwise, top-level `collectionFrequency`/`scheduleStartDate`/`effectiveDate`/`netAmount` identify
 *   a Request or a SEQ log of Policy Admin's raw calculate request — the two share this shape (down to
 *   an embedded `currentSchedule`/`CurrentSchedule`), so the literal (case-sensitive) `CollectionFrequency`
 *   key is what distinguishes SEQ's PascalCase, integer-enum log entry from the Payment Schedule
 *   Service's camelCase, string-enum Request.
 */
export function detectScheduleFormat(json: unknown): ScheduleFormat {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Input must be a JSON object.");
  }
  const obj = json as JsonObject;

  const keys = keysLower(obj);
  const hasScheduleItems =
    keys.has("scheduleitems") && Array.isArray(getCI(obj, "scheduleItems"));
  const hasItems = keys.has("items") && Array.isArray(getCI(obj, "items"));
  const hasPolicyAdminMarkers =
    keys.has("policynumber") ||
    keys.has("riskid") ||
    keys.has("riskcode") ||
    keys.has("schemaversion");

  if (hasScheduleItems) {
    return hasPolicyAdminMarkers ? "policyAdmin" : "response";
  }

  if (hasItems && keys.has("collectionfrequency")) {
    return "rerates";
  }

  if (
    keys.has("collectionfrequency") &&
    keys.has("schedulestartdate") &&
    keys.has("effectivedate") &&
    getCI(obj, "netAmount") != null &&
    !Number.isNaN(Number(getCI(obj, "netAmount")))
  ) {
    return Object.hasOwn(obj, "CollectionFrequency")
      ? "seq"
      : "request";
  }

  throw new Error(
    `Unrecognized JSON format. Expected one of: ${Object.values(FORMAT_LABELS).join(", ")}.`,
  );
}

/** Converts a Payment Schedule Service Response to the canonical schedule. */
function convertResponse(json: RawResponse): PaymentScheduleResponse {
  return {
    id: json.id,
    token: json.token || "",
    hash: json.hash || "",
    collectionFrequency: (json.collectionFrequency || "").toLowerCase(),
    collectionDay: json.collectionDay,
    inceptionDate: json.inceptionDate,
    coverStartDate: json.coverStartDate,
    coverEndDate: json.coverEndDate,
    scheduleItems: (json.scheduleItems || []).map(normalizeCamelItem),
  };
}

/** Converts a Policy Admin CosmosDB document to the canonical schedule, keeping its policy-level context. */
function convertPolicyAdmin(
  json: RawPolicyAdminDocument,
): PaymentScheduleResponse {
  return {
    id: json.PaymentScheduleId,
    token: json.Token || "",
    hash: json.Hash || "",
    collectionFrequency: String(json.CollectionFrequency || "").toLowerCase(),
    collectionDay: json.CollectionDay,
    inceptionDate: json.InceptionDate,
    coverStartDate: json.CoverStartDate,
    coverEndDate: json.CoverEndDate,
    scheduleItems: (json.ScheduleItems || []).map(normalizePascalItem),
    annualisedPremium: json.RiskTotalAnnualisedPremium ?? null,
    riskStatus: json.RiskStatus ?? null,
    modifiedBy: json.ModifiedBy ?? null,
    policyNumber: json.PolicyNumber ?? null,
    riskId: json.RiskId ?? null,
  };
}

/** Converts a Rerates CosmosDB document to the canonical schedule. */
function convertRerates(json: RawReratesDocument): PaymentScheduleResponse {
  return {
    id: json.PaymentScheduleId,
    token: json.Token || "",
    hash: json.Hash || "",
    collectionFrequency: String(json.CollectionFrequency || "").toLowerCase(),
    collectionDay: json.CollectionDay,
    inceptionDate: json.InceptionDate,
    coverStartDate: json.CoverStartDate,
    coverEndDate: json.CoverEndDate,
    scheduleItems: (json.Items || []).map(normalizePascalItem),
    modifiedBy: json.ModifiedBy ?? null,
    policyNumber: json.PolicyNumber ?? null,
    riskId: json.RiskId ?? null,
  };
}

/**
 * Converts the `CurrentSchedule`/`ScheduleItems` embedded in a SEQ-logged Policy Admin
 * request into the canonical PaymentScheduleResponse. Field names match Policy Admin's
 * PascalCase document shape (see `convertPolicyAdmin`) but CollectionFrequency arrives
 * as an integer enum rather than a string label.
 */
function convertSeqCurrentSchedule(
  json: RawSeqSchedule,
): PaymentScheduleResponse {
  return {
    id: json.Id,
    token: json.Token || "",
    hash: json.Hash || "",
    collectionFrequency: normalizeFrequencyLabel(
      json.CollectionFrequency,
    ).toLowerCase(),
    collectionDay: json.CollectionDay,
    inceptionDate: json.InceptionDate,
    coverStartDate: json.CoverStartDate,
    coverEndDate: json.CoverEndDate,
    scheduleItems: (json.ScheduleItems || []).map(normalizePascalItem),
  };
}

/**
 * Derives a best-effort PaymentScheduleInput from an already-computed schedule.
 * Used for Response/Policy Admin/Rerates formats where the original request
 * parameters are not available, so amounts are approximated from the items.
 */
export function deriveInputFromResponse(
  schedule: PaymentScheduleResponse,
): PaymentScheduleInput {
  // The API's calculate request keys each tax rate by the date it takes effect, but a
  // computed ScheduleItem only ever carries the flat, already-resolved amount, so the
  // real effective date isn't recoverable here — approximated with the .NET-style
  // "unspecified date" sentinel used elsewhere in this app (e.g. default scheduleEndDate).
  const taxesAndLevies: Record<string, Record<string, number>> = {};
  for (const [key, amount] of Object.entries(
    schedule.scheduleItems[0]?.taxesAndLevies || {},
  )) {
    taxesAndLevies[key] = { "0001-01-01": Number(amount || 0) };
  }

  return {
    collectionFrequency: normalizeFrequencyLabel(schedule.collectionFrequency),
    scheduleStartDate: schedule.coverStartDate,
    scheduleEndDate: schedule.coverEndDate,
    collectionDay: schedule.collectionDay,
    effectiveDate: schedule.inceptionDate,
    dueDate: schedule.scheduleItems[0]?.dueDate || null,
    netAmount: schedule.scheduleItems.reduce(
      (sum, item) => sum + item.netAmount,
      0,
    ),
    taxesAndLevies,
    adminFees: schedule.scheduleItems.reduce<Record<string, AdminFee>>(
      (fees, item) => {
        for (const [key, value] of Object.entries(item.adminFees || {})) {
          const existing = fees[key] ?? { amountDue: 0, taxAmount: 0 };
          fees[key] = {
            amountDue: existing.amountDue + Number(value.amountDue || 0),
            taxAmount: existing.taxAmount + Number(value.taxAmount || 0),
          };
        }
        return fees;
      },
      {},
    ),
    currentSchedule: schedule,
  };
}

/** Converts canonical admin fees back to the PascalCase CosmosDB shape. */
function toPascalAdminFees(
  fees: Record<string, AdminFee>,
): Record<string, { AmountDue: number; TaxAmount: number }> {
  const result: Record<string, { AmountDue: number; TaxAmount: number }> = {};
  for (const [key, value] of Object.entries(fees || {})) {
    result[key] = { AmountDue: value.amountDue, TaxAmount: value.taxAmount };
  }
  return result;
}

/** Converts a canonical schedule item (and its Basis Item) back to the PascalCase CosmosDB shape. */
function toPascalItem(item: ScheduleItem): PascalScheduleItem {
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
    Succeeded: item.succeeded,
  };
}

/** Capitalizes a lower-cased frequency ("annual" -> "Annual") for CosmosDB documents. */
function toFrequencyLabel(frequency: string): string {
  return frequency
    ? frequency.charAt(0).toUpperCase() + frequency.slice(1).toLowerCase()
    : frequency;
}

/**
 * Re-serializes a normalized PaymentScheduleResponse as a Policy Admin CosmosDB
 * document. Fields that only exist on the original CosmosDB document and aren't
 * tracked on the canonical response (PolicyNumber, RiskId, etc.) are omitted.
 */
export function convertResponseToPolicyAdminDocument(
  schedule: PaymentScheduleResponse,
): object {
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
    SchemaVersion: 0,
  };
}

/**
 * Re-serializes a normalized PaymentScheduleResponse as a Rerates CosmosDB
 * document. Fields only present on the original document (PolicyNumber, BatchId,
 * etc.) are omitted since they aren't tracked on the canonical response.
 */
export function convertResponseToReratesDocument(
  schedule: PaymentScheduleResponse,
): object {
  return {
    PaymentScheduleId: schedule.id,
    Token: schedule.token,
    Hash: schedule.hash,
    CollectionFrequency: toFrequencyLabel(schedule.collectionFrequency),
    CollectionDay: schedule.collectionDay,
    InceptionDate: schedule.inceptionDate,
    CoverStartDate: schedule.coverStartDate,
    CoverEndDate: schedule.coverEndDate,
    Items: schedule.scheduleItems.map(toPascalItem),
  };
}

/**
 * Re-serializes a normalized PaymentScheduleResponse as a Payment Schedule
 * Service Request (amendment), deriving the input parameters from the schedule.
 */
export function convertResponseToRequest(
  schedule: PaymentScheduleResponse,
): PaymentScheduleInput {
  return deriveInputFromResponse(schedule);
}

/**
 * Re-serializes a normalized PaymentScheduleResponse into any of the 4
 * supported JSON shapes, for the "View JSON as..." format picker.
 */
export function convertResponseToFormat(
  schedule: PaymentScheduleResponse,
  format: ScheduleFormat,
): object {
  switch (format) {
    case "policyAdmin":
      return convertResponseToPolicyAdminDocument(schedule);
    case "rerates":
      return convertResponseToReratesDocument(schedule);
    case "request":
      return convertResponseToRequest(schedule);
    case "response":
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
 * shown is the request's embedded `currentSchedule`, if any. The SEQ format is
 * handled the same way, reading Policy Admin's raw PascalCase/integer-enum request log.
 */
export function detectAndNormalizeSchedule(json: unknown): DetectedSchedule {
  const format = detectScheduleFormat(json);

  if (format === "response") {
    const schedule = convertResponse(json as RawResponse);
    return { format, schedule, input: deriveInputFromResponse(schedule) };
  }

  if (format === "policyAdmin") {
    const schedule = convertPolicyAdmin(json as RawPolicyAdminDocument);
    return { format, schedule, input: deriveInputFromResponse(schedule) };
  }

  if (format === "rerates") {
    const schedule = convertRerates(json as RawReratesDocument);
    return { format, schedule, input: deriveInputFromResponse(schedule) };
  }

  if (format === "seq") {
    const seq = json as RawSeqRequest;
    const schedule = seq.CurrentSchedule
      ? convertSeqCurrentSchedule(seq.CurrentSchedule)
      : null;
    const input: PaymentScheduleInput = {
      collectionFrequency: normalizeFrequencyLabel(seq.CollectionFrequency),
      scheduleStartDate: seq.ScheduleStartDate,
      scheduleEndDate: seq.ScheduleEndDate || "0001-01-01",
      collectionDay: seq.CollectionDay ?? null,
      effectiveDate: seq.EffectiveDate,
      dueDate: seq.DueDate || null,
      netAmount: Number(seq.NetAmount || 0),
      taxesAndLevies: normalizeTaxesAndLevies(seq.TaxesAndLevies),
      adminFees: normalizeAdminFees(seq.AdminFees),
      currentSchedule: schedule || undefined,
    };
    return { format, schedule, input };
  }

  // format === 'request'
  const request = json as RawRequest;
  const schedule = request.currentSchedule
    ? convertResponse(request.currentSchedule)
    : null;
  const input: PaymentScheduleInput = {
    collectionFrequency: normalizeFrequencyLabel(request.collectionFrequency),
    scheduleStartDate: request.scheduleStartDate,
    scheduleEndDate: request.scheduleEndDate || "0001-01-01",
    collectionDay: request.collectionDay ?? null,
    effectiveDate: request.effectiveDate,
    dueDate: request.dueDate || null,
    netAmount: Number(request.netAmount || 0),
    taxesAndLevies: normalizeTaxesAndLevies(request.taxesAndLevies),
    adminFees: normalizeAdminFees(request.adminFees),
    currentSchedule: schedule || undefined,
  };
  return { format, schedule, input };
}

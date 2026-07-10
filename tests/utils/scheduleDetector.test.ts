import { describe, it, expect } from 'vitest';
import {
  detectScheduleFormat,
  detectAndNormalizeSchedule,
  deriveInputFromResponse,
  convertResponseToFormat,
  convertResponseToPolicyAdminDocument,
  convertResponseToReratesDocument,
  convertResponseToRequest
} from '../../src/utils/scheduleDetector';
import { SAMPLE_SCHEDULES } from '../../src/constants/sampleSchedules';

function sampleFor(format: string) {
  const sample = SAMPLE_SCHEDULES.find((s) => s.format === format);
  if (!sample) throw new Error(`No sample for format ${format}`);
  return sample.json as any;
}

describe('detectScheduleFormat', () => {
  it('detects a Payment Schedule Service Response', () => {
    expect(detectScheduleFormat(sampleFor('response'))).toBe('response');
  });

  it('detects a Payment Schedule Service Request', () => {
    expect(detectScheduleFormat(sampleFor('request'))).toBe('request');
  });

  it('detects a Policy Admin CosmosDB Document', () => {
    expect(detectScheduleFormat(sampleFor('policyAdmin'))).toBe('policyAdmin');
  });

  it('detects a Rerates CosmosDB Document', () => {
    expect(detectScheduleFormat(sampleFor('rerates'))).toBe('rerates');
  });

  it('accepts a numeric-string netAmount for the request format', () => {
    const request = { ...sampleFor('request'), netAmount: '749.06' };
    expect(detectScheduleFormat(request)).toBe('request');
  });

  it('throws for a non-numeric-string netAmount', () => {
    const request = { ...sampleFor('request'), netAmount: 'not-a-number' };
    expect(() => detectScheduleFormat(request)).toThrow(/Unrecognized JSON format/);
  });

  it('throws for null input', () => {
    expect(() => detectScheduleFormat(null)).toThrow('Input must be a JSON object.');
  });

  it('throws for array input', () => {
    expect(() => detectScheduleFormat([1, 2, 3])).toThrow('Input must be a JSON object.');
  });

  it('throws for an unrecognized shape', () => {
    expect(() => detectScheduleFormat({ foo: 'bar' })).toThrow(/Unrecognized JSON format/);
  });
});

describe('detectAndNormalizeSchedule', () => {
  it('normalizes a Response document', () => {
    const { format, schedule, input } = detectAndNormalizeSchedule(sampleFor('response'));
    expect(format).toBe('response');
    expect(schedule).not.toBeNull();
    expect(schedule!.id).toBe('b679beb3-b37d-42e5-b075-ae0ce2374009');
    expect(schedule!.collectionFrequency).toBe('annual');
    expect(schedule!.scheduleItems).toHaveLength(2);
    expect(schedule!.scheduleItems[0].succeeded).toBe(true);
    expect(input).not.toBeNull();
  });

  it('normalizes a Policy Admin CosmosDB document (PascalCase -> camelCase)', () => {
    const { format, schedule } = detectAndNormalizeSchedule(sampleFor('policyAdmin'));
    expect(format).toBe('policyAdmin');
    expect(schedule!.id).toBe('75360b78-48a4-4244-8a67-30bf6cfd1571');
    expect(schedule!.collectionFrequency).toBe('monthly');
    expect(schedule!.collectionDay).toBe(23);
    expect(schedule!.scheduleItems).toHaveLength(2);
    // Policy Admin sample items have no explicit Succeeded field
    expect(schedule!.scheduleItems[0].succeeded).toBeNull();
    // Second item has an AdminFees.SMD entry
    expect(schedule!.scheduleItems[1].adminFees.SMD).toEqual({ amountDue: 1, taxAmount: 0 });
  });

  it('normalizes a Rerates CosmosDB document (Items -> scheduleItems)', () => {
    const { format, schedule } = detectAndNormalizeSchedule(sampleFor('rerates'));
    expect(format).toBe('rerates');
    expect(schedule!.id).toBe('fd394238-476c-469b-b368-8bab0fcf65ae');
    expect(schedule!.collectionFrequency).toBe('annual');
    expect(schedule!.scheduleItems).toHaveLength(2);
    // Rerates sample items explicitly set Succeeded: null
    expect(schedule!.scheduleItems[0].succeeded).toBeNull();
  });

  it('normalizes a Request with an embedded currentSchedule', () => {
    const { format, schedule, input } = detectAndNormalizeSchedule(sampleFor('request'));
    expect(format).toBe('request');
    expect(schedule).not.toBeNull();
    expect(schedule!.id).toBe('b679beb3-b37d-42e5-b075-ae0ce2374009');
    expect(input).not.toBeNull();
    expect(input!.collectionFrequency).toBe('Annual');
    expect(input!.netAmount).toBe(749.06);
    expect(input!.currentSchedule).toBe(schedule);
  });

  it('normalizes a Request without a currentSchedule', () => {
    const request = sampleFor('request');
    const { currentSchedule, ...withoutCurrentSchedule } = request;
    const { format, schedule, input } = detectAndNormalizeSchedule(withoutCurrentSchedule);
    expect(format).toBe('request');
    expect(schedule).toBeNull();
    expect(input).not.toBeNull();
    expect(input!.netAmount).toBe(749.06);
    expect(input!.currentSchedule).toBeUndefined();
  });

  it('coerces a numeric-string netAmount on a Request', () => {
    const request = { ...sampleFor('request'), netAmount: '749.06' };
    delete request.currentSchedule;
    const { input } = detectAndNormalizeSchedule(request);
    expect(input!.netAmount).toBe(749.06);
  });
});

describe('deriveInputFromResponse', () => {
  it('derives approximate input parameters from a computed schedule', () => {
    const { schedule } = detectAndNormalizeSchedule(sampleFor('response'));
    const input = deriveInputFromResponse(schedule!);

    expect(input.collectionFrequency).toBe('Annual');
    expect(input.scheduleStartDate).toBe(schedule!.coverStartDate);
    expect(input.dueDate).toBe(schedule!.scheduleItems[0].dueDate);
    // netAmount is approximated as the sum of item net amounts
    const expectedNet = schedule!.scheduleItems.reduce((sum, item) => sum + item.netAmount, 0);
    expect(input.netAmount).toBeCloseTo(expectedNet, 5);
    expect(input.currentSchedule).toBe(schedule);
  });

  it('normalizes Monthly frequency casing', () => {
    const { schedule } = detectAndNormalizeSchedule(sampleFor('policyAdmin'));
    const input = deriveInputFromResponse(schedule!);
    expect(input.collectionFrequency).toBe('Monthly');
  });
});

describe('reverse converters (View JSON as...)', () => {
  const { schedule } = detectAndNormalizeSchedule(sampleFor('response'));

  it('convertResponseToPolicyAdminDocument produces PascalCase fields with ScheduleItems', () => {
    const doc = convertResponseToPolicyAdminDocument(schedule!) as any;
    expect(doc.PaymentScheduleId).toBe(schedule!.id);
    expect(doc.CollectionFrequency).toBe('Annual');
    expect(Array.isArray(doc.ScheduleItems)).toBe(true);
    expect(doc.ScheduleItems).toHaveLength(schedule!.scheduleItems.length);
    expect(doc.ScheduleItems[0].Id).toBe(schedule!.scheduleItems[0].id);
    expect(doc.ScheduleItems[0].AmountDue).toBe(schedule!.scheduleItems[0].amountDue);
    expect(doc.Items).toBeUndefined();
  });

  it('convertResponseToReratesDocument produces PascalCase fields with Items', () => {
    const doc = convertResponseToReratesDocument(schedule!) as any;
    expect(doc.PaymentScheduleId).toBe(schedule!.id);
    expect(Array.isArray(doc.Items)).toBe(true);
    expect(doc.Items).toHaveLength(schedule!.scheduleItems.length);
    expect(doc.Items[0].Id).toBe(schedule!.scheduleItems[0].id);
    expect(doc.ScheduleItems).toBeUndefined();
  });

  it('convertResponseToRequest derives a PaymentScheduleInput from the schedule', () => {
    const request = convertResponseToRequest(schedule!);
    expect(request.collectionFrequency).toBe('Annual');
    expect(request.scheduleStartDate).toBe(schedule!.coverStartDate);
    expect(request.currentSchedule).toBe(schedule);
  });

  it('convertResponseToFormat dispatches to the right converter for each format', () => {
    expect(convertResponseToFormat(schedule!, 'response')).toBe(schedule);
    expect((convertResponseToFormat(schedule!, 'policyAdmin') as any).ScheduleItems).toBeDefined();
    expect((convertResponseToFormat(schedule!, 'rerates') as any).Items).toBeDefined();
    expect((convertResponseToFormat(schedule!, 'request') as any).scheduleStartDate).toBeDefined();
  });

  it('round-trips a Policy Admin document through convert -> detect -> normalize', () => {
    const doc = convertResponseToPolicyAdminDocument(schedule!);
    const redetected = detectAndNormalizeSchedule(doc);
    expect(redetected.format).toBe('policyAdmin');
    expect(redetected.schedule!.id).toBe(schedule!.id);
    expect(redetected.schedule!.scheduleItems).toHaveLength(schedule!.scheduleItems.length);
    expect(redetected.schedule!.scheduleItems[0].amountDue).toBe(schedule!.scheduleItems[0].amountDue);
  });

  it('round-trips a Rerates document through convert -> detect -> normalize', () => {
    const doc = convertResponseToReratesDocument(schedule!);
    const redetected = detectAndNormalizeSchedule(doc);
    expect(redetected.format).toBe('rerates');
    expect(redetected.schedule!.id).toBe(schedule!.id);
    expect(redetected.schedule!.scheduleItems).toHaveLength(schedule!.scheduleItems.length);
  });
});

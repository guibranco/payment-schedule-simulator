import { ScheduleFormat } from '../utils/scheduleDetector';

export interface SampleSchedule {
  format: ScheduleFormat;
  label: string;
  json: object;
}

// Anonymized examples of the 4 supported JSON shapes. Real policy numbers, emails,
// tokens, and CosmosDB resource identifiers have been replaced with placeholders.
export const SAMPLE_SCHEDULES: SampleSchedule[] = [
  {
    format: 'response',
    label: 'Payment Schedule Service Response',
    json: {
      id: 'b679beb3-b37d-42e5-b075-ae0ce2374009',
      token: 'SAMPLE_TOKEN_PLACEHOLDER=',
      hash: 'SAMPLE_HASH_PLACEHOLDER=',
      collectionFrequency: 'annual',
      collectionDay: null,
      inceptionDate: '2026-07-09',
      coverStartDate: '2026-07-09',
      coverEndDate: '2027-07-08',
      scheduleItems: [
        {
          id: '2720b62f-528a-436d-bad6-f0e52015ae55',
          collectionType: 'full',
          periodStartDate: '2026-07-09',
          periodEndDate: '2027-07-08',
          adjustmentDate: '0001-01-01T00:00:00+00:00',
          dueDate: '2026-07-02',
          amountDue: 620.93,
          netAmount: 597.05,
          taxesAndLevies: { LVY: 17.91, ICF: 5.97 },
          adminFees: {},
          originalItem: null,
          collectionItemCreatedDate: '2026-06-30T11:00:40.6702155+00:00',
          succeeded: true
        },
        {
          id: '37d1ecd2-b151-427b-988a-0509e0d1d125',
          collectionType: 'full',
          periodStartDate: '2026-07-02',
          periodEndDate: '2027-07-08',
          adjustmentDate: '2026-06-30T11:00:21.6271247+00:00',
          dueDate: '2026-07-02',
          amountDue: 1,
          netAmount: 1,
          taxesAndLevies: { SMD: 0 },
          adminFees: { SMD: { amountDue: 1, taxAmount: 0 } },
          originalItem: null,
          collectionItemCreatedDate: '2026-06-30T11:00:40.6705475+00:00',
          succeeded: true
        }
      ]
    }
  },
  {
    format: 'request',
    label: 'Payment Schedule Service Request',
    json: {
      collectionFrequency: 'annual',
      scheduleStartDate: '2026-07-09',
      scheduleEndDate: '0001-01-01',
      collectionDay: null,
      effectiveDate: '2026-07-10',
      dueDate: '0001-01-01',
      netAmount: 749.06,
      taxesAndLevies: { LVY: { '2024-01-01': 22.47 }, ICF: { '2026-01-01': 7.49 } },
      adminFees: {},
      currentSchedule: {
        id: 'b679beb3-b37d-42e5-b075-ae0ce2374009',
        token: 'SAMPLE_TOKEN_PLACEHOLDER=',
        hash: 'SAMPLE_HASH_PLACEHOLDER=',
        collectionFrequency: 'annual',
        collectionDay: 0,
        inceptionDate: '2026-07-09',
        coverStartDate: '2026-07-09',
        coverEndDate: '2027-07-08',
        scheduleItems: [
          {
            id: '2720b62f-528a-436d-bad6-f0e52015ae55',
            collectionType: 'full',
            periodStartDate: '2026-07-09',
            periodEndDate: '2027-07-08',
            adjustmentDate: '0001-01-01T00:00:00+00:00',
            dueDate: '2026-07-02',
            amountDue: 620.93,
            netAmount: 597.05,
            taxesAndLevies: { LVY: 17.91, ICF: 5.97 },
            adminFees: {},
            originalItem: null,
            collectionItemCreatedDate: '2026-06-30T11:00:40.6702155+00:00',
            succeeded: true
          }
        ]
      }
    }
  },
  {
    format: 'policyAdmin',
    label: 'Policy Admin CosmosDB Document',
    json: {
      $type: 'Stratos.Core.PolicyAdmin.CosmosDB.Documents.PaymentSchedules.PaymentScheduleCoreDocument, Stratos.Core.CosmosDB',
      PolicyNumber: 'POL0000001',
      RiskId: 1,
      RiskStatus: 'AC',
      RiskCode: 'VEH',
      RiskMajorVersion: 8,
      RiskTotalAnnualisedPremium: 469.35,
      RiskPaymentMethodId: 1,
      RiskVersion: { Major: 8, Minor: 0, VersionType: 'Live' },
      PaymentScheduleId: '75360b78-48a4-4244-8a67-30bf6cfd1571',
      IsLatest: true,
      Token: 'SAMPLE_TOKEN_PLACEHOLDER=',
      Hash: 'SAMPLE_HASH_PLACEHOLDER=',
      CollectionFrequency: 'Monthly',
      CollectionDay: 23,
      InceptionDate: '2025-11-23',
      CoverStartDate: '2025-11-23',
      CoverEndDate: '2026-11-22',
      ScheduleItems: [
        {
          Id: 'b056db41-31ad-4618-beb4-db7a5f304269',
          CollectionType: 'Full',
          PeriodStartDate: '2025-11-23',
          PeriodEndDate: '2026-01-22',
          AdjustmentDate: '0001-01-01T00:00:00+00:00',
          DueDate: '2025-11-19',
          AmountDue: 82.12,
          NetAmount: 78.25,
          TaxesAndLevies: { LVY: 2.28, ICF: 1.59 },
          AdminFees: {},
          OriginalItem: null,
          CollectionItemCreatedDate: '2025-11-19T11:27:54.9139578+00:00'
        },
        {
          Id: '8399cbed-36ff-4265-90aa-548c3277150a',
          CollectionType: 'Full',
          PeriodStartDate: '2025-11-19',
          PeriodEndDate: '2026-01-22',
          AdjustmentDate: '2025-11-19T11:27:51.8499518+00:00',
          DueDate: '2025-11-19',
          AmountDue: 1,
          NetAmount: 1,
          TaxesAndLevies: { SMD: 0 },
          AdminFees: { SMD: { AmountDue: 1, TaxAmount: 0 } },
          OriginalItem: null,
          CollectionItemCreatedDate: '2025-11-19T11:27:54.9139578+00:00'
        }
      ],
      CreatedDate: '2026-07-09T15:05:54.0397117+00:00',
      ModifiedDate: '2026-07-09T15:05:54.0397494+00:00',
      SchemaVersion: 0,
      SchemaMigrationLog: [],
      id: 'Risk-1*8.0-Schedule',
      _etag: '"00000000-0000-0000-0000-000000000000"',
      CreatedBy: 'user@example.com',
      ModifiedBy: 'user@example.com',
      _rid: 'SAMPLE_RID_PLACEHOLDER==',
      _self: 'dbs/SAMPLE/colls/SAMPLE/docs/SAMPLE/',
      _attachments: 'attachments/',
      _ts: 1783609554
    }
  },
  {
    format: 'rerates',
    label: 'Rerates CosmosDB Document',
    json: {
      PolicyNumber: 'POL0000002',
      RiskId: 1,
      RiskCode: 'VEH',
      RiskMajorVersion: 6,
      BatchId: '2026-07-BATCH-001',
      BatchItemId: '2026-07-BATCH-001-POL0000002-1',
      PaymentScheduleId: 'fd394238-476c-469b-b368-8bab0fcf65ae',
      Token: 'SAMPLE_TOKEN_PLACEHOLDER=',
      Hash: 'SAMPLE_HASH_PLACEHOLDER=',
      CollectionFrequency: 'Annual',
      CollectionDay: null,
      InceptionDate: '2026-07-13',
      CoverStartDate: '2026-07-13',
      CoverEndDate: '2027-07-12',
      ScheduledCollectionAttempts: 0,
      AllowScheduledCollection: false,
      Items: [
        {
          Id: 'dc695994-d2c0-4ba8-abd3-45deac289989',
          CollectionType: 'Full',
          PeriodStartDate: '2026-07-13',
          PeriodEndDate: '2027-07-12',
          AdjustmentDate: '0001-01-01T00:00:00+00:00',
          DueDate: '2026-07-09',
          AmountDue: 485.6,
          NetAmount: 466.92,
          TaxesAndLevies: { LVY: 14.01, ICF: 4.67 },
          AdminFees: {},
          CollectionItemCreatedDate: null,
          Succeeded: null
        },
        {
          Id: '76366e71-4e2d-4135-988b-a7e8e38a8d8f',
          CollectionType: 'Full',
          PeriodStartDate: '2026-07-09',
          PeriodEndDate: '2027-07-12',
          AdjustmentDate: '2026-07-09T12:43:36.157396+00:00',
          DueDate: '2026-07-09',
          AmountDue: 1,
          NetAmount: 1,
          TaxesAndLevies: { SMD: 0 },
          AdminFees: { SMD: { AmountDue: 1, TaxAmount: 0 } },
          CollectionItemCreatedDate: null,
          Succeeded: null
        }
      ],
      id: 'PaymentSchedule',
      _etag: '"00000000-0000-0000-0000-000000000000"',
      CreatedBy: 'user@example.com',
      CreatedDate: '2026-07-09T12:40:57.2810369+00:00',
      ModifiedBy: 'user@example.com',
      ModifiedDate: '2026-07-09T12:43:36.158709+00:00',
      _rid: 'SAMPLE_RID_PLACEHOLDER==',
      _self: 'dbs/SAMPLE/colls/SAMPLE/docs/SAMPLE/',
      _attachments: 'attachments/',
      _ts: 1783601016
    }
  }
];

export const PLACEHOLDER_SAMPLE_JSON = JSON.stringify(SAMPLE_SCHEDULES[0].json, null, 2);

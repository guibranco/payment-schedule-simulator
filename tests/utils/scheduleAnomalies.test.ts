import { describe, it, expect } from "vitest";
import { detectScheduleAnomalies } from "../../src/utils/scheduleAnomalies";
import { detectAndNormalizeSchedule } from "../../src/utils/scheduleDetector";
import type { PaymentScheduleResponse, ScheduleItem } from "../../src/types";
import { must } from "../helpers";

// A real Policy Admin document (identifiers trimmed): an Annual schedule after a Surgery, with a
// Full Item for the running + Buffer Period, its Stamp Duty, and a Pro-Rata Item collecting the
// rest of the annual Basis Item (369.58 - 69.64 = 299.94). It has no anomalies.
const policyAdminDocument = {
  PolicyNumber: "OUT00255306",
  RiskStatus: "AC",
  RiskTotalAnnualisedPremium: 355.36317655703,
  PaymentScheduleId: "30463820-124e-4edb-8c3f-5e999146f283",
  CollectionFrequency: "Annual",
  CollectionDay: 1,
  InceptionDate: "2026-10-03",
  CoverStartDate: "2026-10-03",
  CoverEndDate: "2027-10-02",
  ScheduleItems: [
    {
      Id: "full",
      CollectionType: "Full",
      PeriodStartDate: "2026-10-03",
      PeriodEndDate: "2026-12-02",
      AdjustmentDate: "0001-01-01T00:00:00+00:00",
      DueDate: "2026-10-01",
      AmountDue: 69.64,
      NetAmount: 66.97,
      TaxesAndLevies: { LVY: 1.95, ICF: 0.72 },
      AdminFees: {},
      OriginalItem: null,
    },
    {
      Id: "stamp-duty",
      CollectionType: "Full",
      PeriodStartDate: "2026-10-01",
      PeriodEndDate: "2026-12-02",
      AdjustmentDate: "2026-10-01T16:23:38.7207188+00:00",
      DueDate: "2026-10-01",
      AmountDue: 1,
      NetAmount: 1,
      TaxesAndLevies: { SMD: 0 },
      AdminFees: { SMD: { AmountDue: 1, TaxAmount: 0 } },
      OriginalItem: null,
    },
    {
      Id: "pro-rata",
      CollectionType: "ProRata",
      PeriodStartDate: "2026-12-03",
      PeriodEndDate: "2027-10-02",
      AdjustmentDate: "2026-10-02T08:08:43.4711536+00:00",
      DueDate: "2026-10-05",
      AmountDue: 299.94,
      NetAmount: 288.39,
      TaxesAndLevies: { LVY: 8.72, ICF: 2.83 },
      AdminFees: {},
      OriginalItem: {
        Id: "basis",
        CollectionType: "Full",
        PeriodStartDate: "2026-10-03",
        PeriodEndDate: "2027-10-02",
        AdjustmentDate: "0001-01-01T00:00:00+00:00",
        DueDate: "2026-10-10",
        AmountDue: 369.58,
        NetAmount: 355.36,
        TaxesAndLevies: { LVY: 10.67, ICF: 3.55 },
        AdminFees: {},
        OriginalItem: null,
      },
    },
  ],
  SchemaVersion: 0,
  CreatedBy: "RERATE",
  ModifiedBy: "RERATE",
};

const baseSchedule = must(
  detectAndNormalizeSchedule(policyAdminDocument).schedule,
);
const [fullItem, stampDutyItem, proRataItem] = baseSchedule.scheduleItems;

function withItems(
  scheduleItems: ScheduleItem[],
  overrides: Partial<PaymentScheduleResponse> = {},
): PaymentScheduleResponse {
  return { ...baseSchedule, scheduleItems, ...overrides };
}

function kinds(schedule: PaymentScheduleResponse): string[] {
  return detectScheduleAnomalies(schedule).map((anomaly) => anomaly.kind);
}

function stampDuty(
  amount: number,
  adjustmentDate: string | null,
  id = `smd-${adjustmentDate}`,
): ScheduleItem {
  return {
    ...stampDutyItem,
    id,
    adjustmentDate,
    amountDue: amount,
    netAmount: amount,
    adminFees: { SMD: { amountDue: amount, taxAmount: 0 } },
  };
}

describe("detectScheduleAnomalies", () => {
  it("finds no anomalies on a consistent schedule", () => {
    expect(detectScheduleAnomalies(baseSchedule)).toEqual([]);
  });

  it("returns nothing for a missing schedule", () => {
    expect(detectScheduleAnomalies(null)).toEqual([]);
  });

  describe("Orphaned Pro-Rata Item", () => {
    it("flags a Pro-Rata Item without a Basis Item, recognising PascalCase collection types", () => {
      const anomalies = detectScheduleAnomalies(
        withItems([
          fullItem,
          stampDutyItem,
          { ...proRataItem, originalItem: null },
        ]),
      );

      expect(anomalies.map((a) => a.kind)).toEqual(["orphanedProRataItem"]);
      expect(anomalies[0]).toMatchObject({
        severity: "warning",
        itemIndexes: [2],
      });
      expect(anomalies[0].message).toContain(
        "Pro-Rata Item #2 has no Basis Item",
      );
    });
  });

  describe("Nested Basis Item", () => {
    it("flags a Basis Item that has a Basis Item of its own", () => {
      const nested = {
        ...proRataItem,
        originalItem: {
          ...must(proRataItem.originalItem),
          originalItem: fullItem,
        },
      };
      expect(kinds(withItems([fullItem, stampDutyItem, nested]))).toContain(
        "nestedBasisItem",
      );
    });
  });

  describe("Pro-Rata amount", () => {
    it("flags a Pro-Rata amount that differs from the Basis Item minus the Full Items already due", () => {
      const anomalies = detectScheduleAnomalies(
        withItems([
          fullItem,
          stampDutyItem,
          { ...proRataItem, amountDue: 250 },
        ]),
      );

      expect(anomalies.map((a) => a.kind)).toEqual(["proRataAmountMismatch"]);
      expect(anomalies[0].message).toContain("€250.00");
      expect(anomalies[0].message).toContain("€299.94");
    });

    it("allows the Rounding Remainder when the first Full Item is involved", () => {
      expect(
        kinds(
          withItems([
            fullItem,
            stampDutyItem,
            { ...proRataItem, amountDue: 299.94 + 0.11 },
          ]),
        ),
      ).toEqual([]);
    });

    it("reports scenarios it can't check as one Unverified Pro-Rata Amount entry", () => {
      const unsupported = { ...proRataItem, periodEndDate: "2027-06-02" };
      const anomalies = detectScheduleAnomalies(
        withItems([
          fullItem,
          stampDutyItem,
          unsupported,
          { ...unsupported, id: "second" },
        ]),
      );

      expect(anomalies.map((a) => a.kind)).toEqual(["unverifiedProRataAmount"]);
      expect(anomalies[0]).toMatchObject({
        severity: "info",
        itemIndexes: [2, 3],
      });
    });
  });

  describe("Stamp Duty", () => {
    it("flags a live schedule with no Stamp Duty", () => {
      expect(kinds(withItems([fullItem, proRataItem]))).toEqual([
        "stampDutyImbalance",
      ]);
    });

    it("flags a second Stamp Duty charge that wasn't preceded by a refund", () => {
      const anomalies = detectScheduleAnomalies(
        withItems([
          fullItem,
          stampDutyItem,
          proRataItem,
          stampDuty(1, "2026-11-01T00:00:00+00:00"),
        ]),
      );
      expect(anomalies.map((a) => a.kind)).toEqual(["stampDutyImbalance"]);
      expect(anomalies[0].itemIndexes).toEqual([3]);
    });

    it("accepts a charge, refund and re-charge (reinstatement)", () => {
      expect(
        kinds(
          withItems([
            fullItem,
            stampDutyItem,
            proRataItem,
            stampDuty(-1, "2026-10-02T09:00:00+00:00"),
            stampDuty(1, "2026-10-03T09:00:00+00:00"),
          ]),
        ),
      ).toEqual([]);
    });

    it("accepts a Void that nets everything, Stamp Duty included, to zero", () => {
      const refund = {
        ...fullItem,
        id: "refund",
        amountDue: -fullItem.amountDue,
        adjustmentDate: "2026-10-02T09:00:00+00:00",
      };
      expect(
        kinds(
          withItems(
            [
              fullItem,
              refund,
              stampDutyItem,
              stampDuty(-1, "2026-10-02T09:00:00+00:00"),
            ],
            {
              riskStatus: "CX",
              coverEndDate: "2026-10-03",
            },
          ),
        ),
      ).toEqual([]);
    });

    it("flags a live (AC) schedule whose Stamp Duty was refunded", () => {
      expect(
        kinds(
          withItems([
            fullItem,
            stampDutyItem,
            proRataItem,
            stampDuty(-1, "2026-10-05T09:00:00+00:00"),
          ]),
        ),
      ).toEqual(["stampDutyImbalance"]);
    });

    it("notes a Stamp Duty charge other than the fixed €1", () => {
      const anomalies = detectScheduleAnomalies(
        withItems([
          fullItem,
          stampDuty(2, stampDutyItem.adjustmentDate),
          proRataItem,
        ]),
      );
      expect(anomalies.map((a) => a.kind)).toEqual([
        "unexpectedStampDutyAmount",
      ]);
      expect(anomalies[0].severity).toBe("info");
    });
  });

  describe("Annual Premium Mismatch", () => {
    const annualFullItem = {
      ...fullItem,
      periodEndDate: "2027-10-02",
      netAmount: 355.36,
      amountDue: 369.58,
    };

    it("flags a full-period Full Item whose net amount isn't the Annualised Premium", () => {
      const anomalies = detectScheduleAnomalies(
        withItems([{ ...annualFullItem, netAmount: 66.97 }, stampDutyItem]),
      );
      expect(anomalies.map((a) => a.kind)).toEqual(["annualPremiumMismatch"]);
      expect(anomalies[0].message).toContain("€355.36");
    });

    it("accepts a matching net amount", () => {
      expect(kinds(withItems([annualFullItem, stampDutyItem]))).toEqual([]);
    });

    it("skips schedules with Pro-Rata Items, whose Annualised Premium is already the post-MTA one", () => {
      expect(
        kinds(
          withItems([
            { ...annualFullItem, netAmount: 66.97 },
            stampDutyItem,
            proRataItem,
          ]),
        ),
      ).not.toContain("annualPremiumMismatch");
    });

    it("skips formats without an Annualised Premium", () => {
      expect(
        kinds(
          withItems([{ ...annualFullItem, netAmount: 66.97 }, stampDutyItem], {
            annualisedPremium: null,
          }),
        ),
      ).toEqual([]);
    });
  });

  describe("admin fees", () => {
    function withFee(code: string, amount: number): ScheduleItem {
      return {
        ...stampDutyItem,
        id: code,
        adminFees: { [code]: { amountDue: amount, taxAmount: 0 } },
      };
    }

    it("flags any Collection Fee, even at zero", () => {
      expect(
        kinds(
          withItems([fullItem, stampDutyItem, proRataItem, withFee("CLF", 0)]),
        ),
      ).toEqual(["collectionFeeCharged"]);
    });

    it("flags a non-zero Cancellation Fee when cover ends after 30/06/2026", () => {
      expect(
        kinds(
          withItems([fullItem, stampDutyItem, proRataItem, withFee("CAN", 40)]),
        ),
      ).toEqual(["prohibitedCancellationFee"]);
    });

    it("allows a zero Cancellation Fee, or one on cover ending by 30/06/2026", () => {
      expect(
        kinds(
          withItems([fullItem, stampDutyItem, proRataItem, withFee("CAN", 0)]),
        ),
      ).toEqual([]);
      expect(
        kinds(
          withItems(
            [fullItem, stampDutyItem, proRataItem, withFee("CAN", 40)],
            { coverEndDate: "2026-06-30" },
          ),
        ),
      ).not.toContain("prohibitedCancellationFee");
    });
  });

  describe("Surgery Detected", () => {
    it("notes a schedule last modified by a person", () => {
      const anomalies = detectScheduleAnomalies({
        ...baseSchedule,
        modifiedBy: "someone@example.com",
      });
      expect(anomalies.map((a) => a.kind)).toEqual(["surgeryDetected"]);
      expect(anomalies[0].message).toContain("someone@example.com");
    });

    it("ignores system accounts", () => {
      expect(kinds({ ...baseSchedule, modifiedBy: "SYSTEM" })).toEqual([]);
    });
  });

  it("lists warnings before info", () => {
    const anomalies = detectScheduleAnomalies(
      withItems([fullItem, proRataItem], { modifiedBy: "someone@example.com" }),
    );
    expect(anomalies.map((a) => a.severity)).toEqual(["warning", "info"]);
  });
});

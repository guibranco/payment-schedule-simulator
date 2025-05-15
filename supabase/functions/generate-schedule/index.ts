import { PaymentScheduleInput, PaymentScheduleResponse } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function generateUUID(): string {
  return crypto.randomUUID();
}

function generateToken(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return btoa(String.fromCharCode(...buffer));
}

function generateHash(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return btoa(String.fromCharCode(...buffer));
}

function generateSchedule(input: PaymentScheduleInput): PaymentScheduleResponse {
  try {
    const isAnnual = input.collectionFrequency.toLowerCase() === 'annual';
    const startDate = new Date(input.scheduleStartDate);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    endDate.setDate(endDate.getDate() - 1);

    // Calculate total taxes
    const totalTaxes = Object.values(input.taxesAndLevies).reduce((sum, tax) => sum + tax, 0);
    
    // Calculate total admin fees
    const totalAdminFees = Object.entries(input.adminFees).reduce((sum, [_, fee]) => {
      return sum + fee.amountDue + fee.taxAmount;
    }, 0);

    const scheduleItems = [];

    // For annual frequency, create one main payment item
    if (isAnnual) {
      scheduleItems.push({
        id: generateUUID(),
        collectionType: "full",
        periodStartDate: input.scheduleStartDate,
        periodEndDate: endDate.toISOString().split('T')[0],
        adjustmentDate: "0001-01-01T00:00:00+00:00",
        dueDate: input.dueDate || input.effectiveDate,
        amountDue: input.netAmount + totalTaxes,
        netAmount: input.netAmount,
        taxesAndLevies: input.taxesAndLevies,
        adminFees: {}
      });

      // Add admin fees as a separate item if present
      if (totalAdminFees > 0) {
        scheduleItems.push({
          id: generateUUID(),
          collectionType: "full",
          periodStartDate: input.effectiveDate,
          periodEndDate: endDate.toISOString().split('T')[0],
          adjustmentDate: new Date().toISOString(),
          dueDate: input.dueDate || input.effectiveDate,
          amountDue: totalAdminFees,
          netAmount: totalAdminFees,
          taxesAndLevies: {},
          adminFees: input.adminFees
        });
      }
    } else {
      // Monthly frequency
      const monthlyNetAmount = input.netAmount / 12;
      const monthlyTaxes: Record<string, number> = {};
      Object.entries(input.taxesAndLevies).forEach(([key, value]) => {
        monthlyTaxes[key] = value / 12;
      });

      // Generate 12 monthly items
      for (let i = 0; i < 12; i++) {
        const periodStart = new Date(startDate);
        periodStart.setMonth(periodStart.getMonth() + i);
        
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(periodEnd.getDate() - 1);

        const dueDate = new Date(periodStart);
        dueDate.setDate(input.collectionDay || 1);
        if (dueDate < new Date(input.effectiveDate)) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }

        scheduleItems.push({
          id: generateUUID(),
          collectionType: "full",
          periodStartDate: periodStart.toISOString().split('T')[0],
          periodEndDate: periodEnd.toISOString().split('T')[0],
          adjustmentDate: "0001-01-01T00:00:00+00:00",
          dueDate: dueDate.toISOString().split('T')[0],
          amountDue: monthlyNetAmount + Object.values(monthlyTaxes).reduce((sum, tax) => sum + tax, 0),
          netAmount: monthlyNetAmount,
          taxesAndLevies: monthlyTaxes,
          adminFees: {}
        });
      }

      // Add admin fees as a separate item if present
      if (totalAdminFees > 0) {
        scheduleItems.push({
          id: generateUUID(),
          collectionType: "full",
          periodStartDate: input.effectiveDate,
          periodEndDate: endDate.toISOString().split('T')[0],
          adjustmentDate: new Date().toISOString(),
          dueDate: input.dueDate || input.effectiveDate,
          amountDue: totalAdminFees,
          netAmount: totalAdminFees,
          taxesAndLevies: {},
          adminFees: input.adminFees
        });
      }
    }

    return {
      id: generateUUID(),
      token: generateToken(),
      hash: generateHash(),
      collectionFrequency: input.collectionFrequency.toLowerCase(),
      collectionDay: input.collectionDay || 1,
      inceptionDate: input.effectiveDate,
      coverStartDate: input.scheduleStartDate,
      coverEndDate: endDate.toISOString().split('T')[0],
      scheduleItems
    };
  } catch (error) {
    throw new Error(`Failed to generate schedule: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: PaymentScheduleInput = await req.json();
    const schedule = generateSchedule(input);

    return new Response(
      JSON.stringify(schedule),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  } catch (error) {
    console.error('Error in generate-schedule function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred while generating the schedule' 
      }), 
      { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});
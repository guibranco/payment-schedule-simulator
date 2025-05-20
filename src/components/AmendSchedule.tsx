import React, { useState } from 'react';
import { FileUp, Calendar, ArrowRight, Clipboard } from 'lucide-react';
import { PaymentScheduleInput, PaymentScheduleResponse } from '../types';
import NewSchedule from './NewSchedule';
import ScheduleDisplay from './ScheduleDisplay';

interface Props {
  apiEndpoint: string;
}

export default function AmendSchedule({ apiEndpoint }: Props) {
  const [existingSchedule, setExistingSchedule] = useState<PaymentScheduleResponse | null>(null);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [showPasteInput, setShowPasteInput] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        validateAndSetSchedule(json);
      } catch (err) {
        setError('Invalid JSON syntax. Please check for missing commas, quotes, or brackets.');
      }
    };
    reader.readAsText(file);
  };

  const normalizeKeys = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(normalizeKeys);
    }
    if (obj !== null && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
          key.toLowerCase(),
          normalizeKeys(value)
        ])
      );
    }
    return obj;
  };

  const validateAndSetSchedule = (json: any) => {
    // Normalize all keys to lowercase for case-insensitive comparison
    const normalizedJson = normalizeKeys(json);

    const requiredFields = {
      id: 'string',
      collectionfrequency: 'string',
      scheduleitems: 'array',
      coverstartdate: 'string',
      coverenddate: 'string',
      inceptiondate: 'string'
    };

    // Check for missing required fields
    for (const [field, type] of Object.entries(requiredFields)) {
      if (!normalizedJson[field]) {
        throw new Error(`Missing required field: ${field}`);
      }

      // Type validation
      if (type === 'array' && !Array.isArray(normalizedJson[field])) {
        throw new Error(`${field} must be an array`);
      } else if (type !== 'array' && typeof normalizedJson[field] !== type) {
        throw new Error(`${field} must be a ${type}`);
      }
    }

    // Validate collection day based on frequency
    const frequency = normalizedJson.collectionfrequency.toLowerCase();
    if (frequency === 'monthly' && (!normalizedJson.collectionday || typeof normalizedJson.collectionday !== 'number')) {
      throw new Error('Monthly schedules must have a valid collection day (1-31)');
    }

    // Validate schedule items
    if (normalizedJson.scheduleitems.length === 0) {
      throw new Error('Schedule must contain at least one item');
    }

    for (const [index, item] of normalizedJson.scheduleitems.entries()) {
      if (!item.id) {
        throw new Error(`Schedule item at index ${index} is missing an id`);
      }
      if (!item.duedate) {
        throw new Error(`Schedule item at index ${index} is missing a due date`);
      }
      if (typeof item.netamount !== 'number') {
        throw new Error(`Schedule item at index ${index} has invalid net amount`);
      }
      if (typeof item.amountdue !== 'number') {
        throw new Error(`Schedule item at index ${index} has invalid amount due`);
      }
      if (!item.periodstartdate || !item.periodenddate) {
        throw new Error(`Schedule item at index ${index} is missing period dates`);
      }
    }

    // Convert back to original case for the application
    const schedule: PaymentScheduleResponse = {
      id: json.id || json.Id || json.ID,
      token: json.token || json.Token || '',
      hash: json.hash || json.Hash || '',
      collectionFrequency: json.collectionFrequency || json.CollectionFrequency,
      collectionDay: frequency === 'annual' ? (json.collectionDay || json.CollectionDay || 0) : (json.collectionDay || json.CollectionDay),
      inceptionDate: json.inceptionDate || json.InceptionDate,
      coverStartDate: json.coverStartDate || json.CoverStartDate,
      coverEndDate: json.coverEndDate || json.CoverEndDate,
      scheduleItems: (json.scheduleItems || json.ScheduleItems).map((item: any) => ({
        id: item.id || item.Id || item.ID,
        collectionType: item.collectionType || item.CollectionType,
        periodStartDate: item.periodStartDate || item.PeriodStartDate,
        periodEndDate: item.periodEndDate || item.PeriodEndDate,
        adjustmentDate: item.adjustmentDate || item.AdjustmentDate,
        dueDate: item.dueDate || item.DueDate,
        amountDue: Number(item.amountDue || item.AmountDue || 0),
        netAmount: Number(item.netAmount || item.NetAmount || 0),
        taxesAndLevies: item.taxesAndLevies || item.TaxesAndLevies || {},
        adminFees: Object.entries(item.adminFees || item.AdminFees || {}).reduce((acc, [key, value]: [string, any]) => ({
          ...acc,
          [key]: {
            amountDue: Number(value.amountDue || value.AmountDue || 0),
            taxAmount: Number(value.taxAmount || value.TaxAmount || 0)
          }
        }), {})
      }))
    };

    setExistingSchedule(schedule);
    setError(null);
    setShowPasteInput(false);
    setJsonInput('');
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const json = JSON.parse(jsonInput);
      validateAndSetSchedule(json);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON syntax. Please check for missing commas, quotes, or brackets.');
      } else {
        setError(err instanceof Error ? err.message : 'Invalid schedule format');
      }
    }
  };

  if (showNewSchedule && existingSchedule) {
    const initialInput: PaymentScheduleInput = {
      collectionFrequency: existingSchedule.collectionFrequency.charAt(0).toUpperCase() + 
                          existingSchedule.collectionFrequency.slice(1) as 'Monthly' | 'Annual',
      scheduleStartDate: existingSchedule.coverStartDate,
      scheduleEndDate: existingSchedule.coverEndDate,
      collectionDay: existingSchedule.collectionDay,
      effectiveDate: existingSchedule.inceptionDate,
      dueDate: existingSchedule.scheduleItems[0]?.dueDate || null,
      netAmount: existingSchedule.scheduleItems.reduce((sum, item) => sum + item.netAmount, 0),
      taxesAndLevies: existingSchedule.scheduleItems[0]?.taxesAndLevies || {},
      adminFees: existingSchedule.scheduleItems.reduce((fees, item) => ({
        ...fees,
        ...Object.entries(item.adminFees).reduce((acc, [key, value]) => ({
          ...acc,
          [key]: {
            amountDue: Number(value.amountDue || 0),
            taxAmount: Number(value.taxAmount || 0)
          }
        }), {})
      }), {})
    };

    return <NewSchedule initialSchedule={initialInput} apiEndpoint={apiEndpoint} existingSchedule={existingSchedule} />;
  }

  return (
    <div className="max-w-[90rem] mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-primary">
          <Calendar className="w-6 h-6" />
          Amend Payment Schedule
        </h1>

        {!existingSchedule && (
          <div className="space-y-6">
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setShowPasteInput(false)}
                className={`px-6 py-3 rounded-md transition-colors ${
                  !showPasteInput 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileUp className="w-5 h-5" />
                  Upload File
                </div>
              </button>
              <button
                onClick={() => setShowPasteInput(true)}
                className={`px-6 py-3 rounded-md transition-colors ${
                  showPasteInput 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clipboard className="w-5 h-5" />
                  Paste JSON
                </div>
              </button>
            </div>

            {showPasteInput ? (
              <form onSubmit={handlePasteSubmit} className="space-y-4">
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Paste your schedule JSON here..."
                  className="w-full h-64 p-4 border border-gray-300 rounded-md focus:border-primary focus:ring focus:ring-primary"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-secondary text-white rounded-md hover:bg-secondary-dark transition-colors"
                  >
                    Parse JSON
                  </button>
                </div>
              </form>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <FileUp className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Upload existing schedule JSON
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".json"
                      onChange={handleFileUpload}
                    />
                    <span className="mt-2 block text-sm text-gray-600">
                      Click to upload or drag and drop
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {existingSchedule && !showNewSchedule && (
          <div className="space-y-6">
            <div className="bg-primary/10 p-4 rounded-lg">
              <h2 className="text-lg font-semibold text-primary mb-2">Current Schedule</h2>
              <p className="text-gray-700">
                Review the current schedule below before making amendments. Click "Create New Schedule" 
                to start the amendment process with the current values pre-filled.
              </p>
            </div>
            
            <ScheduleDisplay schedule={existingSchedule} />
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowNewSchedule(true)}
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-md hover:bg-secondary-dark transition-colors"
              >
                Create New Schedule
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
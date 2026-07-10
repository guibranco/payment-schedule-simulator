import React, { useState } from 'react';
import { FileUp, Eye, ArrowLeftRight, Info } from 'lucide-react';
import { PaymentScheduleResponse } from '../types';
import { detectAndNormalizeSchedule, FORMAT_LABELS, ScheduleFormat } from '../utils/scheduleDetector';
import { SAMPLE_SCHEDULES, PLACEHOLDER_SAMPLE_JSON } from '../constants/sampleSchedules';
import ScheduleDisplay from './ScheduleDisplay';

interface SlotState {
  schedule: PaymentScheduleResponse | null;
  format: ScheduleFormat | null;
  jsonInput: string;
  selectedExample: string;
  error: string | null;
}

const emptySlot: SlotState = {
  schedule: null,
  format: null,
  jsonInput: '',
  selectedExample: '',
  error: null
};

/**
 * Component to compare two payment schedules by uploading or pasting JSON data.
 *
 * Accepts any of the 4 supported payment schedule JSON shapes (Payment Schedule
 * Service Response/Request, Policy Admin CosmosDB Document, Rerates CosmosDB
 * Document) on either side, auto-detecting which one was provided — the same
 * way the View Schedule page does.
 *
 * @returns A React functional component rendering the comparison interface.
 */
export default function CompareSchedules() {
  const [slot1, setSlot1] = useState<SlotState>(emptySlot);
  const [slot2, setSlot2] = useState<SlotState>(emptySlot);

  const getSlot = (scheduleNumber: 1 | 2) => (scheduleNumber === 1 ? slot1 : slot2);
  const setSlot = (scheduleNumber: 1 | 2) => (scheduleNumber === 1 ? setSlot1 : setSlot2);

  const processJson = (scheduleNumber: 1 | 2, raw: string) => {
    const update = setSlot(scheduleNumber);

    try {
      const json = JSON.parse(raw);
      const detected = detectAndNormalizeSchedule(json);

      if (!detected.schedule) {
        update((prev) => ({
          ...prev,
          schedule: null,
          format: null,
          error: 'This request does not include an embedded currentSchedule, so there is nothing to compare.'
        }));
        return;
      }

      update((prev) => ({
        ...prev,
        schedule: detected.schedule,
        format: detected.format,
        error: null
      }));
    } catch (err) {
      update((prev) => ({
        ...prev,
        schedule: null,
        format: null,
        error:
          err instanceof SyntaxError
            ? 'Invalid JSON syntax. Please check for missing commas, quotes, or brackets.'
            : err instanceof Error
              ? err.message
              : 'Invalid schedule format'
      }));
    }
  };

  const handleJsonSubmit = (scheduleNumber: 1 | 2) => (e: React.FormEvent) => {
    e.preventDefault();
    processJson(scheduleNumber, getSlot(scheduleNumber).jsonInput);
  };

  const clearSchedule = (scheduleNumber: 1 | 2) => {
    setSlot(scheduleNumber)(emptySlot);
  };

  const handleFileUpload = (scheduleNumber: 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const update = setSlot(scheduleNumber);

    if (!file.type.includes('json') && !file.name.endsWith('.json')) {
      update((prev) => ({ ...prev, error: 'Please select a valid JSON file.' }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      update((prev) => ({ ...prev, error: 'File size too large. Please select a file smaller than 10MB.' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      update((prev) => ({ ...prev, jsonInput: content }));
      processJson(scheduleNumber, content);
    };
    reader.onerror = () => {
      update((prev) => ({ ...prev, error: 'Error reading file. Please try again.' }));
    };
    reader.readAsText(file);
  };

  const handleExampleChange = (scheduleNumber: 1 | 2) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const sample = SAMPLE_SCHEDULES.find((s) => s.format === value);
    setSlot(scheduleNumber)((prev) => ({
      ...prev,
      selectedExample: value,
      jsonInput: sample ? JSON.stringify(sample.json, null, 2) : prev.jsonInput
    }));
  };

  /**
   * Renders a schedule input component based on the provided schedule number.
   */
  const renderScheduleInput = (scheduleNumber: 1 | 2) => {
    const { schedule, format, jsonInput, selectedExample, error } = getSlot(scheduleNumber);

    if (schedule) {
      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-primary">Schedule {scheduleNumber}</h3>
              {format && <p className="text-xs text-gray-500">Detected format: {FORMAT_LABELS[format]}</p>}
            </div>
            <button
              onClick={() => clearSchedule(scheduleNumber)}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          </div>
          <ScheduleDisplay schedule={schedule} />
        </div>
      );
    }

    const exampleSelectId = `schedule-${scheduleNumber}-example`;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary">
          Schedule {scheduleNumber}
        </h3>

        <div className="flex gap-4 justify-center">
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors cursor-pointer">
            <FileUp className="w-5 h-5" />
            Upload JSON File
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload(scheduleNumber)}
              className="hidden"
            />
          </label>
        </div>

        <form onSubmit={handleJsonSubmit(scheduleNumber)} className="space-y-4">
          <div>
            <label htmlFor={exampleSelectId} className="block text-sm font-medium text-gray-700 mb-2">
              Load Example
            </label>
            <select
              id={exampleSelectId}
              value={selectedExample}
              onChange={handleExampleChange(scheduleNumber)}
              className="w-full h-11 px-4 border border-gray-300 rounded-md focus:border-primary focus:ring focus:ring-primary/20"
            >
              <option value="">-- Select an example to fill the textarea --</option>
              {SAMPLE_SCHEDULES.map((sample) => (
                <option key={sample.format} value={sample.format}>
                  {sample.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste Schedule {scheduleNumber} JSON
            </label>
            <textarea
              value={jsonInput}
              onChange={(e) => setSlot(scheduleNumber)((prev) => ({ ...prev, jsonInput: e.target.value }))}
              className="w-full h-48 p-4 border border-gray-300 rounded-md focus:border-primary focus:ring focus:ring-primary/20 font-mono text-sm"
              placeholder={PLACEHOLDER_SAMPLE_JSON}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
            >
              Load Schedule {scheduleNumber}
            </button>
          </div>
        </form>
      </div>
    );
  };

  /**
   * Renders a comparison summary of two schedules.
   */
  const renderComparisonSummary = () => {
    const schedule1 = slot1.schedule;
    const schedule2 = slot2.schedule;
    if (!schedule1 || !schedule2) return null;

    const total1 = (schedule1?.scheduleItems || []).reduce((sum, item) => sum + item.amountDue, 0);
    const total2 = (schedule2?.scheduleItems || []).reduce((sum, item) => sum + item.amountDue, 0);
    const difference = total2 - total1;

    const formatDate = (dateString: string) => {
      try {
        return new Date(dateString).toLocaleDateString();
      } catch {
        return 'Invalid date';
      }
    };

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5" />
          Comparison Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-blue-700">Schedule 1 Total</p>
            <p className="text-xl font-bold text-blue-900">€{total1.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-blue-700">Schedule 2 Total</p>
            <p className="text-xl font-bold text-blue-900">€{total2.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-blue-700">Difference</p>
            <p className={`text-xl font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {difference >= 0 ? '+' : ''}€{difference.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-blue-700"><strong>Schedule 1:</strong> {(schedule1?.scheduleItems || []).length} items</p>
            <p className="text-blue-700"><strong>Frequency:</strong> {schedule1.collectionFrequency}</p>
            <p className="text-blue-700">
              <strong>Period:</strong> {formatDate(schedule1.coverStartDate)} - {formatDate(schedule1.coverEndDate)}
            </p>
          </div>
          <div>
            <p className="text-blue-700"><strong>Schedule 2:</strong> {(schedule2?.scheduleItems || []).length} items</p>
            <p className="text-blue-700"><strong>Frequency:</strong> {schedule2.collectionFrequency}</p>
            <p className="text-blue-700">
              <strong>Period:</strong> {formatDate(schedule2.coverStartDate)} - {formatDate(schedule2.coverEndDate)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-screen-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-primary">
          <Eye className="w-6 h-6" />
          Compare Schedules
        </h1>

        <div className="flex gap-3 p-4 mb-6 bg-blue-50 border border-blue-200 rounded-md">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Each side accepts any of these 4 JSON formats — the format is detected automatically:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {Object.values(FORMAT_LABELS).map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        </div>

        {renderComparisonSummary()}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {renderScheduleInput(1)}
          {renderScheduleInput(2)}
        </div>
      </div>
    </div>
  );
}

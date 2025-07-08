import React, { useState } from 'react';
import { FileJson, Clipboard, X } from 'lucide-react';
import { PaymentScheduleInput } from '../types';

interface Props {
  onLoad: (data: PaymentScheduleInput) => void;
  onClose: () => void;
}

/**
 * Component for loading and parsing JSON request data to populate schedule forms.
 *
 * This component provides a modal interface for users to paste JSON request data,
 * validates the structure, normalizes the data format, and calls the onLoad callback
 * with the parsed PaymentScheduleInput data. It handles JSON validation, parsing,
 * error handling, and file uploads.
 *
 * @param props - The properties passed to the JsonLoader component, including `onLoad` and `onClose` callbacks.
 */
export default function JsonLoader({ onLoad, onClose }: Props) {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * Converts collection frequency to either 'Monthly' or 'Annual'.
   */
  const normalizeCollectionFrequency = (frequency: string): 'Monthly' | 'Annual' => {
    const normalized = frequency.toLowerCase();
    return normalized === 'monthly' ? 'Monthly' : 'Annual';
  };

  /**
   * Validates and parses the JSON input into PaymentScheduleInput format.
   *
   * This function performs several validations on the input JSON, ensuring that all required fields are present
   * and correctly typed. It also processes nested structures like admin fees and taxes/levies, converting
   * string values to numbers where necessary. The collection frequency is normalized using an external function.
   *
   * @param json - A JSON object representing the payment schedule input data.
   * @returns An object conforming to the PaymentScheduleInput format.
   * @throws Error If any required field is missing or if the types of fields are incorrect.
   */
  const parseJsonInput = (json: any): PaymentScheduleInput => {
    // Validate required fields
    if (!json.collectionFrequency) {
      throw new Error('Missing required field: collectionFrequency');
    }

    if (!json.scheduleStartDate) {
      throw new Error('Missing required field: scheduleStartDate');
    }

    if (!json.effectiveDate) {
      throw new Error('Missing required field: effectiveDate');
    }

    if (typeof json.netAmount !== 'number') {
      throw new Error('netAmount must be a number');
    }

    // Parse and validate admin fees structure
    const adminFees: Record<string, { amountDue: number; taxAmount: number }> = {};
    if (json.adminFees && typeof json.adminFees === 'object') {
      for (const [key, value] of Object.entries(json.adminFees)) {
        if (value && typeof value === 'object') {
          const fee = value as any;
          adminFees[key] = {
            amountDue: Number(fee.amountDue || 0),
            taxAmount: Number(fee.taxAmount || 0)
          };
        }
      }
    }

    // Parse and validate taxes and levies
    const taxesAndLevies: Record<string, number> = {};
    if (json.taxesAndLevies && typeof json.taxesAndLevies === 'object') {
      for (const [key, value] of Object.entries(json.taxesAndLevies)) {
        taxesAndLevies[key] = Number(value || 0);
      }
    }

    const collectionFrequency = normalizeCollectionFrequency(json.collectionFrequency);

    return {
      collectionFrequency,
      scheduleStartDate: json.scheduleStartDate,
      scheduleEndDate: json.scheduleEndDate || '0001-01-01',
      collectionDay: collectionFrequency === 'Annual' ? 0 : (Number(json.collectionDay) || 1),
      effectiveDate: json.effectiveDate,
      dueDate: json.dueDate || null,
      netAmount: Number(json.netAmount),
      taxesAndLevies,
      adminFees,
      currentSchedule: json.currentSchedule || undefined
    };
  };

  /**
   * Handles form submission by parsing JSON input and invoking callbacks.
   *
   * This function prevents the default form event, clears any existing errors,
   * attempts to parse the provided JSON input using `JSON.parse`, and processes
   * the parsed data using a callback. If an error occurs during parsing, it sets
   * an appropriate error message based on the type of error encountered.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const json = JSON.parse(jsonInput);
      const parsedData = parseJsonInput(json);
      onLoad(parsedData);
      onClose();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON syntax. Please check for missing commas, quotes, or brackets.');
      } else {
        setError(err instanceof Error ? err.message : 'Invalid JSON format');
      }
    }
  };

  /**
   * Handles file upload events from an input element.
   *
   * This function processes a file uploaded by a user through an HTML input element.
   * It reads the file as text and updates the state with the file content or sets an error
   * if the file cannot be read. The function checks for the presence of a file, creates a FileReader,
   * and handles the onload event to extract and store the file's content.
   *
   * @param e - React ChangeEvent object containing the uploaded file.
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setJsonInput(content);
        setError(null);
      } catch (err) {
        setError('Failed to read file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileJson className="w-5 h-5" />
            Load JSON Request
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 p-4">
          <div className="flex-1 space-y-4">
            <div className="flex gap-4 justify-center">
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors cursor-pointer">
                <Clipboard className="w-5 h-5" />
                Upload JSON File
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                JSON Request Data
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste your JSON request here..."
                className="w-full h-64 p-4 border border-gray-300 rounded-md focus:border-primary focus:ring focus:ring-primary/20 font-mono text-sm"
                required
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Expected JSON Format:</h3>
              <pre className="text-xs text-blue-800 overflow-x-auto">
{`{
  "collectionFrequency": "monthly" | "annual",
  "scheduleStartDate": "YYYY-MM-DD",
  "scheduleEndDate": "YYYY-MM-DD",
  "collectionDay": number,
  "effectiveDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD" | null,
  "netAmount": number,
  "taxesAndLevies": {
    "TaxLabel": number
  },
  "adminFees": {
    "FeeLabel": {
      "amountDue": number,
      "taxAmount": number
    }
  },
  "currentSchedule": object | null
}`}
              </pre>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark transition-colors"
            >
              Load JSON
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
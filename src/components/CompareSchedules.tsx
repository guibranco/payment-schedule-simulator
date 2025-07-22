import React, { useState } from 'react';
import { FileJson, Eye, ArrowLeftRight, X } from 'lucide-react';
import { PaymentScheduleResponse } from '../types';
import ScheduleDisplay from './ScheduleDisplay';
import Modal from './Modal';

/**
 * Component to compare two payment schedules by uploading or pasting JSON data.
 *
 * This component manages state for two payment schedules and allows users to upload JSON files or paste JSON content.
 * It validates the JSON input, displays the schedules with totals and differences, and provides options to view raw JSON in modals.
 *
 * @returns A React functional component rendering the comparison interface.
 */
export default function CompareSchedules() {
  const [schedule1, setSchedule1] = useState<PaymentScheduleResponse | null>(null);
  const [schedule2, setSchedule2] = useState<PaymentScheduleResponse | null>(null);
  const [jsonInput1, setJsonInput1] = useState('');
  const [jsonInput2, setJsonInput2] = useState('');
  const [error1, setError1] = useState<string | null>(null);
  const [error2, setError2] = useState<string | null>(null);
  const [isJsonModal1Open, setIsJsonModal1Open] = useState(false);
  const [isJsonModal2Open, setIsJsonModal2Open] = useState(false);
  const [activeInput, setActiveInput] = useState<1 | 2>(1);

  /**
   * Handles submission of JSON data for a specified schedule number.
   *
   * This function prevents default form behavior, parses the JSON input,
   * validates required properties, and updates the state with the parsed schedule or an error message.
   *
   * @param scheduleNumber - The schedule number (1 or 2) to update.
   * @returns A function that handles the form submission event.
   */
  const handleJsonSubmit = (scheduleNumber: 1 | 2) => (e: React.FormEvent) => {
    e.preventDefault();
    const jsonInput = scheduleNumber === 1 ? jsonInput1 : jsonInput2;
    const setSchedule = scheduleNumber === 1 ? setSchedule1 : setSchedule2;
    const setError = scheduleNumber === 1 ? setError1 : setError2;

    try {
      const parsedSchedule = JSON.parse(jsonInput);
      // Basic validation to ensure required properties exist
      if (!parsedSchedule.scheduleItems || !Array.isArray(parsedSchedule.scheduleItems)) {
        setError('Invalid schedule format: scheduleItems array is required.');
        return;
      }
      if (!parsedSchedule.collectionFrequency || !parsedSchedule.coverStartDate || !parsedSchedule.coverEndDate) {
        setError('Invalid schedule format: missing required fields.');
        return;
      }
      setSchedule(parsedSchedule);
      setError(null);
    } catch (err) {
      setError('Invalid JSON format. Please check your input.');
    }
  };

  /**
   * Clears a specified schedule by resetting its state and error messages.
   */
  const clearSchedule = (scheduleNumber: 1 | 2) => {
    if (scheduleNumber === 1) {
      setSchedule1(null);
      setJsonInput1('');
      setError1(null);
    } else {
      setSchedule2(null);
      setJsonInput2('');
      setError2(null);
    }
  };

  /**
   * Handles file upload for JSON files, validating type and size before processing.
   *
   * It checks if the uploaded file is a valid JSON file and within the size limit (10MB).
   * Upon successful validation, it reads the file content and updates the corresponding input state.
   * If any validation fails or an error occurs during file reading, it sets appropriate error messages.
   *
   * @param scheduleNumber - A number indicating which schedule to update (either 1 or 2).
   * @returns A function that takes a React ChangeEvent for file input handling.
   */
  const handleFileUpload = (scheduleNumber: 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.includes('json') && !file.name.endsWith('.json')) {
      const setError = scheduleNumber === 1 ? setError1 : setError2;
      setError('Please select a valid JSON file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      const setError = scheduleNumber === 1 ? setError1 : setError2;
      setError('File size too large. Please select a file smaller than 10MB.');
      return;
    }

    const setJsonInput = scheduleNumber === 1 ? setJsonInput1 : setJsonInput2;
    const setError = scheduleNumber === 1 ? setError1 : setError2;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setJsonInput(content);
        setError(null);
      } catch (err) {
        setError('Failed to read file. Please ensure it is a valid text file.');
      }
    };
    reader.onerror = () => {
      setError('Error reading file. Please try again.');
    };
    reader.readAsText(file);
  };

  /**
   * Renders a schedule input component based on the provided schedule number.
   *
   * This function determines which schedule, JSON input, error message, and state setters to use based on the `scheduleNumber`.
   * It renders either a display of an existing schedule or an interface for uploading or pasting a new JSON schedule.
   * The component includes buttons for viewing the JSON in a modal, clearing the schedule, and loading a new one.
   *
   * @param {1 | 2} scheduleNumber - The number indicating which schedule to render (either 1 or 2).
   */
  const renderScheduleInput = (scheduleNumber: 1 | 2) => {
    const schedule = scheduleNumber === 1 ? schedule1 : schedule2;
    const jsonInput = scheduleNumber === 1 ? jsonInput1 : jsonInput2;
    const error = scheduleNumber === 1 ? error1 : error2;
    const setJsonInput = scheduleNumber === 1 ? setJsonInput1 : setJsonInput2;
    const setIsJsonModalOpen = scheduleNumber === 1 ? setIsJsonModal1Open : setIsJsonModal2Open;

    if (schedule) {
      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-primary">
              Schedule {scheduleNumber}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setIsJsonModalOpen(true)}
                className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors"
              >
                View JSON
              </button>
              <button
                onClick={() => clearSchedule(scheduleNumber)}
                className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <ScheduleDisplay schedule={schedule} />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary">
          Schedule {scheduleNumber}
        </h3>
        
        <div className="flex gap-4 justify-center mb-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors cursor-pointer">
            <FileJson className="w-5 h-5" />
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste Schedule {scheduleNumber} JSON
            </label>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="w-full h-48 p-4 border border-gray-300 rounded-md focus:border-primary focus:ring focus:ring-primary/20"
              placeholder={`Paste schedule ${scheduleNumber} JSON here...`}
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
   *
   * This function calculates and displays the total amounts due, difference,
   * and other relevant details such as item count, frequency, and period for each schedule.
   * It uses a helper function `formatDate` to convert date strings into a formatted locale date string.
   * If either `schedule1` or `schedule2` is not provided, it returns null.
   *
   * @returns A JSX element containing the comparison summary or null if schedules are missing.
   */
  const renderComparisonSummary = () => {
    if (!schedule1 || !schedule2) return null;

    const total1 = (schedule1?.scheduleItems || []).reduce((sum, item) => sum + item.amountDue, 0);
    const total2 = (schedule2?.scheduleItems || []).reduce((sum, item) => sum + item.amountDue, 0);
    const difference = total2 - total1;

    /**
     * Formats a date string to a local date representation.
     */
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

        {renderComparisonSummary()}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {renderScheduleInput(1)}
          {renderScheduleInput(2)}
        </div>
      </div>

      <Modal
        isOpen={isJsonModal1Open}
        onClose={() => setIsJsonModal1Open(false)}
        title="Schedule 1 JSON"
      >
        <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto">
          <code>{JSON.stringify(schedule1, null, 2)}</code>
        </pre>
      </Modal>

      <Modal
        isOpen={isJsonModal2Open}
        onClose={() => setIsJsonModal2Open(false)}
        title="Schedule 2 JSON"
      >
        <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto">
          <code>{JSON.stringify(schedule2, null, 2)}</code>
        </pre>
      </Modal>
    </div>
  );
}
import React, { useState } from 'react';
import { FileUp, Clipboard, ArrowRight } from 'lucide-react';
import { PaymentScheduleResponse, PaymentScheduleInput } from '../types';
import ScheduleDisplay from './ScheduleDisplay';
import Modal from './Modal';
import NewSchedule from './NewSchedule';

/**
 * Convert a Policy Admin schedule JSON to a Payment Schedule Service format.
 *
 * This function manages the state and logic for uploading, validating,
 * converting, and displaying a converted schedule JSON. It handles both file uploads
 * and pasting JSON input, validates required fields, performs conversion, and provides
 * options to download or generate new schedules.
 *
 * @returns The React component responsible for rendering the schedule conversion interface.
 */
export default function ConvertSchedule() {
  const [policyAdminSchedule, setPolicyAdminSchedule] = useState<any>(null);
  const [convertedSchedule, setConvertedSchedule] = useState<PaymentScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        validateAndConvertSchedule(json);
      } catch (err) {
        setError('Invalid JSON syntax. Please check for missing commas, quotes, or brackets.');
      }
    };
    reader.readAsText(file);
  };

  const validateAndConvertSchedule = (json: any) => {
    try {
      // Validate required fields for Policy Admin format
      if (!json.PaymentScheduleId || !json.CollectionFrequency || !json.ScheduleItems) {
        throw new Error('Invalid Policy Admin schedule format');
      }

      setPolicyAdminSchedule(json);

      // Convert to Payment Schedule Service format
      const convertedSchedule: PaymentScheduleResponse = {
        id: json.PaymentScheduleId,
        token: json.Token || '',
        hash: json.Hash || '',
        collectionFrequency: json.CollectionFrequency.toLowerCase(),
        collectionDay: json.CollectionDay,
        inceptionDate: json.InceptionDate,
        coverStartDate: json.CoverStartDate,
        coverEndDate: json.CoverEndDate,
        scheduleItems: json.ScheduleItems.map((item: any) => ({
          id: item.Id,
          collectionType: item.CollectionType,
          periodStartDate: item.PeriodStartDate,
          periodEndDate: item.PeriodEndDate,
          adjustmentDate: item.AdjustmentDate,
          dueDate: item.DueDate,
          amountDue: item.AmountDue,
          netAmount: item.NetAmount,
          taxesAndLevies: item.TaxesAndLevies || {},
          adminFees: item.AdminFees || {}
        }))
      };

      setConvertedSchedule(convertedSchedule);
      setError(null);
      setShowPasteInput(false);
      setJsonInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid schedule format');
    }
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const json = JSON.parse(jsonInput);
      validateAndConvertSchedule(json);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON syntax. Please check for missing commas, quotes, or brackets.');
      } else {
        setError(err instanceof Error ? err.message : 'Invalid schedule format');
      }
    }
  };

  /**
   * Downloads a JSON file of the converted schedule.
   */
  const downloadJson = () => {
    if (!convertedSchedule) return;
    
    const dataStr = JSON.stringify(convertedSchedule, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `converted-schedule-${convertedSchedule.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (showNewSchedule && convertedSchedule) {
    const initialInput: PaymentScheduleInput = {
      collectionFrequency: convertedSchedule.collectionFrequency.charAt(0).toUpperCase() + 
                          convertedSchedule.collectionFrequency.slice(1) as 'Monthly' | 'Annual',
      scheduleStartDate: convertedSchedule.coverStartDate,
      scheduleEndDate: convertedSchedule.coverEndDate,
      collectionDay: convertedSchedule.collectionDay,
      effectiveDate: convertedSchedule.inceptionDate,
      dueDate: convertedSchedule.scheduleItems[0]?.dueDate || null,
      netAmount: convertedSchedule.scheduleItems.reduce((sum, item) => sum + item.netAmount, 0),
      taxesAndLevies: convertedSchedule.scheduleItems[0]?.taxesAndLevies || {},
      adminFees: convertedSchedule.scheduleItems.reduce((fees, item) => ({
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

    return <NewSchedule initialSchedule={initialInput} apiEndpoint="" existingSchedule={convertedSchedule} />;
  }

  return (
    <div className="max-w-[90rem] mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-primary">
          <ArrowRight className="w-6 h-6" />
          Convert Policy Admin Schedule
        </h1>

        {!policyAdminSchedule && (
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
                  placeholder="Paste your Policy Admin schedule JSON here..."
                  className="w-full h-64 p-4 border border-gray-300 rounded-md focus:border-primary focus:ring focus:ring-primary"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-secondary text-white rounded-md hover:bg-secondary-dark transition-colors"
                  >
                    Convert Schedule
                  </button>
                </div>
              </form>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <FileUp className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Upload Policy Admin schedule JSON
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

        {convertedSchedule && (
          <div className="space-y-6">
            <div className="bg-primary/10 p-4 rounded-lg">
              <h2 className="text-lg font-semibold text-primary mb-2">Converted Schedule</h2>
              <p className="text-gray-700">
                The Policy Admin schedule has been converted to Payment Schedule Service format. 
                Review the schedule below and download it if needed.
              </p>
            </div>
            
            <ScheduleDisplay schedule={convertedSchedule} />
            
            <div className="flex justify-between items-center">
              <button
                onClick={() => setIsJsonModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                View JSON
              </button>
              <div className="flex gap-2">
                <button
                  onClick={downloadJson}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
                >
                  Download JSON
                </button>
                <button
                  onClick={() => setShowNewSchedule(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-md hover:bg-secondary-dark transition-colors"
                >
                  Generate New Schedule
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        title="Converted Schedule JSON"
      >
        <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto">
          <code>{JSON.stringify(convertedSchedule, null, 2)}</code>
        </pre>
      </Modal>
    </div>
  );
}
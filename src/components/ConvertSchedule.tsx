import React, { useState } from 'react';
import { FileUp, Clipboard, ArrowRight, Check, X, MinusCircle } from 'lucide-react';
import { PaymentScheduleResponse, PaymentScheduleInput } from '../types';
import ScheduleDisplay from './ScheduleDisplay';
import Modal from './Modal';
import NewSchedule from './NewSchedule';

/**
 * Component to convert Policy Admin schedule JSON to Payment Schedule Service format.
 *
 * This component manages the conversion process, including file upload and pasting JSON input.
 * It validates the input, converts it to the required format, and displays the converted schedule.
 * Users can toggle the status of schedule items and generate a new schedule based on the converted data.
 *
 * @returns A React component that provides an interface for converting schedules.
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
        scheduleItems: json.ScheduleItems.map((item: any) => {
          const succeeded = item.Succeeded !== undefined ? item.Succeeded : null;

          return {
            id: item.Id,
            collectionType: item.CollectionType || 'full',
            periodStartDate: item.PeriodStartDate,
            periodEndDate: item.PeriodEndDate,
            adjustmentDate: item.AdjustmentDate || null,
            dueDate: item.DueDate,
            amountDue: Number(item.AmountDue || 0),
            netAmount: Number(item.NetAmount || 0),
            taxesAndLevies: item.TaxesAndLevies || {},
            adminFees: item.AdminFees || {},
            collectionItemCreatedDate: item.CollectionItemCreatedDate || null,
            succeeded,
            originalItem: item.OriginalItem || null
          };
        })
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

  const handleStatusChange = (index: number) => {
    if (!convertedSchedule) return;

    const newSchedule = { ...convertedSchedule };
    const currentStatus = newSchedule.scheduleItems[index].succeeded;
    
    // Cycle through: null -> true -> false -> null
    const newStatus = currentStatus === null ? true : currentStatus ? false : null;
    
    newSchedule.scheduleItems[index].succeeded = newStatus;
    
    // If status is null, also clear the collectionItemCreatedDate
    if (newStatus === null) {
      newSchedule.scheduleItems[index].collectionItemCreatedDate = null;
    } else if (!newSchedule.scheduleItems[index].collectionItemCreatedDate) {
      // If status is being set and no collectionItemCreatedDate exists, set it to current date
      newSchedule.scheduleItems[index].collectionItemCreatedDate = new Date().toISOString();
    }
    
    setConvertedSchedule(newSchedule);
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
      }), {}),
      currentSchedule: convertedSchedule
    };

    return <NewSchedule initialSchedule={initialInput} apiEndpoint="" existingSchedule={convertedSchedule} />;
  }

  return (
    <div className="max-w-screen-2xl mx-auto p-6">
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
                Click on the status icons to toggle between succeeded states (null → true → false).
              </p>
            </div>
            
            <ScheduleDisplay 
              schedule={convertedSchedule} 
              onStatusChange={handleStatusChange}
            />
            
            <div className="flex justify-end items-center gap-4">
              <button
                onClick={() => setIsJsonModalOpen(true)}
                className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
              >
                View JSON
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
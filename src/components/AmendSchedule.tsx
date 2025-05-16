import React, { useState } from 'react';
import { FileUp, Calendar, ArrowRight } from 'lucide-react';
import { PaymentScheduleInput, PaymentScheduleResponse } from '../types';
import NewSchedule from './NewSchedule';
import ScheduleDisplay from './ScheduleDisplay';

interface Props {
  apiEndpoint: string;
}

/**
 * Renders a component for amending an existing payment schedule by uploading a JSON file and displaying options to create a new schedule.
 *
 * The component manages state for the existing schedule, whether to show the new schedule form, and any errors encountered during file upload or processing.
 * It handles file uploads, validates the uploaded JSON format, and initializes input data for creating a new schedule based on the existing one.
 *
 * @param apiEndpoint - The API endpoint used for interacting with the backend services.
 */
export default function AmendSchedule({ apiEndpoint }: Props) {
  const [existingSchedule, setExistingSchedule] = useState<PaymentScheduleResponse | null>(null);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        if (!json.id || !json.collectionFrequency || !json.scheduleItems) {
          throw new Error('Invalid schedule format');
        }

        setExistingSchedule(json);
        setError(null);
      } catch (err) {
        setError('Invalid JSON file format');
      }
    };
    reader.readAsText(file);
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
        ...item.adminFees
      }), {})
    };

    return <NewSchedule initialSchedule={initialInput} apiEndpoint={apiEndpoint} />;
  }

  return (
    <div className="max-w-[90rem] mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-primary">
          <Calendar className="w-6 h-6" />
          Amend Payment Schedule
        </h1>

        {!existingSchedule && (
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
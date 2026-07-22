import React, { useState } from 'react';
import { FileUp, Clipboard, Eye, PencilRuler, Info, RotateCcw, ListChecks } from 'lucide-react';
import { PaymentScheduleResponse, PaymentScheduleInput, CollectionTransaction } from '../types';
import { detectAndNormalizeSchedule, FORMAT_LABELS, ScheduleFormat } from '../utils/scheduleDetector';
import { SAMPLE_SCHEDULES, PLACEHOLDER_SAMPLE_JSON } from '../constants/sampleSchedules';
import ScheduleDisplay from './ScheduleDisplay';
import NewSchedule from './NewSchedule';
import CollectionsLoader from './CollectionsLoader';

interface Props {
  apiEndpoint: string;
}

/**
 * Merged "View Schedule" page.
 *
 * Accepts any of the 4 supported payment schedule JSON shapes (Payment Schedule
 * Service Response/Request, Policy Admin CosmosDB Document, Rerates CosmosDB
 * Document), auto-detects which one was provided, and normalizes it for display.
 */
export default function ViewSchedule({ apiEndpoint }: Props) {
  const [jsonInput, setJsonInput] = useState('');
  const [showPasteInput, setShowPasteInput] = useState(true);
  const [selectedExample, setSelectedExample] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<ScheduleFormat | null>(null);
  const [schedule, setSchedule] = useState<PaymentScheduleResponse | null>(null);
  const [scheduleInput, setScheduleInput] = useState<PaymentScheduleInput | null>(null);
  const [showAmendSchedule, setShowAmendSchedule] = useState(false);
  const [collections, setCollections] = useState<CollectionTransaction[] | null>(null);
  const [isCollectionsLoaderOpen, setIsCollectionsLoaderOpen] = useState(false);

  const processJson = (raw: string) => {
    try {
      const json = JSON.parse(raw);
      const detected = detectAndNormalizeSchedule(json);
      setFormat(detected.format);
      setSchedule(detected.schedule);
      setScheduleInput(detected.input);
      setCollections(null);
      setError(null);
    } catch (err) {
      setFormat(null);
      setSchedule(null);
      setScheduleInput(null);
      if (err instanceof SyntaxError) {
        setError('Invalid JSON syntax. Please check for missing commas, quotes, or brackets.');
      } else {
        setError(err instanceof Error ? err.message : 'Invalid schedule format');
      }
    }
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processJson(jsonInput);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      processJson(content);
    };
    reader.readAsText(file);
  };

  const handleExampleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedExample(value);
    const sample = SAMPLE_SCHEDULES.find((s) => s.format === value);
    if (sample) {
      setJsonInput(JSON.stringify(sample.json, null, 2));
    }
  };

  const handleReset = () => {
    setJsonInput('');
    setSelectedExample('');
    setError(null);
    setFormat(null);
    setSchedule(null);
    setScheduleInput(null);
    setCollections(null);
  };

  const handleStatusChange = (index: number) => {
    if (!schedule) return;

    const newSchedule = { ...schedule, scheduleItems: [...schedule.scheduleItems] };
    const currentStatus = newSchedule.scheduleItems[index].succeeded;
    const newStatus = currentStatus === null ? true : currentStatus ? false : null;

    newSchedule.scheduleItems[index] = {
      ...newSchedule.scheduleItems[index],
      succeeded: newStatus,
      collectionItemCreatedDate:
        newStatus === null
          ? undefined
          : newSchedule.scheduleItems[index].collectionItemCreatedDate || new Date().toISOString()
    };

    setSchedule(newSchedule);
  };

  if (showAmendSchedule && scheduleInput) {
    return (
      <NewSchedule
        initialSchedule={scheduleInput}
        apiEndpoint={apiEndpoint}
        existingSchedule={schedule || undefined}
        onBack={() => setShowAmendSchedule(false)}
      />
    );
  }

  const hasResult = format !== null;

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-primary">
          <Eye className="w-6 h-6" />
          View Schedule
        </h1>

        {!hasResult && (
          <div className="space-y-6">
            <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">You can paste or upload any of these 4 JSON formats — the format is detected automatically:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {Object.values(FORMAT_LABELS).map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
                <p className="mt-2">Use the "Load Example" dropdown next to the buttons below to try a sample of each format.</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center items-center flex-wrap">
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
              {showPasteInput && (
                <select
                  id="schedule-json-example"
                  value={selectedExample}
                  onChange={handleExampleChange}
                  aria-label="Load Example"
                  className="text-sm px-3 py-2 border border-gray-300 rounded-md text-gray-600 bg-white hover:bg-gray-50 focus:border-primary focus:ring focus:ring-primary/20"
                >
                  <option value="">Load Example…</option>
                  {SAMPLE_SCHEDULES.map((sample) => (
                    <option key={sample.format} value={sample.format}>
                      {sample.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {showPasteInput ? (
              <form onSubmit={handlePasteSubmit} className="space-y-4">
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={PLACEHOLDER_SAMPLE_JSON}
                  className="w-full h-64 p-4 border border-gray-300 rounded-md focus:border-primary focus:ring focus:ring-primary font-mono text-sm"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-secondary text-white rounded-md hover:bg-secondary-dark transition-colors"
                  >
                    View Schedule
                  </button>
                </div>
              </form>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <FileUp className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Upload a payment schedule JSON file
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

        {hasResult && (
          <div className="space-y-6">
            <div className="bg-primary/10 p-4 rounded-lg">
              <h2 className="text-lg font-semibold text-primary mb-2">
                Detected format: {format ? FORMAT_LABELS[format] : ''}
              </h2>
              <p className="text-gray-700">
                {schedule
                  ? 'Click on the status icons to toggle between succeeded states (null → true → false).'
                  : 'This request does not include an embedded currentSchedule, so only the input parameters are shown below.'}
              </p>
            </div>

            <div className="flex justify-end flex-wrap gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                Parse New Schedule
              </button>
              {schedule && (
                <button
                  onClick={() => setIsCollectionsLoaderOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  <ListChecks className="w-5 h-5" />
                  {collections ? 'Reload Collections' : 'Load Collections'}
                </button>
              )}
              <button
                onClick={() => setShowAmendSchedule(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
              >
                <PencilRuler className="w-5 h-5" />
                Amend Schedule
              </button>
            </div>

            {schedule ? (
              <ScheduleDisplay
                schedule={schedule}
                onStatusChange={handleStatusChange}
                collections={collections}
                onClearCollections={() => setCollections(null)}
              />
            ) : scheduleInput ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Collection Frequency</h3>
                  <p className="mt-1 text-base text-gray-900">{scheduleInput.collectionFrequency}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Schedule Start Date</h3>
                  <p className="mt-1 text-base text-gray-900">{scheduleInput.scheduleStartDate}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Effective Date</h3>
                  <p className="mt-1 text-base text-gray-900">{scheduleInput.effectiveDate}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Due Date</h3>
                  <p className="mt-1 text-base text-gray-900">{scheduleInput.dueDate || '-'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Net Amount</h3>
                  <p className="mt-1 text-base text-gray-900">€{scheduleInput.netAmount.toFixed(2)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Taxes & Levies</h3>
                  <p className="mt-1 text-base text-gray-900">
                    {Object.entries(scheduleInput.taxesAndLevies).length > 0
                      ? Object.entries(scheduleInput.taxesAndLevies).flatMap(([key, dates]) =>
                          Object.entries(dates).map(([date, value]) => (
                            <span key={`${key}-${date}`} className="block">
                              {key}{date !== '0001-01-01' && ` (effective ${date})`}: €{Number(value).toFixed(2)}
                            </span>
                          ))
                        )
                      : '-'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Admin Fees</h3>
                  <p className="mt-1 text-base text-gray-900">
                    {Object.entries(scheduleInput.adminFees).length > 0
                      ? Object.entries(scheduleInput.adminFees).map(([key, value]) => (
                          <span key={key} className="block">{key}: €{Number(value.amountDue).toFixed(2)}</span>
                        ))
                      : '-'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {isCollectionsLoaderOpen && (
        <CollectionsLoader
          onLoad={setCollections}
          onClose={() => setIsCollectionsLoaderOpen(false)}
        />
      )}
    </div>
  );
}

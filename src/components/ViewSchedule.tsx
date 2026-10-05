import React, { useCallback, useEffect, useState } from "react";
import {
  FileUp,
  Clipboard,
  Eye,
  PencilRuler,
  Info,
  RotateCcw,
  ListChecks,
} from "lucide-react";
import type {
  PaymentScheduleResponse,
  PaymentScheduleInput,
  CollectionTransaction,
} from "../types";
import {
  detectAndNormalizeSchedule,
  FORMAT_LABELS,
  type ScheduleFormat,
} from "../utils/scheduleDetector";
import {
  SAMPLE_SCHEDULES,
  PLACEHOLDER_SAMPLE_JSON,
} from "../constants/sampleSchedules";
import ScheduleDisplay from "./ScheduleDisplay";
import NewSchedule from "./NewSchedule";
import CollectionsLoader from "./CollectionsLoader";
import CollectionsHelp from "./CollectionsHelp";
import CollectionsSyncBar from "./CollectionsSyncBar";
import { useCollectionsSync } from "../hooks/useCollectionsSync";

interface Props {
  apiEndpoint: string;
}

// Signing in to the Collections Service navigates away and back, so the schedule JSON being
// viewed is kept for the tab's session and shown again on return.
const PENDING_SCHEDULE_JSON_KEY = "pendingViewScheduleJson";

/** The schedule JSON saved before a Collections Service sign-in redirect, if any. */
function readPendingScheduleJson(): string {
  try {
    return sessionStorage.getItem(PENDING_SCHEDULE_JSON_KEY) ?? "";
  } catch {
    // Storage unavailable (e.g. blocked by the browser): start empty
    return "";
  }
}

interface ParsedSchedule {
  format: ScheduleFormat | null;
  schedule: PaymentScheduleResponse | null;
  input: PaymentScheduleInput | null;
  error: string | null;
}

const EMPTY_PARSE: ParsedSchedule = { format: null, schedule: null, input: null, error: null };

/** Detects and normalizes schedule JSON, or describes why it can't be read. */
function parseScheduleJson(raw: string): ParsedSchedule {
  try {
    const detected = detectAndNormalizeSchedule(JSON.parse(raw));
    return { format: detected.format, schedule: detected.schedule, input: detected.input, error: null };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return { ...EMPTY_PARSE, error: "Invalid JSON syntax. Please check for missing commas, quotes, or brackets." };
    }
    return { ...EMPTY_PARSE, error: err instanceof Error ? err.message : "Invalid schedule format" };
  }
}

/** The view's starting point: a schedule restored after a sign-in redirect, or nothing. */
function readInitialView(): { jsonInput: string; parsed: ParsedSchedule } {
  const jsonInput = readPendingScheduleJson();
  return { jsonInput, parsed: jsonInput ? parseScheduleJson(jsonInput) : EMPTY_PARSE };
}

/** Returns the next succeeded status in the cycle unknown → succeeded → failed → unknown. */
function nextSucceededStatus(current: boolean | null): boolean | null {
  if (current === null) return true;
  return current ? false : null;
}

/**
 * Summary of a schedule request's input parameters, shown when the request has
 * no embedded currentSchedule to display.
 */
function ScheduleInputSummary({
  input,
}: Readonly<{ input: PaymentScheduleInput }>) {
  const taxesAndLevies = Object.entries(input.taxesAndLevies);
  const adminFees = Object.entries(input.adminFees);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <h3 className="text-sm font-medium text-gray-500">
          Collection Frequency
        </h3>
        <p className="mt-1 text-base text-gray-900">
          {input.collectionFrequency}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500">
          Schedule Start Date
        </h3>
        <p className="mt-1 text-base text-gray-900">
          {input.scheduleStartDate}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500">Effective Date</h3>
        <p className="mt-1 text-base text-gray-900">{input.effectiveDate}</p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500">Due Date</h3>
        <p className="mt-1 text-base text-gray-900">{input.dueDate || "-"}</p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500">Net Amount</h3>
        <p className="mt-1 text-base text-gray-900">
          €{input.netAmount.toFixed(2)}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500">Taxes & Levies</h3>
        <p className="mt-1 text-base text-gray-900">
          {taxesAndLevies.length > 0
            ? taxesAndLevies.flatMap(([key, dates]) =>
                Object.entries(dates).map(([date, value]) => (
                  <span key={`${key}-${date}`} className="block">
                    {key}
                    {date !== "0001-01-01" && ` (effective ${date})`}
                    : €{Number(value).toFixed(2)}
                  </span>
                )),
              )
            : "-"}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500">Admin Fees</h3>
        <p className="mt-1 text-base text-gray-900">
          {adminFees.length > 0
            ? adminFees.map(([key, value]) => (
                <span key={key} className="block">
                  {key}: €{Number(value.amountDue).toFixed(2)}
                </span>
              ))
            : "-"}
        </p>
      </div>
    </div>
  );
}

/**
 * Merged "View Schedule" page.
 *
 * Accepts any of the 5 supported payment schedule JSON shapes (Payment Schedule
 * Service Response/Request, Policy Admin CosmosDB Document, Rerates CosmosDB
 * Document, SEQ Log), auto-detects which one was provided, and normalizes it for display.
 */
export default function ViewSchedule({ apiEndpoint }: Readonly<Props>) {
  const [initialView] = useState(readInitialView);
  const [jsonInput, setJsonInput] = useState(initialView.jsonInput);
  const [showPasteInput, setShowPasteInput] = useState(true);
  const [selectedExample, setSelectedExample] = useState("");
  const [error, setError] = useState<string | null>(initialView.parsed.error);
  const [format, setFormat] = useState<ScheduleFormat | null>(initialView.parsed.format);
  const [schedule, setSchedule] = useState<PaymentScheduleResponse | null>(
    initialView.parsed.schedule,
  );
  const [scheduleInput, setScheduleInput] =
    useState<PaymentScheduleInput | null>(initialView.parsed.input);
  const [showAmendSchedule, setShowAmendSchedule] = useState(false);
  const [collections, setCollections] = useState<
    CollectionTransaction[] | null
  >(null);
  const [isCollectionsLoaderOpen, setIsCollectionsLoaderOpen] = useState(false);

  const sync = useCollectionsSync({ schedule, onCollections: setCollections });
  const { pause: pauseSync, signIn: signInToCollections } = sync;

  // The restored schedule has been read; don't restore it again on a later visit.
  useEffect(() => {
    try {
      sessionStorage.removeItem(PENDING_SCHEDULE_JSON_KEY);
    } catch {
      // Storage unavailable: nothing was saved, so nothing to clear
    }
  }, []);

  /** Detects and normalizes pasted/uploaded JSON, showing the schedule or a parse error. */
  const processJson = (raw: string) => {
    const parsed = parseScheduleJson(raw);
    setFormat(parsed.format);
    setSchedule(parsed.schedule);
    setScheduleInput(parsed.input);
    setCollections(null);
    setError(parsed.error);
  };

  /** Keeps collections loaded by hand, pausing automatic checks so they aren't overwritten. */
  const handleManualCollections = useCallback(
    (loaded: CollectionTransaction[]) => {
      setCollections(loaded);
      pauseSync();
    },
    [pauseSync],
  );

  /** Clears loaded collections, pausing automatic checks until Refresh now. */
  const handleClearCollections = useCallback(() => {
    setCollections(null);
    pauseSync();
  }, [pauseSync]);

  /** Signs in to the Collections Service, keeping the schedule on screen across the redirect. */
  const handleCollectionsSignIn = useCallback(() => {
    try {
      sessionStorage.setItem(PENDING_SCHEDULE_JSON_KEY, jsonInput);
    } catch {
      // Storage unavailable: sign in anyway; the schedule will need pasting again
    }
    void signInToCollections();
  }, [jsonInput, signInToCollections]);

  /** Parses the pasted JSON. */
  const handlePasteSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    processJson(jsonInput);
  };

  /** Reads an uploaded JSON file into the text area and parses it. */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    file.text().then(
      (content) => {
        setJsonInput(content);
        processJson(content);
      },
      () => {
        setError(
          "Failed to read the file. Please try again or paste the JSON directly.",
        );
      },
    );
  };

  /** Fills the text area with the chosen sample schedule. */
  const handleExampleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedExample(value);
    const sample = SAMPLE_SCHEDULES.find((s) => s.format === value);
    if (sample) {
      setJsonInput(JSON.stringify(sample.json, null, 2));
    }
  };

  /** Clears the current schedule so a new one can be parsed. */
  const handleReset = () => {
    setJsonInput("");
    setSelectedExample("");
    setError(null);
    setFormat(null);
    setSchedule(null);
    setScheduleInput(null);
    setCollections(null);
  };

  /** Cycles an item's succeeded status: unknown → succeeded → failed → unknown. */
  const handleStatusChange = (index: number) => {
    if (!schedule) return;

    const newSchedule = {
      ...schedule,
      scheduleItems: [...schedule.scheduleItems],
    };
    const newStatus = nextSucceededStatus(
      newSchedule.scheduleItems[index].succeeded,
    );

    newSchedule.scheduleItems[index] = {
      ...newSchedule.scheduleItems[index],
      succeeded: newStatus,
      collectionItemCreatedDate:
        newStatus === null
          ? undefined
          : newSchedule.scheduleItems[index].collectionItemCreatedDate ||
            new Date().toISOString(),
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
                <p className="font-medium mb-1">
                  You can paste or upload any of these 5 JSON formats — the
                  format is detected automatically:
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  {Object.values(FORMAT_LABELS).map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  Use the &quot;Load Example&quot; dropdown next to the buttons
                  below to try a sample of each format.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-center items-center flex-wrap">
              <button
                onClick={() => setShowPasteInput(true)}
                className={`px-6 py-3 rounded-md transition-colors ${
                  showPasteInput
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
            <div className="bg-primary/10 p-4 rounded-lg flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-primary mb-2">
                  Detected format: {format ? FORMAT_LABELS[format] : ""}
                </h2>
                <p className="text-gray-700">
                  {schedule
                    ? "Click on the status icons to toggle between succeeded states (null → true → false)."
                    : "This request does not include an embedded currentSchedule, so only the input parameters are shown below."}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-3 font-semibold text-white bg-secondary rounded-md shadow-md hover:bg-secondary-dark focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                Parse New Schedule
              </button>
            </div>

            {schedule && (
              <CollectionsSyncBar
                connection={sync.connection}
                status={sync.status}
                error={sync.error}
                lastCheckedAt={sync.lastCheckedAt}
                isPaused={sync.isPaused}
                refreshMinutes={sync.refreshMinutes}
                onRefreshMinutesChange={sync.setRefreshMinutes}
                onRefresh={sync.refresh}
                onSignIn={handleCollectionsSignIn}
              />
            )}

            <div className="flex justify-end flex-wrap gap-2">
              {schedule && (
                <div className="relative group">
                  <button
                    onClick={() => setIsCollectionsLoaderOpen(true)}
                    aria-describedby="load-collections-help"
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    <ListChecks className="w-5 h-5" />
                    {collections ? "Reload Collections" : "Load Collections"}
                    <Info
                      className="w-4 h-4 text-gray-400"
                      aria-hidden="true"
                    />
                  </button>
                  {/* pt-2 (not mt-2) keeps the tooltip contiguous with the button, so the pointer can
                      move onto it to follow the Swagger link without the hover state dropping. */}
                  <div
                    id="load-collections-help"
                    role="tooltip"
                    className="absolute right-0 top-full z-20 pt-2 w-80 hidden group-hover:block group-focus-within:block"
                  >
                    <div className="p-3 bg-white border border-gray-200 rounded-md shadow-lg text-xs text-gray-700">
                      <CollectionsHelp />
                    </div>
                  </div>
                </div>
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
                onClearCollections={handleClearCollections}
              />
            ) : (
              scheduleInput && (
                <ScheduleInputSummary input={scheduleInput} />
              )
            )}
          </div>
        )}
      </div>

      {isCollectionsLoaderOpen && (
        <CollectionsLoader
          onLoad={handleManualCollections}
          onClose={() => setIsCollectionsLoaderOpen(false)}
        />
      )}
    </div>
  );
}

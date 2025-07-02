import React, { useState } from 'react';
import { Calendar, Euro, X, ArrowLeft, FileJson } from 'lucide-react';
import { PaymentScheduleInput, PaymentScheduleResponse, ApiErrorResponse } from '../types';
import { useTokenManager } from '../hooks/useTokenManager';
import { parseApiError } from '../utils/errorHandler';
import ScheduleDisplay from './ScheduleDisplay';
import ErrorDisplay from './ErrorDisplay';
import Modal from './Modal';
import JsonLoader from './JsonLoader';

const defaultSchedule: PaymentScheduleInput = {
  collectionFrequency: 'Monthly',
  scheduleStartDate: new Date().toISOString().split('T')[0],
  scheduleEndDate: '0001-01-01',
  collectionDay: 1,
  effectiveDate: new Date().toISOString().split('T')[0],
  dueDate: null,
  netAmount: 0,
  taxesAndLevies: {},
  adminFees: {}
};

interface Props {
  initialSchedule?: PaymentScheduleInput;
  apiEndpoint: string;
  onBack?: () => void;
  existingSchedule?: PaymentScheduleResponse;
}

/**
 * Renders a form for creating or editing payment schedules.
 *
 * @param {Object} props - The component props.
 * @param {Object} [props.initialSchedule] - The initial schedule data to populate the form with.
 * @param {string} props.apiEndpoint - The endpoint to send the schedule data to for processing.
 * @param {boolean} [props.isEditing=false] - Indicates whether the form is being used to edit an existing schedule.
 * @returns {JSX.Element} - The rendered payment schedule form component.
 */
export default function NewSchedule({ initialSchedule, apiEndpoint, onBack, existingSchedule }: Props) {
  const [schedule, setSchedule] = useState<PaymentScheduleInput>({
    ...initialSchedule || defaultSchedule,
    currentSchedule: existingSchedule
  });
  const [response, setResponse] = useState<PaymentScheduleResponse | null>(null);
  const [taxKey, setTaxKey] = useState('');
  const [taxValue, setTaxValue] = useState('');
  const [feeKey, setFeeKey] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeTax, setFeeTax] = useState('');
  const [apiError, setApiError] = useState<ApiErrorResponse | null>(null);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isJsonLoaderOpen, setIsJsonLoaderOpen] = useState(false);
  const { tokenInfo, refreshToken } = useTokenManager();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSchedule(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'collectionFrequency' && value === 'Annual' ? { collectionDay: 0 } : {})
    }));
  };

  const addTax = () => {
    if (!taxKey || !taxValue) return;
    setSchedule(prev => ({
      ...prev,
      taxesAndLevies: {
        ...prev.taxesAndLevies,
        [taxKey]: parseFloat(taxValue)
      }
    }));
    setTaxKey('');
    setTaxValue('');
  };

  const removeTax = (key: string) => {
    setSchedule(prev => {
      const newTaxes = { ...prev.taxesAndLevies };
      delete newTaxes[key];
      return {
        ...prev,
        taxesAndLevies: newTaxes
      };
    });
  };

  const addFee = () => {
    if (!feeKey || !feeAmount) return;
    setSchedule(prev => ({
      ...prev,
      adminFees: {
        ...prev.adminFees,
        [feeKey]: {
          amountDue: parseFloat(feeAmount),
          taxAmount: parseFloat(feeTax || '0')
        }
      }
    }));
    setFeeKey('');
    setFeeAmount('');
    setFeeTax('');
  };

  const removeFee = (key: string) => {
    setSchedule(prev => {
      const newFees = { ...prev.adminFees };
      delete newFees[key];
      return {
        ...prev,
        adminFees: newFees
      };
    });
  };

  /**
   * Handles JSON load by setting the schedule and clearing any errors.
   */
  const handleJsonLoad = (data: PaymentScheduleInput) => {
    setSchedule(data);
    setApiError(null);
  };

  /**
   * Handles form submission by scheduling a task using an API endpoint.
   *
   * It first prevents the default form submission behavior, then checks if the API endpoint and access token are configured.
   * If the token is expired, it refreshes the token. It constructs the function URL, sends a POST request with necessary headers,
   * and handles errors such as authentication failures. Upon successful response, it updates the state with the schedule data.
   *
   * @param e - The form event object.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setResponse(null);
    
    if (!apiEndpoint) {
      setApiError({
        message: 'API endpoint not configured',
        details: ['Please configure the API endpoint in settings.'],
        type: 'generic'
      });
      return;
    }

    if (!tokenInfo.accessToken) {
      setApiError({
        message: 'Authentication required',
        details: ['Please configure the application settings to authenticate.'],
        type: 'generic'
      });
      return;
    }

    if (tokenInfo.isExpired) {
      setApiError({
        message: 'Token has expired',
        details: ['Refreshing authentication token...'],
        type: 'generic'
      });
      await refreshToken();
      return;
    }
    
    try {
      const functionUrl = new URL('/api/v1/schedule/calculate', apiEndpoint).toString();
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenInfo.accessToken}`,
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'same-origin',
        body: JSON.stringify(schedule),
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setApiError({
            message: 'Authentication expired',
            details: ['Refreshing token...'],
            type: 'generic'
          });
          await refreshToken();
          return;
        }

        // Parse error response
        let errorData = null;
        try {
          errorData = await response.json();
        } catch {
          // If JSON parsing fails, we'll handle it as a generic error
        }

        const parsedError = parseApiError(response, errorData);
        setApiError(parsedError);
        return;
      }

      const data = await response.json();
      setResponse(data);
    } catch (error) {
      console.error('Error generating schedule:', error);
      setApiError({
        message: 'Network error',
        details: [error instanceof Error ? error.message : 'Failed to generate schedule. Please try again.'],
        type: 'generic'
      });
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
            <Calendar className="w-6 h-6" />
            {initialSchedule ? 'Amend Payment Schedule' : 'New Payment Schedule'}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsJsonLoaderOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              title="Load from JSON"
            >
              <FileJson className="w-5 h-5" />
              Load JSON
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
            )}
          </div>
        </div>

        {apiError && (
          <ErrorDisplay 
            error={apiError} 
            onDismiss={() => setApiError(null)}
            className="mb-6"
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 gap-8">
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Collection Frequency
                </label>
                <select
                  name="collectionFrequency"
                  value={schedule.collectionFrequency}
                  onChange={handleInputChange}
                  className="block w-full h-12 px-4 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 transition-all text-base"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Annual">Annual</option>
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Collection Day {schedule.collectionFrequency === 'Monthly' ? '(1-31)' : ''}
                </label>
                <input
                  type="number"
                  name="collectionDay"
                  min="1"
                  max="31"
                  value={schedule.collectionDay || ''}
                  onChange={handleInputChange}
                  disabled={schedule.collectionFrequency === 'Annual'}
                  className={`block w-full h-12 px-4 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 transition-all text-base
                    ${schedule.collectionFrequency === 'Annual' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-1">
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Schedule Start Date
                </label>
                <input
                  type="date"
                  name="scheduleStartDate"
                  value={schedule.scheduleStartDate}
                  onChange={handleInputChange}
                  className="block w-full h-12 px-4 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 transition-all text-base"
                />
              </div>

              <div className="flex-1">
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Schedule End Date
                </label>
                <input
                  type="date"
                  name="scheduleEndDate"
                  value={schedule.scheduleEndDate}
                  onChange={handleInputChange}
                  className="block w-full h-12 px-4 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 transition-all text-base"
                />
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-1">
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Effective Date
                </label>
                <input
                  type="date"
                  name="effectiveDate"
                  value={schedule.effectiveDate}
                  onChange={handleInputChange}
                  className="block w-full h-12 px-4 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 transition-all text-base"
                />
              </div>

              <div className="flex-1">
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={schedule.dueDate || ''}
                  onChange={handleInputChange}
                  className="block w-full h-12 px-4 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 transition-all text-base"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2">
                Net Amount (€)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Euro className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  name="netAmount"
                  value={schedule.netAmount}
                  onChange={handleInputChange}
                  className="block w-full h-12 pl-12 pr-4 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 transition-all text-base"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-primary pt-4">Taxes and Levies</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Tax Label"
                value={taxKey}
                onChange={(e) => setTaxKey(e.target.value)}
                className="flex-1 h-12 px-4 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 transition-all text-base"
              />
              <input
                type="number"
                placeholder="Amount"
                value={taxValue}
                onChange={(e) => setTaxValue(e.target.value)}
                className="flex-1 h-12 px-4 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 transition-all text-base"
                step="0.01"
              />
              <button
                type="button"
                onClick={addTax}
                className="px-6 h-12 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-base font-medium"
              >
                Add Tax
              </button>
            </div>
            {Object.entries(schedule.taxesAndLevies).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                <span className="text-base">
                  <span className="font-medium">{key}:</span> €{value}
                </span>
                <button
                  type="button"
                  onClick={() => removeTax(key)}
                  className="text-red-600 hover:text-red-800 p-2"
                  title="Remove tax"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-primary pt-4">Admin Fees</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Fee Label"
                value={feeKey}
                onChange={(e) => setFeeKey(e.target.value)}
                className="flex-1 h-12 px-4 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 transition-all text-base"
              />
              <input
                type="number"
                placeholder="Amount"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                className="flex-1 h-12 px-4 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 transition-all text-base"
                step="0.01"
              />
              <input
                type="number"
                placeholder="Tax Amount"
                value={feeTax}
                onChange={(e) => setFeeTax(e.target.value)}
                className="flex-1 h-12 px-4 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 transition-all text-base"
                step="0.01"
              />
              <button
                type="button"
                onClick={addFee}
                className="px-6 h-12 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-base font-medium"
              >
                Add Fee
              </button>
            </div>
            {Object.entries(schedule.adminFees).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                <span className="text-base">
                  <span className="font-medium">{key}:</span> Amount: €{value.amountDue}
                  {value.taxAmount > 0 && `, Tax: €${value.taxAmount}`}
                </span>
                <button
                  type="button"
                  onClick={() => removeFee(key)}
                  className="text-red-600 hover:text-red-800 p-2"
                  title="Remove fee"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <button
              type="button"
              onClick={() => {
                setSchedule(initialSchedule || defaultSchedule);
                setResponse(null);
                setApiError(null);
              }}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-base font-medium"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setIsJsonModalOpen(true)}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-base font-medium"
            >
              View JSON Request
            </button>
            <button
              type="submit"
              disabled={tokenInfo.isExpired}
              className="px-6 py-3 bg-secondary text-white rounded-lg hover:bg-secondary-dark transition-colors text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Schedule
            </button>
          </div>
        </form>
      </div>

      {response && <ScheduleDisplay schedule={response} />}

      <Modal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        title="JSON Request Preview"
      >
        <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto">
          <code>{JSON.stringify(schedule, null, 2)}</code>
        </pre>
      </Modal>

      {isJsonLoaderOpen && (
        <JsonLoader
          onLoad={handleJsonLoad}
          onClose={() => setIsJsonLoaderOpen(false)}
        />
      )}
    </div>
  );
}
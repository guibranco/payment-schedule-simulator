import React, { useState } from 'react';
import { Calendar, Euro, X } from 'lucide-react';
import { PaymentScheduleInput, PaymentScheduleResponse } from '../types';
import ScheduleDisplay from './ScheduleDisplay';

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
}

/**
 * A React component for creating and managing a new payment schedule.
 *
 * This component manages the state of a payment schedule, including taxes and admin fees.
 * It provides functionality to add and remove taxes and fees, handle input changes,
 * and submit the schedule data to an API endpoint. The component also handles errors
 * related to API requests and user authentication.
 *
 * @param initialSchedule - An optional initial schedule object to populate the form.
 * @param apiEndpoint - The API endpoint URL for submitting the payment schedule.
 */
export default function NewSchedule({ initialSchedule, apiEndpoint }: Props) {
  const [schedule, setSchedule] = useState<PaymentScheduleInput>(initialSchedule || defaultSchedule);
  const [response, setResponse] = useState<PaymentScheduleResponse | null>(null);
  const [taxKey, setTaxKey] = useState('');
  const [taxValue, setTaxValue] = useState('');
  const [feeKey, setFeeKey] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeTax, setFeeTax] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSchedule(prev => ({
      ...prev,
      [name]: value
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
   * Handles form submission to calculate a schedule using an API endpoint.
   *
   * This function prevents the default form submission, checks if the API endpoint is configured,
   * and verifies if the user is authenticated by checking the access token in local storage.
   * It then makes a POST request to the API with the schedule data, handling authentication
   * errors and other HTTP issues. If successful, it updates the response state; otherwise, it sets an error message.
   *
   * @param e - The form event object.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResponse(null);
    
    if (!apiEndpoint) {
      setError('API endpoint not configured. Please configure it in settings.');
      return;
    }

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      setError('Not authenticated. Please configure the application settings.');
      return;
    }
    
    try {
      const functionUrl = new URL('/api/v1/schedule/calculate', apiEndpoint).toString();
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'same-origin',
        body: JSON.stringify(schedule),
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('accessToken');
          setError('Authentication expired. Please reconfigure the application settings.');
          return;
        }
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResponse(data);
    } catch (error) {
      console.error('Error generating schedule:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate schedule. Please try again.');
    }
  };

  return (
    <div className="max-w-[90rem] mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-primary">
          <Calendar className="w-6 h-6" />
          {initialSchedule ? 'Amend Payment Schedule' : 'New Payment Schedule'}
        </h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Collection Frequency
              </label>
              <select
                name="collectionFrequency"
                value={schedule.collectionFrequency}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              >
                <option value="Monthly">Monthly</option>
                <option value="Annual">Annual</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Schedule Start Date
              </label>
              <input
                type="date"
                name="scheduleStartDate"
                value={schedule.scheduleStartDate}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Schedule End Date
              </label>
              <input
                type="date"
                name="scheduleEndDate"
                value={schedule.scheduleEndDate}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>

            {schedule.collectionFrequency === 'Monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Collection Day (1-31)
                </label>
                <input
                  type="number"
                  name="collectionDay"
                  min="1"
                  max="31"
                  value={schedule.collectionDay || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Effective Date
              </label>
              <input
                type="date"
                name="effectiveDate"
                value={schedule.effectiveDate}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Due Date (Optional)
              </label>
              <input
                type="date"
                name="dueDate"
                value={schedule.dueDate || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Net Amount (€)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Euro className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  name="netAmount"
                  value={schedule.netAmount}
                  onChange={handleInputChange}
                  className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-primary">Taxes and Levies</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Tax Label"
                value={taxKey}
                onChange={(e) => setTaxKey(e.target.value)}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              />
              <input
                type="number"
                placeholder="Amount"
                value={taxValue}
                onChange={(e) => setTaxValue(e.target.value)}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                step="0.01"
              />
              <button
                type="button"
                onClick={addTax}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
              >
                Add Tax
              </button>
            </div>
            {Object.entries(schedule.taxesAndLevies).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                <span className="text-sm">
                  <span className="font-medium">{key}:</span> €{value}
                </span>
                <button
                  type="button"
                  onClick={() => removeTax(key)}
                  className="text-red-600 hover:text-red-800 p-1"
                  title="Remove tax"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-primary">Admin Fees</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Fee Label"
                value={feeKey}
                onChange={(e) => setFeeKey(e.target.value)}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              />
              <input
                type="number"
                placeholder="Amount"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                step="0.01"
              />
              <input
                type="number"
                placeholder="Tax Amount"
                value={feeTax}
                onChange={(e) => setFeeTax(e.target.value)}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                step="0.01"
              />
              <button
                type="button"
                onClick={addFee}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
              >
                Add Fee
              </button>
            </div>
            {Object.entries(schedule.adminFees).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                <span className="text-sm">
                  <span className="font-medium">{key}:</span> Amount: €{value.amountDue}
                  {value.taxAmount > 0 && `, Tax: €${value.taxAmount}`}
                </span>
                <button
                  type="button"
                  onClick={() => removeFee(key)}
                  className="text-red-600 hover:text-red-800 p-1"
                  title="Remove fee"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setSchedule(initialSchedule || defaultSchedule);
                setResponse(null);
                setError(null);
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Reset
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-secondary text-white rounded-md hover:bg-secondary-dark"
            >
              Generate Schedule
            </button>
          </div>
        </form>
      </div>

      {response && <ScheduleDisplay schedule={response} />}
    </div>
  );
}
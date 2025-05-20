import React, { useState } from 'react';
import { Euro, FileJson, FileSpreadsheet, Check, X, MinusCircle } from 'lucide-react';
import { PaymentScheduleResponse } from '../types';
import Modal from './Modal';

interface Props {
  schedule: PaymentScheduleResponse;
  onStatusChange?: (index: number) => void;
}

/**
 * Display a schedule with detailed items and options to download data in JSON or CSV format.
 *
 * This component renders a comprehensive view of a schedule, including total amount, collection day,
 * cover period, and other relevant details. It also provides functionality to download the schedule
 * data as either JSON or CSV files. The table displays individual schedule items with various attributes
 * such as due date, net amount, taxes, admin fees, and status icons. Additionally, a modal can be opened
 * to view the raw JSON representation of the schedule.
 *
 * @param schedule - An object containing the schedule details including items, period dates, and amounts.
 * @param onStatusChange - A callback function that triggers when a status icon is clicked, allowing for status changes.
 */
export default function ScheduleDisplay({ schedule, onStatusChange }: Props) {
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  
  const totalAmount = schedule.scheduleItems.length > 0 
    ? schedule.scheduleItems.reduce((sum, item) => sum + Number(item?.amountDue ?? 0), 0) 
    : 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '0001-01-01T00:00:00+00:00') return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime()) || date.getFullYear() <= 1) return '-';
    return date.toLocaleDateString('en-GB');
  };

  const getIndexBackgroundColor = (item: any) => {
    if (Number(item.amountDue) < 0) return 'bg-blue-100';
    if (Object.keys(item.adminFees).length > 0) return 'bg-orange-100';
    if (item.collectionType === 'proRata') return 'bg-yellow-100';
    return 'bg-green-100';
  };
  
  /**
   * Generates and downloads a CSV file containing schedule item data.
   *
   * This function constructs a CSV with headers and rows extracted from schedule items.
   * It calculates various date-related fields, sums up admin fees and taxes,
   * and formats the data appropriately before creating a downloadable CSV link.
   *
   * @returns void
   */
  const downloadCsv = () => {
    const headers = [
      'Index',
      'PeriodStartDate',
      'PeriodEndDate',
      'DaysDueDateBeforePeriodStart',
      'DaysInPeriod',
      'DaysRemainingInPeriod',
      'DueDate',
      'AmountDue',
      'AdminFeesTotal',
      'AdminFees',
      'NetPremium',
      'TaxesAndLeviesTotal',
      'TaxesAndLevies',
      'CollectionItemCreatedDate',
      'Succeeded',
      'AdjustmentDate',
      'HasOriginalItem',
      'Type'
    ];
    
    const rows = schedule.scheduleItems.map((item, index) => {
      const periodStart = new Date(item.periodStartDate);
      const periodEnd = new Date(item.periodEndDate);
      const dueDate = new Date(item.dueDate);
      
      // Calculate days between due date and period start
      const daysDueDateBeforePeriodStart = Math.floor((periodStart.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate days in period
      const daysInPeriod = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Calculate days remaining in period (from current date)
      const now = new Date();
      const daysRemainingInPeriod = Math.floor((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const adminFeesTotal = Object.values(item.adminFees).reduce((sum, fee) => sum + (fee.amountDue || 0), 0);
      const taxesAndLeviesTotal = Object.values(item.taxesAndLevies).reduce((sum, value) => sum + (value || 0), 0);

      const adminFeesStr = Object.entries(item.adminFees)
        .map(([key, value]) => `${key}|${value.amountDue}|${value.taxAmount}`)
        .join(':');

      const taxesAndLeviesStr = Object.entries(item.taxesAndLevies)
        .map(([key, value]) => `${key}|${value}`)
        .join(':');

      return [
        index,
        formatDate(item.periodStartDate),
        formatDate(item.periodEndDate),
        daysDueDateBeforePeriodStart,
        daysInPeriod,
        daysRemainingInPeriod,
        formatDate(item.dueDate),
        item.amountDue,
        adminFeesTotal,
        adminFeesStr || '',
        item.netAmount,
        taxesAndLeviesTotal,
        taxesAndLeviesStr || '',
        item.collectionItemCreatedDate ? formatDate(item.collectionItemCreatedDate) : '',
        item.succeeded?.toString() || '',
        item.adjustmentDate ? formatDate(item.adjustmentDate) : '',
        (item.originalItem !== undefined && item.originalItem !== null).toString(),
        item.collectionType
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-${schedule.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadJson = () => {
    const dataStr = JSON.stringify(schedule, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-${schedule.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (succeeded: boolean | null, index: number) => {
    const icon = succeeded === null ? 
      <MinusCircle className="w-5 h-5 text-gray-400" /> :
      succeeded ? 
        <Check className="w-5 h-5 text-green-500" /> : 
        <X className="w-5 h-5 text-red-500" />;

    return onStatusChange ? (
      <button
        onClick={() => onStatusChange(index)}
        className="hover:bg-gray-100 p-1 rounded-full transition-colors"
        title="Click to change status"
      >
        {icon}
      </button>
    ) : icon;
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <div className="flex justify-between items-center mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-grow">
            <div className="p-4 bg-primary/10 rounded-lg">
              <h3 className="text-sm font-medium text-primary">Total Amount</h3>
              <p className="mt-2 flex items-center text-2xl font-semibold text-primary">
                <Euro className="w-5 h-5 mr-1" />
                {totalAmount.toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900">Collection Day</h3>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{schedule.collectionDay}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900">Cover Period</h3>
              <p className="mt-2 text-sm font-medium text-gray-900">
                {formatDate(schedule.coverStartDate)} - {formatDate(schedule.coverEndDate)}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900">Schedule ID</h3>
              <p className="mt-2 text-sm font-medium text-gray-900 truncate" title={schedule.id}>
                {schedule.id}
              </p>
            </div>
          </div>
          <div className="flex gap-2 ml-4">
            <button
              onClick={downloadJson}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
              title="Download schedule as JSON"
            >
              <FileJson className="w-5 h-5" />
              JSON
            </button>
            <button
              onClick={downloadCsv}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-md hover:bg-secondary-dark"
              title="Download schedule items as CSV"
            >
              <FileSpreadsheet className="w-5 h-5" />
              CSV
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Legend</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 rounded"></div>
              <span className="text-sm text-gray-600">Full Collection</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 rounded"></div>
              <span className="text-sm text-gray-600">Pro Rata Collection</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 rounded"></div>
              <span className="text-sm text-gray-600">Admin Fee</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 rounded"></div>
              <span className="text-sm text-gray-600">Refund</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Index</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taxes & Levies</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Fees</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collection Item Created Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adjustment Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Has Original Item</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {schedule.scheduleItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${getIndexBackgroundColor(item)}`}>
                    {index}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(item.periodStartDate)} - {formatDate(item.periodEndDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(item.dueDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    €{Number(item?.netAmount ?? 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {Object.entries(item.taxesAndLevies).length > 0 ? (
                      Object.entries(item.taxesAndLevies).map(([key, value]) => (
                        <div key={key}>
                          {key}: €{Number(value || 0).toFixed(2)}
                        </div>
                      ))
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {Object.entries(item.adminFees).length > 0 ? (
                      Object.entries(item.adminFees).map(([key, value]) => (
                        <div key={key}>
                          {key}: €{Number(value.amountDue || 0).toFixed(2)}
                          {Number(value.taxAmount || 0) > 0 && ` + €${Number(value.taxAmount || 0).toFixed(2)} tax`}
                        </div>
                      ))
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    €{Number(item?.amountDue ?? 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.collectionItemCreatedDate ? formatDate(item.collectionItemCreatedDate) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getStatusIcon(item.succeeded, index)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(item.adjustmentDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.originalItem ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        title="Schedule JSON"
      >
        <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto">
          <code>{JSON.stringify(schedule, null, 2)}</code>
        </pre>
      </Modal>
    </>
  );
}
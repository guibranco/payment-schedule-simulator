import React, { useState } from 'react';
import { Euro, FileJson, FileSpreadsheet, Check, X, MinusCircle } from 'lucide-react';
import { PaymentScheduleResponse } from '../types';
import Modal from './Modal';

interface Props {
  schedule: PaymentScheduleResponse;
  onStatusChange?: (index: number) => void;
}

/**
 * A React component for displaying a schedule and its items with various actions like downloading as CSV or JSON.
 *
 * This component renders a summary of the schedule, including total amount, collection day, cover period, and schedule ID.
 * It also displays a table of schedule items with details such as index, period, due date, net amount, taxes & levies,
 * admin fees, total, collection item created date, status, adjustment date, and whether it has an original item.
 *
 * The component provides buttons to download the schedule data as JSON or CSV. It includes helper functions like
 * `formatDate` for formatting dates, `getIndexBackgroundColor` for setting background colors based on item attributes,
 * and `getStatusIcon` for rendering status icons with optional change functionality.
 *
 * @param {Props} props - The component's properties including the schedule data and a callback for status changes.
 */
export default function ScheduleDisplay({ schedule, onStatusChange }: Props) {
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  
  const totalAmount = schedule.scheduleItems.length > 0 
    ? schedule.scheduleItems.reduce((sum, item) => sum + Number(item?.amountDue ?? 0), 0) 
    : 0;

  /**
   * Formats a given date string to 'en-GB' locale or returns '-' if invalid.
   * - Checks if the input string is empty or a default value and returns '-'.
   * - Converts the string to a Date object and validates it.
   * - If the date is valid, formats it using `toLocaleDateString` with 'en-GB' locale.
   *
   * @param {string} dateStr - The date string to be formatted.
   */
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '0001-01-01T00:00:00+00:00') return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime()) || date.getFullYear() <= 1) return '-';
    return date.toLocaleDateString('en-GB');
  };

  /**
   * Determines the background color based on item properties.
   *
   * This function checks the admin fees and collection type of the item to determine
   * the appropriate background color. If there are admin fees, it returns 'bg-orange-100'.
   * If the collection type is 'proRata', it returns 'bg-yellow-100'. Otherwise, it defaults
   * to 'bg-green-100'.
   *
   * @param item - The object containing adminFees and collectionType properties.
   */
  const getIndexBackgroundColor = (item: any) => {
    if (Object.keys(item.adminFees).length > 0) return 'bg-orange-100';
    if (item.collectionType === 'proRata') return 'bg-yellow-100';
    return 'bg-green-100';
  };
  
  /**
   * Downloads a CSV file containing schedule items data.
   *
   * This function constructs a CSV file from an array of schedule items, formatting each item's data into rows.
   * It handles various fields such as taxes, fees, and dates, ensuring they are properly formatted for CSV output.
   * The resulting CSV is then downloaded by creating a Blob URL and triggering a click event on a hidden link element.
   *
   * @returns void
   */
  const downloadCsv = () => {
    const headers = [
      'Index',
      'Period Start',
      'Period End',
      'Due Date',
      'Net Amount',
      'Taxes & Levies',
      'Admin Fees',
      'Total Amount',
      'Collection Item Created Date',
      'Status',
      'Adjustment Date',
      'Has Original Item'
    ];
    
    const rows = schedule.scheduleItems.map((item, index) => {
      const taxesStr = Object.entries(item.taxesAndLevies)
        .map(([key, value]) => `${key}: €${Number(value || 0).toFixed(2)}`)
        .join('; ');
      
      const feesStr = Object.entries(item.adminFees)
        .map(([key, value]) => `${key}: €${Number(value.amountDue || 0).toFixed(2)}${Number(value.taxAmount || 0) > 0 ? ` + €${Number(value.taxAmount || 0).toFixed(2)} tax` : ''}`)
        .join('; ');

      return [
        index.toString(),
        formatDate(item.periodStartDate),
        formatDate(item.periodEndDate),
        formatDate(item.dueDate),
        `€${Number(item?.netAmount ?? 0).toFixed(2)}`,
        taxesStr || '-',
        feesStr || '-',
        `€${Number(item?.amountDue ?? 0).toFixed(2)}`,
        item.collectionItemCreatedDate ? formatDate(item.collectionItemCreatedDate) : '-',
        item.succeeded === null ? 'Pending' : item.succeeded ? 'Success' : 'Failed',
        item.adjustmentDate ? formatDate(item.adjustmentDate) : '-',
        item.originalItem ? 'Yes' : 'No'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
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
import React, { useState } from 'react';
import { Euro, FileJson, FileSpreadsheet } from 'lucide-react';
import { PaymentScheduleResponse } from '../types';
import Modal from './Modal';

interface Props {
  schedule: PaymentScheduleResponse;
}

/**
 * Renders a schedule display component with options to download data as JSON or CSV.
 *
 * This function calculates the total amount of scheduled items, renders summary statistics,
 * and provides buttons to download the schedule data in JSON or CSV format. It also includes
 * a modal for viewing the raw JSON data. The component handles rendering of a table with detailed
 * information about each schedule item, including period dates, due dates, amounts, taxes, and fees.
 *
 * @param {Props} props - An object containing the schedule data.
 * @returns {JSX.Element} A React JSX element representing the schedule display interface.
 */
export default function ScheduleDisplay({ schedule }: Props) {
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  
  const totalAmount = schedule.scheduleItems.length > 0 
    ? schedule.scheduleItems.reduce((sum, item) => sum + Number(item?.amountDue ?? 0), 0) 
    : 0;
  
  const downloadCsv = () => {
    const headers = ['Period Start', 'Period End', 'Due Date', 'Net Amount', 'Taxes & Levies', 'Admin Fees', 'Total Amount'];
    const rows = schedule.scheduleItems.map(item => {
      const taxesStr = Object.entries(item.taxesAndLevies)
        .map(([key, value]) => `${key}: €${Number(value).toFixed(2)}`)
        .join('; ');
      
      const feesStr = Object.entries(item.adminFees)
        .map(([key, value]) => `${key}: €${Number(value.amountDue).toFixed(2)}${Number(value.taxAmount) > 0 ? ` + €${Number(value.taxAmount).toFixed(2)} tax` : ''}`)
        .join('; ');

      return [
        new Date(item.periodStartDate).toLocaleDateString(),
        new Date(item.periodEndDate).toLocaleDateString(),
        new Date(item.dueDate).toLocaleDateString(),
        `€${Number(item?.netAmount ?? 0).toFixed(2)}`,
        taxesStr || '-',
        feesStr || '-',
        `€${Number(item?.amountDue ?? 0).toFixed(2)}`
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
                {new Date(schedule.coverStartDate).toLocaleDateString()} - {new Date(schedule.coverEndDate).toLocaleDateString()}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taxes & Levies</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Fees</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {schedule.scheduleItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(item.periodStartDate).toLocaleDateString()} - {new Date(item.periodEndDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(item.dueDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    €{Number(item?.netAmount ?? 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {Object.entries(item.taxesAndLevies).map(([key, value]) => (
                      <div key={key}>
                        {key}: €{Number(value).toFixed(2)}
                      </div>
                    ))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {Object.entries(item.adminFees).map(([key, value]) => (
                      <div key={key}>
                        {key}: €{Number(value.amountDue).toFixed(2)}
                        {Number(value.taxAmount) > 0 && ` + €${Number(value.taxAmount).toFixed(2)} tax`}
                      </div>
                    ))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    €{Number(item?.amountDue ?? 0).toFixed(2)}
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
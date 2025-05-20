import React, { useState } from 'react';
import { FileJson, FileSpreadsheet, FileText, File as FilePdf, Eye } from 'lucide-react';
import { PaymentScheduleResponse } from '../types';
import ScheduleDisplay from './ScheduleDisplay';

export default function ViewSchedule() {
  const [schedule, setSchedule] = useState<PaymentScheduleResponse | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleJsonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedSchedule = JSON.parse(jsonInput);
      setSchedule(parsedSchedule);
      setError(null);
    } catch (err) {
      setError('Invalid JSON format. Please check your input.');
    }
  };

  const downloadHtml = () => {
    if (!schedule) return;

    const styles = `
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem; }
        table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
        th, td { border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left; }
        th { background-color: #f9fafb; }
        .header { margin-bottom: 2rem; }
        .total { font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; }
      </style>
    `;

    const totalAmount = schedule.scheduleItems.reduce((sum, item) => sum + item.amountDue, 0);

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Payment Schedule ${schedule.id}</title>
          ${styles}
        </head>
        <body>
          <div class="header">
            <h1>Payment Schedule Details</h1>
            <p>Schedule ID: ${schedule.id}</p>
            <p>Collection Frequency: ${schedule.collectionFrequency}</p>
            <p>Cover Period: ${new Date(schedule.coverStartDate).toLocaleDateString()} - ${new Date(schedule.coverEndDate).toLocaleDateString()}</p>
            <div class="total">Total Amount: €${totalAmount.toFixed(2)}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Due Date</th>
                <th>Net Amount</th>
                <th>Taxes & Levies</th>
                <th>Admin Fees</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${schedule.scheduleItems.map(item => `
                <tr>
                  <td>${new Date(item.periodStartDate).toLocaleDateString()} - ${new Date(item.periodEndDate).toLocaleDateString()}</td>
                  <td>${new Date(item.dueDate).toLocaleDateString()}</td>
                  <td>€${item.netAmount.toFixed(2)}</td>
                  <td>${Object.entries(item.taxesAndLevies).map(([key, value]) => 
                    `${key}: €${value.toFixed(2)}`).join('<br>')}</td>
                  <td>${Object.entries(item.adminFees).map(([key, value]) => 
                    `${key}: €${value.amountDue.toFixed(2)}`).join('<br>')}</td>
                  <td>€${item.amountDue.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-${schedule.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    if (!schedule) return;
    
    try {
      const jsPDFModule = await import('jspdf');
      const doc = new jsPDFModule.default();

      // Add header
      doc.setFontSize(16);
      doc.text('Payment Schedule Details', 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Schedule ID: ${schedule.id}`, 20, 30);
      doc.text(`Collection Frequency: ${schedule.collectionFrequency}`, 20, 40);
      doc.text(`Cover Period: ${new Date(schedule.coverStartDate).toLocaleDateString()} - ${new Date(schedule.coverEndDate).toLocaleDateString()}`, 20, 50);

      const totalAmount = schedule.scheduleItems.reduce((sum, item) => sum + item.amountDue, 0);
      doc.text(`Total Amount: €${totalAmount.toFixed(2)}`, 20, 60);

      // Add table
      let y = 80;
      const itemHeight = 10;
      const pageHeight = doc.internal.pageSize.height;

      schedule.scheduleItems.forEach((item, index) => {
        if (y + itemHeight > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }

        doc.text(`${index + 1}. Due Date: ${new Date(item.dueDate).toLocaleDateString()}`, 20, y);
        doc.text(`Amount: €${item.amountDue.toFixed(2)}`, 20, y + 5);
        
        y += itemHeight;
      });

      doc.save(`schedule-${schedule.id}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-primary">
          <Eye className="w-6 h-6" />
          View Schedule
        </h1>

        {!schedule && (
          <form onSubmit={handleJsonSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste Schedule JSON
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full h-64 p-4 border border-gray-300 rounded-md focus:border-primary focus:ring focus:ring-primary/20"
                placeholder="Paste your schedule JSON here..."
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-md">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
              >
                View Schedule
              </button>
            </div>
          </form>
        )}

        {schedule && (
          <div className="space-y-6">
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setSchedule(null);
                  setJsonInput('');
                  setError(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Parse New Schedule
              </button>
              <button
                onClick={downloadHtml}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
              >
                <FileText className="w-5 h-5" />
                HTML
              </button>
              <button
                onClick={downloadPdf}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-md hover:bg-secondary-dark"
              >
                <FilePdf className="w-5 h-5" />
                PDF
              </button>
            </div>

            <ScheduleDisplay schedule={schedule} />
          </div>
        )}
      </div>
    </div>
  );
}
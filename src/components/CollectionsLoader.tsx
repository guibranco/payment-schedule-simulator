import React, { useState } from 'react';
import { ListChecks, FileUp, X } from 'lucide-react';
import type { CollectionTransaction } from '../types';
import { parseCollectionsJson } from '../utils/reconcileCollections';

interface Props {
  onLoad: (collections: CollectionTransaction[]) => void;
  onClose: () => void;
}

/**
 * Modal for pasting or uploading a Collections Service response (a JSON array of
 * transactions for a schedule) so it can be reconciled against the schedule items
 * currently shown on the View Schedule screen.
 */
export default function CollectionsLoader({ onLoad, onClose }: Props) {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const collections = parseCollectionsJson(jsonInput);
      onLoad(collections);
      onClose();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON syntax. Please check for missing commas, quotes, or brackets.');
      } else {
        setError(err instanceof Error ? err.message : 'Invalid collections JSON format');
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read the file. Please try again or paste the JSON directly.');
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ListChecks className="w-5 h-5" />
            Load Collections
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 p-4">
          <div className="flex-1 space-y-4">
            <p className="text-sm text-gray-600">
              Paste or upload the Collections Service response for this schedule (a JSON array of
              transactions) to reconcile it against the schedule items below.
            </p>

            <div className="flex gap-4 justify-center">
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors cursor-pointer">
                <FileUp className="w-5 h-5" />
                Upload JSON File
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Collections JSON</label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste the Collections Service JSON array here..."
                className="w-full h-64 p-4 border border-gray-300 rounded-md focus:border-primary focus:ring focus:ring-primary/20 font-mono text-sm"
                required
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark transition-colors"
            >
              Reconcile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

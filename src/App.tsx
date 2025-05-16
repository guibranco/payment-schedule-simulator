import React, { useState, useEffect } from 'react';
import { Calculator, PencilRuler, Settings } from 'lucide-react';
import NewSchedule from './components/NewSchedule';
import AmendSchedule from './components/AmendSchedule';
import ConfigDialog from './components/ConfigDialog';

/**
 * Main application component that manages the payment schedule simulator interface.
 *
 * This component handles user interactions, state management for active tab and configuration dialog,
 * and renders different sections based on the active tab ('new' or 'amend'). It also manages
 * the API endpoint configuration through local storage.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<'new' | 'amend'>('new');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState('');

  useEffect(() => {
    const savedEndpoint = localStorage.getItem('apiEndpoint');
    if (!savedEndpoint) {
      setIsConfigOpen(true);
    } else {
      setApiEndpoint(savedEndpoint);
    }
  }, []);

  const handleSaveConfig = (endpoint: string) => {
    setApiEndpoint(endpoint);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-primary text-white shadow-lg">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="w-8 h-8" />
              Payment Schedule Simulator
            </h1>
            <button
              onClick={() => setIsConfigOpen(true)}
              className="p-2 rounded-full hover:bg-primary-light transition-colors"
              title="Settings"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-sm">
        <div className="max-w-[90rem] mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('new')}
              className={`py-4 px-3 inline-flex items-center gap-2 border-b-2 text-sm font-medium ${
                activeTab === 'new'
                  ? 'border-secondary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calculator className="w-5 h-5" />
              New Schedule
            </button>
            <button
              onClick={() => setActiveTab('amend')}
              className={`py-4 px-3 inline-flex items-center gap-2 border-b-2 text-sm font-medium ${
                activeTab === 'amend'
                  ? 'border-secondary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <PencilRuler className="w-5 h-5" />
              Amend Schedule
            </button>
          </div>
        </div>
      </nav>

      <main className="py-8">
        {activeTab === 'new' ? (
          <NewSchedule apiEndpoint={apiEndpoint} />
        ) : (
          <AmendSchedule apiEndpoint={apiEndpoint} />
        )}
      </main>

      <ConfigDialog
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
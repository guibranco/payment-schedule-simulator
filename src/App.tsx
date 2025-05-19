import React, { useState, useEffect } from 'react';
import { Calculator, PencilRuler, Settings } from 'lucide-react';
import NewSchedule from './components/NewSchedule';
import AmendSchedule from './components/AmendSchedule';
import ConfigDialog from './components/ConfigDialog';

/**
 * The main application component for managing payment schedule simulations.
 *
 * It initializes state variables for active tab, configuration open status, and API endpoint.
 * It uses useEffect to load saved settings from localStorage and handle OAuth callbacks.
 * It provides a header with navigation buttons and renders different components based on the active tab.
 * It includes a configuration dialog for saving API endpoints.
 *
 * @returns The main application component.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<'new' | 'amend'>('new');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState('');

  useEffect(() => {
    const savedEndpoint = localStorage.getItem('apiEndpoint');
    const accessToken = localStorage.getItem('accessToken');
    if (!savedEndpoint || !accessToken) {
      setIsConfigOpen(true);
    } else {
      setApiEndpoint(savedEndpoint);
    }
  }, []);

  useEffect(() => {
    /**
     * Handles the OAuth callback process to exchange authorization code for an access token.
     *
     * This function extracts the 'code' and 'state' from the URL parameters, clears them from the browser history,
     * retrieves necessary configuration from local storage, and makes a POST request to the token endpoint.
     * Upon success, it stores the access token in local storage. If there is an error during the token exchange,
     * it logs the error and sets a flag to open the configuration interface.
     */
    const handleOAuthCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (code && state) {
        window.history.replaceState({}, document.title, window.location.pathname);
        
        const tenantId = localStorage.getItem('tenantId');
        const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const clientId = localStorage.getItem('clientId');
        const environment = localStorage.getItem('environment') || 'prod';
        const envSuffix = environment === 'prod' ? '' : `-${environment}`;
        
        fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: clientId || '',
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: window.location.origin,
            scope: `api://schedule-api${envSuffix}/user_impersonation`,
          }),
        })
        .then(response => response.json())
        .then(data => {
          localStorage.setItem('accessToken', data.access_token);
        })
        .catch(error => {
          console.error('Error exchanging code for token:', error);
          setIsConfigOpen(true);
        });
      }
    };

    handleOAuthCallback();
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
import React, { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (endpoint: string) => void;
}

interface OAuthConfig {
  clientId: string;
  environment: 'prod' | 'int' | 'stg';
  scopes: string[];
}

/**
 * ConfigDialog component for managing API configuration settings.
 *
 * This component renders a modal dialog that allows users to configure an API endpoint, client ID,
 * and environment. It also handles form submission by storing the input values in local storage,
 * constructing an OAuth authorization URL, and redirecting the user to authenticate.
 *
 * The component uses React hooks such as `useState` for managing state and `useEffect` for side effects.
 * It includes validation for required fields and provides feedback to the user through UI elements.
 *
 * @param isOpen - A boolean indicating whether the dialog is open or closed.
 * @param onClose - A callback function to close the dialog.
 * @param onSave - A callback function to handle saving configuration changes.
 */
export default function ConfigDialog({ isOpen, onClose, onSave }: Props) {
  const [endpoint, setEndpoint] = useState('');
  const [clientId, setClientId] = useState('');
  const [environment, setEnvironment] = useState<'prod' | 'int' | 'stg'>('prod');
  const [selectedScopes] = useState(['api://schedule-api/user_impersonation']);

  useEffect(() => {
    if (isOpen) {
      const savedEndpoint = localStorage.getItem('apiEndpoint') || '';
      const savedClientId = localStorage.getItem('clientId') || '';
      const savedEnvironment = (localStorage.getItem('environment') || 'prod') as 'prod' | 'int' | 'stg';
      setEndpoint(savedEndpoint);
      setClientId(savedClientId);
      setEnvironment(savedEnvironment);
    }
  }, [isOpen]);

  /**
   * Constructs and returns an authorization URL for OAuth2 authentication.
   */
  const getAuthorizationUrl = (config: OAuthConfig) => {
    const envSuffix = config.environment === 'prod' ? '' : `-${config.environment}`;
    const baseUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`;
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: window.location.origin,
      scope: config.scopes.join(' '),
      state: crypto.randomUUID()
    });
    return `${baseUrl}?${params.toString()}`;
  };

  /**
   * Handles form submission, saves configuration to localStorage, and redirects to authorization URL.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    localStorage.setItem('apiEndpoint', endpoint);
    localStorage.setItem('clientId', clientId);
    localStorage.setItem('environment', environment);
    
    const config: OAuthConfig = {
      clientId,
      environment,
      scopes: selectedScopes.map(scope => 
        scope.replace('{environment-suffix}', environment === 'prod' ? '' : `-${environment}`)
      )
    };

    const authUrl = getAuthorizationUrl(config);
    window.location.href = authUrl;
    
    onSave(endpoint);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuration
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-4">
            <div>
              <label htmlFor="endpoint" className="block text-sm font-medium text-gray-700">
                API Endpoint
              </label>
              <input
                type="url"
                id="endpoint"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://your-api-endpoint.com"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="clientId" className="block text-sm font-medium text-gray-700">
                Client ID
              </label>
              <input
                type="text"
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter your client ID"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="environment" className="block text-sm font-medium text-gray-700">
                Environment
              </label>
              <select
                id="environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as 'prod' | 'int' | 'stg')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              >
                <option value="prod">Production</option>
                <option value="int">Integration</option>
                <option value="stg">Staging</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Required Scopes
              </label>
              <div className="mt-1 text-sm text-gray-500">
                {selectedScopes.map(scope => (
                  <div key={scope} className="p-2 bg-gray-50 rounded">
                    {scope.replace('{environment-suffix}', environment === 'prod' ? '' : `-${environment}`)}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark"
              >
                Connect
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
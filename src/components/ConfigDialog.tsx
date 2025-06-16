import React, { useState, useEffect, useCallback } from 'react';
import { Settings, X } from 'lucide-react';
import { STORAGE_KEYS } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (endpoint: string) => void;
}

interface OAuthConfig {
  clientId: string;
  tenantId: string;
  environment: 'prod' | 'int' | 'stg';
  scopes: string[];
}

/**
 * ConfigDialog component for managing API configuration settings.
 *
 * This component renders a dialog to configure an API endpoint, including base URL, port,
 * client ID, tenant ID, environment, and scopes. It also handles form submission to save the
 * configurations and redirects to the authorization URL for OAuth2 authentication.
 *
 * @param isOpen - A boolean indicating whether the dialog is open or closed.
 * @param onClose - A function to close the dialog.
 * @param onSave - A function to handle the save action after form submission.
 */
export default function ConfigDialog({ isOpen, onClose, onSave }: Props) {
  const [baseUrl, setBaseUrl] = useState('');
  const [port, setPort] = useState('');
  const [clientId, setClientId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [environment, setEnvironment] = useState<'prod' | 'int' | 'stg'>('prod');
  const [selectedScopes] = useState(['api://schedule-api{environment-suffix}.outsurance.ie/user_impersonation']);

  useEffect(() => {
    if (isOpen) {
      const savedEndpoint = localStorage.getItem(STORAGE_KEYS.API_ENDPOINT) || '';
      const savedClientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || '';
      const savedTenantId = localStorage.getItem(STORAGE_KEYS.TENANT_ID) || '';
      const savedEnvironment = (localStorage.getItem(STORAGE_KEYS.ENVIRONMENT) || 'prod') as 'prod' | 'int' | 'stg';

      try {
        const url = new URL(savedEndpoint);
        setBaseUrl(url.protocol + '//' + url.hostname);
        setPort(url.port || '');
      } catch {
        setBaseUrl(savedEndpoint);
        setPort('');
      }

      setClientId(savedClientId);
      setTenantId(savedTenantId);
      setEnvironment(savedEnvironment);
    }
  }, [isOpen]);

  /**
   * Generates the authorization URL for OAuth 2.0 authentication.
   */
  const getAuthorizationUrl = useCallback((config: OAuthConfig) => {
    const baseUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`;
    const envSuffix = config.environment === 'prod' ? '' : `-${config.environment}`;
    const scope = config.scopes.map(scope => 
      scope.replace('{environment-suffix}', envSuffix)
    ).join(' ');

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: window.location.origin,
      scope,
      state: crypto.randomUUID()
    });

    return `${baseUrl}?${params.toString()}`;
  }, []);

  /**
   * Handles form submission by preventing default behavior, validating and storing API endpoint details,
   * generating an authorization URL, and redirecting to it. Also saves configuration and closes the form.
   */
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = new URL(baseUrl);
      if (port) {
        url.port = port;
      }
      localStorage.setItem(STORAGE_KEYS.API_ENDPOINT, url.toString());
    } catch (error) {
      console.error('Invalid URL:', error);
      return;
    }

    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId);
    localStorage.setItem(STORAGE_KEYS.TENANT_ID, tenantId);
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, environment);
    
    const config: OAuthConfig = {
      clientId,
      tenantId,
      environment,
      scopes: selectedScopes
    };

    const authUrl = getAuthorizationUrl(config);
    window.location.href = authUrl;
    
    onSave(baseUrl);
    onClose();
  }, [baseUrl, port, clientId, tenantId, environment, selectedScopes, getAuthorizationUrl, onSave, onClose]);

  const handleClose = useCallback(() => {
    // Save the cancellation state to localStorage
    localStorage.setItem(STORAGE_KEYS.CONFIG_CANCELLED, 'true');
    onClose();
  }, [onClose]);

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
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-4">
            <div>
              <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700">
                API Base URL
              </label>
              <input
                type="url"
                id="baseUrl"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="port" className="block text-sm font-medium text-gray-700">
                Port (Optional)
              </label>
              <input
                type="number"
                id="port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="8080"
                min="1"
                max="65535"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="tenantId" className="block text-sm font-medium text-gray-700">
                Tenant ID
              </label>
              <input
                type="text"
                id="tenantId"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="Enter your tenant ID"
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
                onClick={handleClose}
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
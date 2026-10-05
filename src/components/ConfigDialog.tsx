import React, { useState, useCallback } from 'react';
import { Settings, X } from 'lucide-react';
import { STORAGE_KEYS } from '../constants';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce';
import { getRedirectUri } from '../utils/url';
import CollectionsServiceForm from './CollectionsServiceForm';
import {
  type Environment,
  isEnvironment,
  isHttpUrl,
  isSafeIdentifier,
  microsoftOAuthEndpoint,
} from '../utils/oauthValidation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (endpoint: string) => void;
}

type FormProps = Omit<Props, 'isOpen'>;

interface OAuthConfig {
  clientId: string;
  tenantId: string;
  environment: Environment;
  scopes: string[];
}

interface SavedConfig {
  baseUrl: string;
  port: string;
  clientId: string;
  tenantId: string;
  environment: Environment;
}

/**
 * Reads the previously saved configuration from localStorage, splitting the saved
 * endpoint into its base URL and port.
 */
function readSavedConfig(): SavedConfig {
  const savedEndpoint = localStorage.getItem(STORAGE_KEYS.API_ENDPOINT) || '';
  const clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || '';
  const tenantId = localStorage.getItem(STORAGE_KEYS.TENANT_ID) || '';
  const storedEnvironment = localStorage.getItem(STORAGE_KEYS.ENVIRONMENT);
  const environment: Environment = isEnvironment(storedEnvironment) ? storedEnvironment : 'prod';

  let baseUrl: string;
  let port: string;
  try {
    const url = new URL(savedEndpoint);
    baseUrl = `${url.protocol}//${url.hostname}`;
    port = url.port || '';
  } catch {
    // Not a parseable URL (e.g. nothing saved yet): show it as-is with no port
    baseUrl = savedEndpoint;
    port = '';
  }

  return { baseUrl, port, clientId, tenantId, environment };
}

/**
 * ConfigDialog component for managing API configuration settings.
 *
 * This component renders a dialog to configure an API endpoint, including base URL, port,
 * client ID, tenant ID, environment, and scopes. It handles form submission to save the configurations
 * and redirects to the authorization URL for OAuth2 authentication with PKCE. The form is mounted
 * each time the dialog opens, so it always starts from the configuration saved in localStorage.
 *
 * @param isOpen - A boolean indicating whether the dialog is open or closed.
 * @param onClose - A function to close the dialog.
 * @param onSave - A function to handle the save action after form submission.
 */
export default function ConfigDialog({ isOpen, onClose, onSave }: Readonly<Props>) {
  if (!isOpen) return null;

  return <ConfigDialogForm onClose={onClose} onSave={onSave} />;
}

type ConfigTab = 'schedule' | 'collections';

const TABS: Array<{ id: ConfigTab; label: string }> = [
  { id: 'schedule', label: 'Payment Schedule Service' },
  { id: 'collections', label: 'Collections Service' }
];

/**
 * The open configuration dialog: one tab per service, each with its own sign-in.
 */
function ConfigDialogForm({ onClose, onSave }: Readonly<FormProps>) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('schedule');

  /** Records that the dialog was cancelled and closes it. */
  const handleCancel = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.CONFIG_CANCELLED, 'true');
    onClose();
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuration
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div role="tablist" aria-label="Service" className="flex border-b">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 ${
                activeTab === tab.id
                  ? 'border-secondary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === 'schedule' ? (
          <ScheduleServiceForm onCancel={handleCancel} onClose={onClose} onSave={onSave} />
        ) : (
          <CollectionsServiceForm onCancel={handleCancel} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

/**
 * The Payment Schedule Service settings, initialised from the saved configuration.
 */
function ScheduleServiceForm({ onClose, onSave, onCancel }: Readonly<FormProps & { onCancel: () => void }>) {
  const [saved] = useState(readSavedConfig);
  const [baseUrl, setBaseUrl] = useState(saved.baseUrl);
  const [port, setPort] = useState(saved.port);
  const [clientId, setClientId] = useState(saved.clientId);
  const [tenantId, setTenantId] = useState(saved.tenantId);
  const [environment, setEnvironment] = useState<Environment>(saved.environment);
  const [selectedScopes] = useState(['api://schedule-api{environment-suffix}.outsurance.ie/user_impersonation']);

  /**
   * Generates the authorization URL for OAuth 2.0 authentication with PKCE.
   */
  const getAuthorizationUrl = useCallback(async (config: OAuthConfig) => {
    const baseUrl = microsoftOAuthEndpoint(config.tenantId, 'authorize');
    const envSuffix = config.environment === 'prod' ? '' : `-${config.environment}`;
    const scope = config.scopes.map(scope => 
      scope.replace('{environment-suffix}', envSuffix)
    ).join(' ');

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Store code_verifier for later use in token exchange
    localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);

    const redirectUri = getRedirectUri();

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope,
      state: crypto.randomUUID(),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    return `${baseUrl}?${params.toString()}`;
  }, []);

  /**
   * Handles form submission by preventing default behavior, validating and storing API endpoint details,
   * generating an authorization URL with PKCE, and redirecting to it. Also saves configuration and closes the form.
   */
  const handleSubmit = useCallback(async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    let endpoint: URL;
    try {
      endpoint = new URL(baseUrl);
      if (port) {
        endpoint.port = port;
      }
    } catch (error) {
      console.error('Invalid URL:', error);
      return;
    }
    if (!isHttpUrl(endpoint)) {
      console.error('Invalid URL: the API base URL must use http or https');
      return;
    }
    if (!isSafeIdentifier(clientId) || !isSafeIdentifier(tenantId) || !isEnvironment(environment)) {
      console.error('Invalid configuration: client and tenant IDs may only contain letters, digits, dots and hyphens');
      return;
    }

    localStorage.setItem(STORAGE_KEYS.API_ENDPOINT, endpoint.toString());
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId);
    localStorage.setItem(STORAGE_KEYS.TENANT_ID, tenantId);
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, environment);
    
    const config: OAuthConfig = {
      clientId,
      tenantId,
      environment,
      scopes: selectedScopes
    };

    const authUrl = await getAuthorizationUrl(config);
    window.location.href = authUrl;
    
    onSave(baseUrl);
    onClose();
  }, [baseUrl, port, clientId, tenantId, environment, selectedScopes, getAuthorizationUrl, onSave, onClose]);

  const redirectUri = getRedirectUri();

  return (
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
                onChange={(e) => setEnvironment(isEnvironment(e.target.value) ? e.target.value : 'prod')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              >
                <option value="prod">Production</option>
                <option value="int">Integration</option>
                <option value="stg">Staging</option>
              </select>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700">
                Redirect URI
              </span>
              <div className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-600 break-all">
                {redirectUri}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Use this URL in your Azure AD app registration
              </p>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700">
                Required Scopes
              </span>
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
                onClick={onCancel}
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
  );
}
import React, { useState, useEffect } from 'react';
import { Calculator, PencilRuler, Settings, Eye, GitCompare } from 'lucide-react';
import NewSchedule from './components/NewSchedule';
import AmendSchedule from './components/AmendSchedule';
import ViewSchedule from './components/ViewSchedule';
import CompareSchedules from './components/CompareSchedules';
import ConfigDialog from './components/ConfigDialog';
import TokenStatus from './components/TokenStatus';
import { STORAGE_KEYS } from './constants';
import { toSameOriginUrl } from './utils/oauthValidation';
import { exchangeCodeForToken } from './utils/oauthFlow';

const VALID_TABS = ['new', 'amend', 'view', 'compare'] as const;

type Tab = (typeof VALID_TABS)[number];

function isValidTab(value: string | null): value is Tab {
  return !!value && (VALID_TABS as readonly string[]).includes(value);
}

/**
 * Returns the saved API endpoint when both it and an access token are stored, otherwise ''.
 */
function readInitialApiEndpoint(): string {
  const savedEndpoint = localStorage.getItem(STORAGE_KEYS.API_ENDPOINT);
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  return savedEndpoint && accessToken ? savedEndpoint : '';
}

/**
 * Whether the config dialog should open on load: the app is not configured and the
 * dialog hasn't been cancelled before.
 */
function shouldOpenConfigInitially(): boolean {
  const configCancelled = localStorage.getItem(STORAGE_KEYS.CONFIG_CANCELLED);
  return readInitialApiEndpoint() === '' && !configCancelled;
}

/**
 * Handles an OAuth error response. If a silent refresh failed, retries the
 * authorization without prompt=none (never leaving this origin); otherwise clears the URL.
 */
function handleOAuthError(error: string): void {
  console.error('OAuth error:', error);
  // If silent refresh failed, try with prompt
  if (error === 'interaction_required' || error === 'login_required') {
    const returnUrl = localStorage.getItem(STORAGE_KEYS.RETURN_URL);
    if (returnUrl) {
      localStorage.removeItem(STORAGE_KEYS.RETURN_URL);
      // Retry without prompt=none, never leaving this origin
      const retryUrl = toSameOriginUrl(
        window.location.href.replace('prompt=none&', '').replace('&prompt=none', '')
      );
      if (retryUrl) {
        window.location.href = retryUrl;
        return;
      }
    }
  }
  window.history.replaceState({}, document.title, window.location.pathname);
}

/**
 * Renders the page component for the given tab.
 */
function renderTab(tab: Tab, apiEndpoint: string) {
  switch (tab) {
    case 'new':
      return <NewSchedule apiEndpoint={apiEndpoint} />;
    case 'amend':
      return <AmendSchedule apiEndpoint={apiEndpoint} />;
    case 'view':
      return <ViewSchedule apiEndpoint={apiEndpoint} />;
    default:
      return <CompareSchedules />;
  }
}

/**
 * Main application component for Payment Schedule Simulator.
 *
 * This function manages the state of the active tab, configuration dialog,
 * and API endpoint. It handles OAuth callbacks to authenticate users with PKCE support,
 * and conditionally renders different components based on the active tab.
 * The component also processes OAuth responses, checks for errors, and exchanges
 * authorization codes for access tokens. It updates local storage with tokens
 * and manages redirection based on stored URLs.
 *
 * @returns The main application component.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    return isValidTab(saved) ? saved : 'new';
  });
  // Only show the config dialog on load if the app isn't configured and it hasn't been cancelled before
  const [isConfigOpen, setIsConfigOpen] = useState(shouldOpenConfigInitially);
  const [apiEndpoint, setApiEndpoint] = useState(readInitialApiEndpoint);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
  }, [activeTab]);

  useEffect(() => {
    /**
     * Handles the OAuth callback after user authorization.
     *
     * This function processes the OAuth response, checks for errors, and exchanges the authorization code for an access token.
     * It manages various states and errors, including retrying with different parameters on interaction required errors.
     * The function updates local storage with tokens and handles redirection based on stored URLs.
     *
     * @returns void
     */
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      
      if (error) {
        handleOAuthError(error);
        return;
      }
      
      if (!code || !state) {
        return;
      }

      window.history.replaceState({}, document.title, window.location.pathname);

      const codeVerifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
      if (!codeVerifier) {
        console.error('Code verifier not found');
        setIsConfigOpen(true);
        return;
      }

      try {
        await exchangeCodeForToken(code, state, codeVerifier);
      } catch (err) {
        console.error('Error exchanging code for token:', err);
        // Clean up the code verifier on error
        localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
        localStorage.removeItem(STORAGE_KEYS.RETURN_URL);
        setIsConfigOpen(true);
      }
    };

    void handleOAuthCallback();
  }, []);

  /** Stores the saved API endpoint and clears the config-cancelled flag. */
  const handleSaveConfig = (endpoint: string) => {
    setApiEndpoint(endpoint);
    // Clear the cancellation flag when config is successfully saved
    localStorage.removeItem(STORAGE_KEYS.CONFIG_CANCELLED);
  };

  /** Opens the config dialog, clearing the config-cancelled flag. */
  const handleOpenConfig = () => {
    // Clear the cancellation flag when manually opening config
    localStorage.removeItem(STORAGE_KEYS.CONFIG_CANCELLED);
    setIsConfigOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-primary text-white shadow-lg">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="w-8 h-8" />
              Payment Schedule Simulator
            </h1>
            <div className="flex items-center gap-4">
              <TokenStatus />
              <button
                onClick={handleOpenConfig}
                className="p-2 rounded-full hover:bg-primary-light transition-colors"
                title="Settings"
              >
                <Settings className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-sm">
        <div className="px-4">
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
            <button
              onClick={() => setActiveTab('view')}
              className={`py-4 px-3 inline-flex items-center gap-2 border-b-2 text-sm font-medium ${
                activeTab === 'view'
                  ? 'border-secondary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Eye className="w-5 h-5" />
              View Schedule
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`py-4 px-3 inline-flex items-center gap-2 border-b-2 text-sm font-medium ${
                activeTab === 'compare'
                  ? 'border-secondary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <GitCompare className="w-5 h-5" />
              Compare Schedules
            </button>
          </div>
        </div>
      </nav>

      <main className="py-8">
        {renderTab(activeTab, apiEndpoint)}
      </main>

      <ConfigDialog
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
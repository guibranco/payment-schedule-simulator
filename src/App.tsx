import React, { useState, useEffect } from 'react';
import { Calculator, PencilRuler, Settings, ArrowRight, Eye } from 'lucide-react';
import NewSchedule from './components/NewSchedule';
import AmendSchedule from './components/AmendSchedule';
import ConvertSchedule from './components/ConvertSchedule';
import ViewSchedule from './components/ViewSchedule';
import ConfigDialog from './components/ConfigDialog';
import TokenStatus from './components/TokenStatus';
import { STORAGE_KEYS } from './constants';
import { getRedirectUri } from './utils/url';

/**
 * Main application component for Payment Schedule Simulator.
 *
 * This function manages the state of the active tab, configuration dialog,
 * and API endpoint. It handles OAuth callbacks to authenticate users with PKCE support,
 * and conditionally renders different components based on the active tab.
 *
 * @returns The main application component.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<'new' | 'amend' | 'convert' | 'view'>('new');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState('');

  useEffect(() => {
    const savedEndpoint = localStorage.getItem(STORAGE_KEYS.API_ENDPOINT);
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const configCancelled = localStorage.getItem(STORAGE_KEYS.CONFIG_CANCELLED);
    
    if (!savedEndpoint || !accessToken) {
      // Only show config dialog if it hasn't been cancelled before
      if (!configCancelled) {
        setIsConfigOpen(true);
      }
    } else {
      setApiEndpoint(savedEndpoint);
    }
  }, []);

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
        console.error('OAuth error:', error);
        // If silent refresh failed, try with prompt
        if (error === 'interaction_required' || error === 'login_required') {
          const returnUrl = localStorage.getItem(STORAGE_KEYS.RETURN_URL);
          if (returnUrl) {
            localStorage.removeItem(STORAGE_KEYS.RETURN_URL);
            // Retry without prompt=none
            const currentUrl = new URL(window.location.href);
            const newUrl = currentUrl.href.replace('prompt=none&', '').replace('&prompt=none', '');
            window.location.href = newUrl;
            return;
          }
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      if (code && state) {
        window.history.replaceState({}, document.title, window.location.pathname);
        
        const tenantId = localStorage.getItem(STORAGE_KEYS.TENANT_ID);
        const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
        const codeVerifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
        
        if (!codeVerifier) {
          console.error('Code verifier not found');
          setIsConfigOpen(true);
          return;
        }

        try {
          const redirectUri = getRedirectUri();
          
          const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code: code,
              client_id: clientId || '',
              redirect_uri: redirectUri,
              code_verifier: codeVerifier,
            }),
          });

          if (!response.ok) {
            throw new Error(`Token exchange failed: ${response.status}`);
          }

          const data = await response.json();
          localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
          
          // Calculate and store expiration time
          const expiresIn = data.expires_in || 3600; // Default to 1 hour if not provided
          const expiresAt = Date.now() + (expiresIn * 1000);
          localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
          
          // Clean up the code verifier
          localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
          
          // Return to the original URL if available
          const returnUrl = localStorage.getItem(STORAGE_KEYS.RETURN_URL);
          if (returnUrl && returnUrl !== window.location.href) {
            localStorage.removeItem(STORAGE_KEYS.RETURN_URL);
            window.location.href = returnUrl;
            return;
          }
        } catch (error) {
          console.error('Error exchanging code for token:', error);
          // Clean up the code verifier on error
          localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
          localStorage.removeItem(STORAGE_KEYS.RETURN_URL);
          setIsConfigOpen(true);
        }
      }
    };

    handleOAuthCallback();
  }, []);

  const handleSaveConfig = (endpoint: string) => {
    setApiEndpoint(endpoint);
    // Clear the cancellation flag when config is successfully saved
    localStorage.removeItem(STORAGE_KEYS.CONFIG_CANCELLED);
  };

  const handleOpenConfig = () => {
    // Clear the cancellation flag when manually opening config
    localStorage.removeItem(STORAGE_KEYS.CONFIG_CANCELLED);
    setIsConfigOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-primary text-white shadow-lg">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
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
        <div className="max-w-screen-2xl mx-auto px-4">
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
              onClick={() => setActiveTab('convert')}
              className={`py-4 px-3 inline-flex items-center gap-2 border-b-2 text-sm font-medium ${
                activeTab === 'convert'
                  ? 'border-secondary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ArrowRight className="w-5 h-5" />
              Convert Schedule
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
          </div>
        </div>
      </nav>

      <main className="py-8">
        {activeTab === 'new' ? (
          <NewSchedule apiEndpoint={apiEndpoint} />
        ) : activeTab === 'amend' ? (
          <AmendSchedule apiEndpoint={apiEndpoint} />
        ) : activeTab === 'convert' ? (
          <ConvertSchedule />
        ) : (
          <ViewSchedule />
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
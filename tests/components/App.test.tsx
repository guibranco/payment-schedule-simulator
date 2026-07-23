import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';
import { STORAGE_KEYS } from '../../src/constants';

describe('App — active tab persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    // Prevent the Config dialog from popping open and obscuring the tab under test.
    localStorage.setItem(STORAGE_KEYS.CONFIG_CANCELLED, 'true');
  });

  it('defaults to the New Schedule tab when nothing is saved', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'New Payment Schedule' })).toBeInTheDocument();
  });

  it('restores the last active tab from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 'compare');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Compare Schedules' })).toBeInTheDocument();
  });

  it('ignores an invalid saved tab value and falls back to New Schedule', () => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 'not-a-real-tab');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'New Payment Schedule' })).toBeInTheDocument();
  });

  it('persists the selected tab to localStorage when a nav button is clicked', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /View Schedule/ }));

    expect(screen.getByRole('heading', { name: 'View Schedule' })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)).toBe('view');
  });

  it('reopens on the same tab after a simulated reload (remount)', () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Amend Schedule/ }));
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)).toBe('amend');
    unmount();

    render(<App />);
    expect(screen.getByRole('heading', { name: 'Amend Payment Schedule' })).toBeInTheDocument();
  });
});

describe('App — settings and config dialog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('opens the config dialog automatically when no endpoint/token are saved', () => {
    render(<App />);
    expect(screen.getByText('Configuration')).toBeInTheDocument();
  });

  it('does not auto-open the config dialog once it has been cancelled before', () => {
    localStorage.setItem(STORAGE_KEYS.CONFIG_CANCELLED, 'true');
    render(<App />);
    expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
  });

  it('does not auto-open the config dialog when an endpoint and token are already saved', () => {
    localStorage.setItem(STORAGE_KEYS.API_ENDPOINT, 'https://api.example.com');
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'a-token');
    render(<App />);
    expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
  });

  it('opens the config dialog from the Settings button and clears a prior cancellation', () => {
    localStorage.setItem(STORAGE_KEYS.CONFIG_CANCELLED, 'true');
    render(<App />);
    expect(screen.queryByText('Configuration')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Settings'));

    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.CONFIG_CANCELLED)).toBeNull();
  });
});

describe('App — OAuth callback handling', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.CONFIG_CANCELLED, 'true');
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('clears a generic OAuth error from the URL without redirecting', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.history.pushState({}, '', '/?error=access_denied');

    render(<App />);

    expect(window.location.search).toBe('');
  });

  it('retries without prompt=none when a silent refresh requires interaction', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEYS.RETURN_URL, 'https://app.example.com/?prompt=none&foo=bar');
    window.history.pushState({}, '', '/?error=interaction_required');

    render(<App />);

    expect(localStorage.getItem(STORAGE_KEYS.RETURN_URL)).toBeNull();
  });

  it('opens the config dialog when the code verifier is missing on callback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.history.pushState({}, '', '/?code=abc123&state=xyz');

    render(<App />);

    expect(screen.getByText('Configuration')).toBeInTheDocument();
  });

  it('exchanges the code for a token and stores it on a successful callback', async () => {
    localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, 'a-verifier');
    localStorage.setItem(STORAGE_KEYS.TENANT_ID, 'tenant-1');
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, 'client-1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'new-token', expires_in: 3600 }) })
    );
    window.history.pushState({}, '', '/?code=abc123&state=xyz');

    render(<App />);

    await waitFor(() => expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe('new-token'));
    expect(localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER)).toBeNull();
  });

  it('opens the config dialog and cleans up when the token exchange fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, 'a-verifier');
    localStorage.setItem(STORAGE_KEYS.RETURN_URL, 'https://app.example.com/return');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    window.history.pushState({}, '', '/?code=abc123&state=xyz');

    render(<App />);

    await waitFor(() => expect(screen.getByText('Configuration')).toBeInTheDocument());
    expect(localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.RETURN_URL)).toBeNull();
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TokenStatus from '../../src/components/TokenStatus';
import { STORAGE_KEYS } from '../../src/constants';

afterEach(() => {
  localStorage.clear();
});

describe('TokenStatus', () => {
  it('renders nothing when there is no access token', () => {
    const { container } = render(<TokenStatus />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Token valid" with a minutes-only countdown for a fresh token', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'token');
    // +30s buffer so a few ms of test/render latency can't floor this down to 9m.
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(Date.now() + 10 * 60 * 1000 + 30 * 1000));

    render(<TokenStatus />);

    await waitFor(() => expect(screen.getByText('Token valid')).toBeInTheDocument());
    expect(screen.getByText('(10m)')).toBeInTheDocument();
  });

  it('shows an hours-and-minutes countdown', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'token');
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(Date.now() + 3 * 60 * 60 * 1000 + 5 * 60 * 1000));

    render(<TokenStatus />);

    await waitFor(() => expect(screen.getByText('Token valid')).toBeInTheDocument());
    expect(screen.getByText('(3h 5m)')).toBeInTheDocument();
  });

  it('shows a days-and-hours countdown', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'token');
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(Date.now() + 30 * 60 * 60 * 1000 + 10 * 60 * 1000));

    render(<TokenStatus />);

    await waitFor(() => expect(screen.getByText('Token valid')).toBeInTheDocument());
    expect(screen.getByText('(1d 6h)')).toBeInTheDocument();
  });

  it('shows "Token expired" and an Expired countdown once past expiry', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'token');
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(Date.now() - 1000));

    render(<TokenStatus />);

    await waitFor(() => expect(screen.getByText('Token expired')).toBeInTheDocument());
    expect(screen.getByText('(Expired)')).toBeInTheDocument();
  });

  it('shows "Token expiring soon" and surfaces an error from the automatic refresh attempt', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'token');
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(Date.now() + 2 * 60 * 1000));

    render(<TokenStatus />);

    await waitFor(() => expect(screen.getByText('Token expiring soon')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText('OAuth configuration missing. Please reconfigure the application.')).toBeInTheDocument()
    );
  });

  it('shows a configuration error when the refresh button is clicked without client/tenant IDs set', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'token');
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(Date.now() + 60 * 60 * 1000));

    render(<TokenStatus />);

    await waitFor(() => expect(screen.getByText('Token valid')).toBeInTheDocument());
    screen.getByTitle('Refresh token').click();

    await waitFor(() =>
      expect(screen.getByText('OAuth configuration missing. Please reconfigure the application.')).toBeInTheDocument()
    );
  });
});

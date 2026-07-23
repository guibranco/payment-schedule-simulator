import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConfigDialog from '../../src/components/ConfigDialog';
import { STORAGE_KEYS } from '../../src/constants';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('API Base URL'), { target: { value: 'https://api.example.com' } });
  fireEvent.change(screen.getByLabelText('Tenant ID'), { target: { value: 'tenant-123' } });
  fireEvent.change(screen.getByLabelText('Client ID'), { target: { value: 'client-456' } });
}

describe('ConfigDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ConfigDialog isOpen={false} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders empty fields with the redirect URI when opened with no saved config', () => {
    render(<ConfigDialog isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByLabelText('API Base URL')).toHaveValue('');
    expect(screen.getByLabelText('Tenant ID')).toHaveValue('');
    expect(screen.getByLabelText('Client ID')).toHaveValue('');
    expect(screen.getByLabelText('Environment')).toHaveValue('prod');
    expect(screen.getByText(window.location.origin)).toBeInTheDocument();
  });

  it('pre-fills the form from a saved endpoint that includes a port', () => {
    localStorage.setItem(STORAGE_KEYS.API_ENDPOINT, 'https://api.example.com:8080');
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, 'saved-client');
    localStorage.setItem(STORAGE_KEYS.TENANT_ID, 'saved-tenant');
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, 'int');

    render(<ConfigDialog isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByLabelText('API Base URL')).toHaveValue('https://api.example.com');
    expect(screen.getByLabelText('Port (Optional)')).toHaveValue(8080);
    expect(screen.getByLabelText('Client ID')).toHaveValue('saved-client');
    expect(screen.getByLabelText('Tenant ID')).toHaveValue('saved-tenant');
    expect(screen.getByLabelText('Environment')).toHaveValue('int');
  });

  it('falls back to the raw saved endpoint when it is not a valid URL', () => {
    localStorage.setItem(STORAGE_KEYS.API_ENDPOINT, 'not-a-valid-url');

    render(<ConfigDialog isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByLabelText('API Base URL')).toHaveValue('not-a-valid-url');
    expect(screen.getByLabelText('Port (Optional)')).toHaveValue(null);
  });

  it('shows the environment-suffixed scope for a non-prod environment', () => {
    render(<ConfigDialog isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Environment'), { target: { value: 'stg' } });

    expect(
      screen.getByText('api://schedule-api-stg.outsurance.ie/user_impersonation')
    ).toBeInTheDocument();
  });

  it('sets the cancellation flag and closes when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<ConfigDialog isOpen={true} onClose={onClose} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(localStorage.getItem(STORAGE_KEYS.CONFIG_CANCELLED)).toBe('true');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sets the cancellation flag and closes when the header close button is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<ConfigDialog isOpen={true} onClose={onClose} onSave={vi.fn()} />);

    const closeButton = container.querySelector('button.text-gray-400') as HTMLButtonElement;
    fireEvent.click(closeButton);

    expect(localStorage.getItem(STORAGE_KEYS.CONFIG_CANCELLED)).toBe('true');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('logs an error and does not save or close when the base URL is invalid', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<ConfigDialog isOpen={true} onClose={onClose} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('API Base URL'), { target: { value: 'not a url' } });
    fireEvent.change(screen.getByLabelText('Tenant ID'), { target: { value: 'tenant-123' } });
    fireEvent.change(screen.getByLabelText('Client ID'), { target: { value: 'client-456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Invalid URL:', expect.anything()));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.API_ENDPOINT)).toBeNull();
  });

  it('saves the config, applies the port, and hands off to onSave/onClose on valid submit', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<ConfigDialog isOpen={true} onClose={onClose} onSave={onSave} />);

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Port (Optional)'), { target: { value: '9090' } });
    fireEvent.change(screen.getByLabelText('Environment'), { target: { value: 'stg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('https://api.example.com'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(STORAGE_KEYS.API_ENDPOINT)).toBe('https://api.example.com:9090/');
    expect(localStorage.getItem(STORAGE_KEYS.CLIENT_ID)).toBe('client-456');
    expect(localStorage.getItem(STORAGE_KEYS.TENANT_ID)).toBe('tenant-123');
    expect(localStorage.getItem(STORAGE_KEYS.ENVIRONMENT)).toBe('stg');
    expect(localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER)).not.toBeNull();
  });
});

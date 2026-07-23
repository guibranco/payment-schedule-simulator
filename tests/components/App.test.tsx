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

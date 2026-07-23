import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Modal from '../../src/components/Modal';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Hidden">
        <p>content</p>
      </Modal>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title and children when open', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="My Title">
        <p>Body content</p>
      </Modal>
    );

    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="My Title">
        <p>Body content</p>
      </Modal>
    );

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('copies the modal content to the clipboard and shows a check icon', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <Modal isOpen onClose={vi.fn()} title="My Title">
        <p>Body content</p>
      </Modal>
    );

    fireEvent.click(screen.getByTitle('Copy to clipboard'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Body content'));
  });

  it('does nothing when there is no modal content to copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <Modal isOpen onClose={vi.fn()} title="My Title">
        {null}
      </Modal>
    );

    fireEvent.click(screen.getByTitle('Copy to clipboard'));

    expect(writeText).not.toHaveBeenCalled();
  });
});

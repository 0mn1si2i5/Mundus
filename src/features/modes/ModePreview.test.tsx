import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModePreview } from './ModePreview';

afterEach(() => cleanup());

describe('ModePreview', () => {
  function setup() {
    const onClose = vi.fn();
    const onEnter = vi.fn();
    const utils = render(
      <ModePreview
        locale="en"
        modeId="antipodes"
        onClose={onClose}
        onEnter={onEnter}
      />,
    );
    return { onClose, onEnter, ...utils };
  }

  it('shows catalog metadata without activating the mode', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Other Side' })).toBeVisible();
    expect(screen.getByText(/If you passed through Earth/)).toBeVisible();
    expect(screen.getByText(/Choose a point and pass through/)).toBeVisible();
    expect(screen.getByText(/GeoNames major cities/)).toBeVisible();
    expect(screen.getByText('Stable')).toBeVisible();
  });

  it('enters and closes via the action buttons', () => {
    const { onEnter, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Enter observation' }));
    expect(onEnter).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes with Escape', () => {
    const { onClose } = setup();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('traps focus within the dialog', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    const enter = screen.getByRole('button', { name: 'Enter observation' });
    const close = screen.getByRole('button', { name: 'Close preview' });

    expect(enter).toHaveFocus();

    close.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(enter).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(close).toHaveFocus();
  });

  it('shows coming soon and no enter action for an unreleased mode', () => {
    render(
      <ModePreview
        locale="en"
        modeId="historical-echoes"
        onClose={vi.fn()}
        onEnter={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Historical Echoes' }),
    ).toBeVisible();
    expect(screen.getByText('Coming soon')).toBeVisible();
    expect(screen.getByText('Experimental')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Enter observation' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close preview' })).toHaveFocus();
  });
});

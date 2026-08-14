import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModeAtlas } from './ModeAtlas';
import type { ModeId } from './modeRegistry';

afterEach(() => cleanup());

describe('ModeAtlas', () => {
  function renderAtlas(activeMode: ModeId | null = null) {
    const onSelectMode = vi.fn();
    const onClose = vi.fn();
    const utils = render(
      <ModeAtlas
        locale="en"
        activeMode={activeMode}
        onSelectMode={onSelectMode}
        onClose={onClose}
      />,
    );
    return { onSelectMode, onClose, ...utils };
  }

  it('offers Featured, New, All, and Archived views', () => {
    renderAtlas();
    for (const name of ['Featured', 'New', 'All', 'Archived']) {
      expect(screen.getByRole('tab', { name })).toBeVisible();
    }
  });

  it('lists the three featured modes by default', () => {
    renderAtlas();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Other Side')).toBeVisible();
    expect(screen.getByText('Development, Unpacked')).toBeVisible();
    expect(screen.getByText('Sunline')).toBeVisible();
  });

  it('shows an empty archived view', () => {
    renderAtlas();
    fireEvent.click(screen.getByRole('tab', { name: 'Archived' }));
    expect(screen.getByText('No matching observations.')).toBeVisible();
  });

  it('filters the list by search text', () => {
    renderAtlas();
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search observations' }),
      { target: { value: 'Sunline' } },
    );
    expect(screen.getByText('Sunline')).toBeVisible();
    expect(screen.queryByText('Other Side')).not.toBeInTheDocument();
  });

  it('filters the list by tag', () => {
    renderAtlas();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    expect(screen.getByText('Sunline')).toBeVisible();
    expect(screen.queryByText('Other Side')).not.toBeInTheDocument();
  });

  it('marks the active mode as viewing and disables it', () => {
    renderAtlas('antipodes');
    expect(screen.getByRole('button', { name: 'Viewing' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Preview' })).toHaveLength(2);
  });

  it('offers a preview for every mode when in the lobby', () => {
    renderAtlas(null);
    expect(screen.getAllByRole('button', { name: 'Preview' })).toHaveLength(3);
    expect(
      screen.queryByRole('button', { name: 'Viewing' }),
    ).not.toBeInTheDocument();
  });

  it('requests a preview for the selected mode', () => {
    const { onSelectMode } = renderAtlas();
    const preview = screen.getAllByRole('button', { name: 'Preview' })[0]!;
    fireEvent.click(preview);
    expect(onSelectMode).toHaveBeenCalled();
  });

  it('closes with Escape', () => {
    const { onClose } = renderAtlas();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ExhibitLobby } from './ExhibitLobby';

afterEach(() => cleanup());

describe('ExhibitLobby', () => {
  it('renders the lobby heading and bilingual description', () => {
    const { unmount } = render(
      <ExhibitLobby locale="en" onSelectPreview={vi.fn()} />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Choose an observation' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Turn Earth, choose a place, then enter a way of seeing.',
      ),
    ).toBeVisible();
    unmount();

    render(<ExhibitLobby locale="zh" onSelectPreview={vi.fn()} />);
    expect(
      screen.getByRole('heading', { level: 1, name: '选择一种观察' }),
    ).toBeVisible();
  });

  it('renders only the curated featured modes as one semantic list', () => {
    render(<ExhibitLobby locale="en" onSelectPreview={vi.fn()} />);
    expect(
      screen.getByRole('list', { name: 'Observation modes' }),
    ).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Other Side/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Development/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sunline/ })).toBeVisible();
  });

  it('requests a preview for the selected mode without activating it', () => {
    const onSelectPreview = vi.fn();
    render(<ExhibitLobby locale="en" onSelectPreview={onSelectPreview} />);
    fireEvent.click(screen.getByRole('button', { name: /Sunline/ }));
    expect(onSelectPreview).toHaveBeenCalledWith('sunline');
  });

  it('keeps non-featured catalog views out of the lobby orbit', () => {
    render(<ExhibitLobby locale="en" onSelectPreview={vi.fn()} />);
    expect(screen.getByText('New')).toBeVisible();
  });

  it('disables orbit parallax under reduced motion', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/features/modes/ExhibitLobby.module.css'),
      'utf8',
    );
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/u);
    expect(css).toMatch(/transition:\s*none/u);
  });
});

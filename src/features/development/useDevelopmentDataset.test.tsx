import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDevelopmentDataset } from './developmentData';
import {
  resetDevelopmentDatasetStore,
  useDevelopmentDataset,
} from './useDevelopmentDataset';

vi.mock('./developmentData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./developmentData')>();
  return { ...actual, loadDevelopmentDataset: vi.fn() };
});

describe('useDevelopmentDataset', () => {
  beforeEach(() => {
    resetDevelopmentDatasetStore();
    vi.mocked(loadDevelopmentDataset).mockReset();
  });

  afterEach(() => {
    cleanup();
    resetDevelopmentDatasetStore();
  });

  it('shares one import across consumers and caches it for reuse', async () => {
    vi.mocked(loadDevelopmentDataset).mockResolvedValue({} as never);
    const first = renderHook(() => useDevelopmentDataset(true));
    const second = renderHook(() => useDevelopmentDataset(true));
    expect(loadDevelopmentDataset).toHaveBeenCalledTimes(1);

    await act(async () => {});
    expect(first.result.current.status).toBe('ready');
    expect(second.result.current.status).toBe('ready');

    first.unmount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    const third = renderHook(() => useDevelopmentDataset(true));
    expect(third.result.current.status).toBe('ready');
    expect(loadDevelopmentDataset).toHaveBeenCalledTimes(1);
  });

  it('turns a real chunk failure into a retryable error without faking an abort', async () => {
    vi.mocked(loadDevelopmentDataset).mockRejectedValueOnce(
      new Error('chunk failed'),
    );
    const first = renderHook(() => useDevelopmentDataset(true));
    await act(async () => {});
    expect(first.result.current.status).toBe('error');

    vi.mocked(loadDevelopmentDataset).mockResolvedValueOnce({} as never);
    await act(async () => {
      const state = first.result.current;
      if (state.status === 'error') state.retry();
    });
    await act(async () => {});
    expect(first.result.current.status).toBe('ready');
    expect(loadDevelopmentDataset).toHaveBeenCalledTimes(2);
  });

  it('returns to idle in the lobby without registering a consumer', () => {
    const { result } = renderHook(() => useDevelopmentDataset(false));
    expect(result.current).toEqual({ status: 'idle', data: null });
    expect(loadDevelopmentDataset).not.toHaveBeenCalled();
  });
});

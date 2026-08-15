import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetGeoNamesCityIndex,
  setGeoNamesCityImporterForTests,
} from './geonamesCities';
import {
  resetGeoNamesCityIndexStore,
  useGeoNamesCityIndex,
} from './useGeoNamesCityIndex';

const indexFixture = {
  formatVersion: 2,
  strings: ['Beijing', '北京', 'China', 'CN', '中国'],
  rows: [
    [1816670, 3990750, 11639723, 11716620, 0, 3, 0, 1, 2, 4, null, null, [], 0],
  ],
};

function deferredImporter() {
  const calls: {
    signal: AbortSignal;
    promise: Promise<{ default: unknown }>;
    resolve: (value: { default: unknown }) => void;
    reject: (reason?: unknown) => void;
  }[] = [];
  const importer = vi.fn((signal?: AbortSignal) => {
    let resolve!: (value: { default: unknown }) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<{ default: unknown }>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const activeSignal = signal ?? new AbortController().signal;
    activeSignal.addEventListener('abort', () => {
      reject(new DOMException('aborted', 'AbortError'));
    });
    calls.push({ signal: activeSignal, promise, resolve, reject });
    return promise;
  });
  return { importer, calls };
}

function flushDeferredAbort() {
  return new Promise<void>((resolve) => setTimeout(resolve, 5));
}

describe('useGeoNamesCityIndex', () => {
  beforeEach(() => {
    resetGeoNamesCityIndexStore();
    resetGeoNamesCityIndex();
  });

  afterEach(() => {
    cleanup();
    resetGeoNamesCityIndexStore();
    resetGeoNamesCityIndex();
  });

  it('shares one request across consumers and does not abort while one remains', async () => {
    const { importer, calls } = deferredImporter();
    setGeoNamesCityImporterForTests(importer);

    const first = renderHook(() => useGeoNamesCityIndex(true));
    const second = renderHook(() => useGeoNamesCityIndex(true));

    expect(importer).toHaveBeenCalledTimes(1);
    expect(calls[0]!.signal.aborted).toBe(false);
    expect(first.result.current.status).toBe('loading');
    expect(second.result.current.status).toBe('loading');

    first.unmount();
    await act(async () => {
      await flushDeferredAbort();
    });
    expect(calls[0]!.signal.aborted).toBe(false);
    expect(importer).toHaveBeenCalledTimes(1);

    await act(async () => {
      calls[0]!.resolve({ default: indexFixture });
    });
    expect(second.result.current.status).toBe('ready');
    expect(
      (second.result.current as { data: readonly unknown[] }).data,
    ).toHaveLength(1);
  });

  it('aborts only when the last consumer leaves and retries cleanly on re-entry', async () => {
    const { importer, calls } = deferredImporter();
    setGeoNamesCityImporterForTests(importer);

    const first = renderHook(() => useGeoNamesCityIndex(true));
    expect(first.result.current.status).toBe('loading');

    first.unmount();
    await act(async () => {
      await flushDeferredAbort();
    });
    expect(calls[0]!.signal.aborted).toBe(true);

    const second = renderHook(() => useGeoNamesCityIndex(true));
    expect(second.result.current.status).toBe('loading');
    expect(importer).toHaveBeenCalledTimes(2);
    expect(calls[1]!.signal.aborted).toBe(false);

    // The aborted first request's rejection must never surface as a failure.
    await act(async () => {
      await calls[0]!.promise.catch(() => undefined);
    });
    expect(second.result.current.status).toBe('loading');
    expect(calls[1]!.signal.aborted).toBe(false);
  });

  it('caches a successful index and reuses it across mode switches', async () => {
    const { importer, calls } = deferredImporter();
    setGeoNamesCityImporterForTests(importer);

    const first = renderHook(() => useGeoNamesCityIndex(true));
    await act(async () => {
      calls[0]!.resolve({ default: indexFixture });
    });
    expect(first.result.current.status).toBe('ready');

    first.unmount();
    await act(async () => {
      await flushDeferredAbort();
    });

    const second = renderHook(() => useGeoNamesCityIndex(true));
    expect(second.result.current.status).toBe('ready');
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('recovers both consumers when a real failure is retried from one of them', async () => {
    const { importer, calls } = deferredImporter();
    setGeoNamesCityImporterForTests(importer);

    const first = renderHook(() => useGeoNamesCityIndex(true));
    const second = renderHook(() => useGeoNamesCityIndex(true));

    await act(async () => {
      calls[0]!.reject(new Error('offline'));
    });
    expect(first.result.current.status).toBe('error');
    expect(second.result.current.status).toBe('error');

    await act(async () => {
      const state = first.result.current;
      if (state.status === 'error') state.retry();
    });
    expect(first.result.current.status).toBe('loading');
    expect(second.result.current.status).toBe('loading');
    expect(importer).toHaveBeenCalledTimes(2);

    await act(async () => {
      calls[1]!.resolve({ default: indexFixture });
    });
    expect(first.result.current.status).toBe('ready');
    expect(second.result.current.status).toBe('ready');
  });
});

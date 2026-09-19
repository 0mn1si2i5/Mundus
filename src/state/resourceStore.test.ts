import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createResourceStore } from './resourceStore';

function deferredLoad() {
  const signals: AbortSignal[] = [];
  const load = vi.fn((signal: AbortSignal) => {
    signals.push(signal);
    let resolve!: (value: string) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    signal.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    });
    return { promise, resolve, reject };
  });
  return { load, signals };
}

describe('createResourceStore', () => {
  let store: ReturnType<typeof createResourceStore<string>>;
  let harness: ReturnType<typeof deferredLoad>;

  beforeEach(() => {
    vi.useFakeTimers();
    harness = deferredLoad();
    store = createResourceStore<string>(
      (signal) => harness.load(signal).promise,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    store.reset();
  });

  it('starts one shared load for the first consumer and reuses it for later ones', () => {
    store.register();
    store.register();
    expect(harness.load).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ status: 'loading', data: null });
    expect(harness.signals[0]?.aborted).toBe(false);
  });

  it('does not abort while another consumer remains', async () => {
    store.register();
    store.register();
    store.unregister();
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.signals[0]?.aborted).toBe(false);

    harness.load.mock.results[0]?.value.resolve('cities');
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toEqual({ status: 'ready', data: 'cities' });
  });

  it('aborts a pending load only when the last consumer leaves and returns to idle', async () => {
    store.register();
    store.unregister();
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.signals[0]?.aborted).toBe(true);
    expect(store.getSnapshot()).toEqual({ status: 'idle', data: null });

    // An abort rejection must not surface as a data failure.
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toEqual({ status: 'idle', data: null });

    // A later consumer starts a fresh request.
    store.register();
    expect(harness.load).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).toEqual({ status: 'loading', data: null });
  });

  it('reuses a completed result without a second request', async () => {
    store.register();
    harness.load.mock.results[0]?.value.resolve('cities');
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toEqual({ status: 'ready', data: 'cities' });

    store.unregister();
    store.register();
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.load).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ status: 'ready', data: 'cities' });
  });

  it('turns a real failure into a retryable error and clears it on retry', async () => {
    store.register();
    harness.load.mock.results[0]?.value.reject(new Error('offline'));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot().status).toBe('error');

    store.retry();
    expect(harness.load).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).toEqual({ status: 'loading', data: null });
    harness.load.mock.results[1]?.value.resolve('cities');
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toEqual({ status: 'ready', data: 'cities' });
  });

  it('lets the explicit idle load start a request for a manual consumer', async () => {
    store.load();
    expect(harness.load).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ status: 'loading', data: null });
    store.unregister();
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.signals[0]?.aborted).toBe(true);
  });
});

/**
 * A small ref-counted store for a lazy, shared resource load.
 *
 * The app renders two consumers of the same mode resource at once (the globe
 * presentation and the mode experience). A resource is loaded once, its result
 * is cached for reuse, and a failure can be retried. While any consumer
 * remains mounted and enabled, an in-flight request is never aborted. When the
 * last consumer leaves, a still-pending request is cancelled, and an abort is
 * never surfaced as a user-visible data failure.
 *
 * The abort is deferred to the next task so that React StrictMode's repeated
 * mount/cleanup cycle can reclaim the same in-flight request instead of
 * aborting and restarting it. A load that cannot be cancelled (such as a
 * dynamic import chunk) simply ignores the signal; the store still proves
 * equivalent cleanup by discarding a result that resolves after the last
 * consumer left and by allowing retry.
 */
export type ResourceLoadState<T> =
  | { status: 'idle'; data: null }
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: T }
  | { status: 'error'; data: null; retry: () => void };

export interface ResourceStore<T> {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ResourceLoadState<T>;
  register(): void;
  unregister(): void;
  retry(): void;
  load(): void;
  reset(): void;
}

export function createResourceStore<T>(
  load: (signal: AbortSignal) => Promise<T>,
): ResourceStore<T> {
  let state: ResourceLoadState<T> = { status: 'idle', data: null };
  let consumers = 0;
  let controller: AbortController | null = null;
  let abortTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) listener();
  }

  function start() {
    if (state.status === 'ready' || state.status === 'loading') return;
    const current = new AbortController();
    controller = current;
    state = { status: 'loading', data: null };
    emit();
    void load(current.signal).then(
      (data) => {
        if (controller === current) {
          controller = null;
          state = { status: 'ready', data };
          emit();
        }
      },
      (error: unknown) => {
        if (controller === current) {
          controller = null;
          state = isAbortError(error)
            ? { status: 'idle', data: null }
            : { status: 'error', data: null, retry };
          emit();
        }
      },
    );
  }

  function retry() {
    start();
  }

  function loadResource() {
    start();
  }

  function register() {
    if (abortTimer) {
      clearTimeout(abortTimer);
      abortTimer = null;
    }
    consumers += 1;
    start();
  }

  function unregister() {
    consumers -= 1;
    if (consumers <= 0) {
      consumers = 0;
      if (abortTimer) clearTimeout(abortTimer);
      abortTimer = setTimeout(() => {
        abortTimer = null;
        if (consumers > 0 || !controller) return;
        const aborted = controller;
        controller = null;
        aborted.abort();
        if (state.status === 'loading') {
          state = { status: 'idle', data: null };
          emit();
        }
      }, 0);
    }
  }

  function reset() {
    consumers = 0;
    if (abortTimer) {
      clearTimeout(abortTimer);
      abortTimer = null;
    }
    if (controller) {
      controller.abort();
      controller = null;
    }
    state = { status: 'idle', data: null };
    emit();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    register,
    unregister,
    retry,
    load: loadResource,
    reset,
  };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

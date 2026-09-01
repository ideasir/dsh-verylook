/**
 * Minimal snapshot store — replaces `@deepseek-ai/dsh-client-runtime/client`'s
 * `createSnapshotStore` for DSH 0.1.2+ (which no longer seeds that module).
 * Only the subset used by looklook is implemented.
 */
export interface SnapshotStore<T> {
  getSnapshot(): T
  set(state: T): void
  subscribe(fn: () => void): () => void
}

export function createSnapshotStore<T>(init: T): SnapshotStore<T> {
  let state = init
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    set: (next: T) => {
      state = next
      listeners.forEach(fn => fn())
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }
}
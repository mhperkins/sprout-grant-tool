/**
 * storage.js
 *
 * Local-dev polyfill for the window.storage API used by Claude.ai artifacts.
 * Mirrors the same key-value interface so the Grant Manager component runs
 * identically in both Claude.ai and a local Next.js dev environment.
 *
 * When running inside Claude.ai, window.storage is already provided by the
 * runtime — this polyfill is a no-op in that context.
 *
 * Data is stored in localStorage under the same keys the component uses,
 * so data persists across page reloads in local dev.
 */

const localStorageAdapter = {
  /**
   * Get a value by key.
   * @returns {{ key: string, value: string } | null}
   */
  get: async (key, _shared = false) => {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return null;
      return { key, value, shared: _shared };
    } catch {
      return null;
    }
  },

  /**
   * Set a value by key.
   * @returns {{ key: string, value: string } | null}
   */
  set: async (key, value, _shared = false) => {
    try {
      localStorage.setItem(key, value);
      return { key, value, shared: _shared };
    } catch {
      return null;
    }
  },

  /**
   * Delete a value by key.
   * @returns {{ key: string, deleted: boolean } | null}
   */
  delete: async (key, _shared = false) => {
    try {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: _shared };
    } catch {
      return null;
    }
  },

  /**
   * List all keys, optionally filtered by prefix.
   * @returns {{ keys: string[], prefix?: string } | null}
   */
  list: async (prefix = undefined, _shared = false) => {
    try {
      const allKeys = Object.keys(localStorage);
      const keys = prefix
        ? allKeys.filter((k) => k.startsWith(prefix))
        : allKeys;
      return { keys, prefix, shared: _shared };
    } catch {
      return { keys: [] };
    }
  },
};

/**
 * Call this once at app startup to install the polyfill.
 * Safe to call multiple times — only installs if window.storage is absent.
 */
export function initStorage() {
  if (typeof window !== "undefined" && !window.storage) {
    window.storage = localStorageAdapter;
  }
}

export default localStorageAdapter;

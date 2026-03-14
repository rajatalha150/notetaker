type ChromeMessageListener = (
  message: unknown,
  sender?: unknown,
  sendResponse?: (response?: unknown) => void
) => void | boolean;

if (typeof window !== 'undefined') {
  const scope = window as any;

  if (!scope.chrome) scope.chrome = {};

  const listeners = new Set<ChromeMessageListener>();

  if (!scope.chrome.storage) {
    scope.chrome.storage = {};
  }

  if (!scope.chrome.storage.local) {
    scope.chrome.storage.local = {
      get: async (keys: unknown) => {
        const result: Record<string, unknown> = {};
        const readValue = (key: string) => {
          const value = localStorage.getItem(key);
          try {
            return value ? JSON.parse(value) : undefined;
          } catch {
            return value;
          }
        };

        if (typeof keys === 'string') {
          result[keys] = readValue(keys);
        } else if (Array.isArray(keys)) {
          keys.forEach((key) => {
            result[key] = readValue(key);
          });
        } else if (typeof keys === 'object' && keys !== null) {
          Object.keys(keys).forEach((key) => {
            const value = readValue(key);
            result[key] = value !== undefined ? value : (keys as Record<string, unknown>)[key];
          });
        }

        return result;
      },
      set: async (items: object) => {
        Object.entries(items).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });
      },
      remove: async (keys: string | string[]) => {
        if (typeof keys === 'string') {
          localStorage.removeItem(keys);
          return;
        }

        keys.forEach((key) => localStorage.removeItem(key));
      },
      clear: async () => {
        localStorage.clear();
      },
    };
  }

  if (!scope.chrome.runtime) {
    scope.chrome.runtime = {
      id: 'notetaker-electron-shim',
      isElectron: true,
      sendMessage: async (message: unknown) => {
        const sender = { id: 'notetaker-electron-shim', origin: window.location.origin };

        for (const listener of listeners) {
          const response = await new Promise<unknown>((resolve) => {
            let resolved = false;
            const sendResponse = (value?: unknown) => {
              resolved = true;
              resolve(value);
            };

            const maybeAsync = listener(message, sender, sendResponse);
            if (maybeAsync !== true && !resolved) {
              resolve(undefined);
            }
          });

          if (response !== undefined) {
            return response;
          }
        }

        return { ok: true };
      },
      onMessage: {
        addListener(listener: ChromeMessageListener) {
          listeners.add(listener);
        },
        removeListener(listener: ChromeMessageListener) {
          listeners.delete(listener);
        },
      },
      getURL: (path: string) => path,
      lastError: null,
    };
  }
}

type ChromeMessageListener = (
  message: unknown,
  sender?: unknown,
  sendResponse?: (response?: unknown) => void
) => void | boolean;

if (typeof window !== 'undefined') {
  const scope = window as any;

  if (!scope.chrome) scope.chrome = {};

  const listeners = new Set<ChromeMessageListener>();

  // Tracks the active recording ID on desktop (no background worker).
  // Set by useDesktopRecorder when a recording starts/stops.
  let _activeDesktopRecordingId: string | null = null;
  (scope as any).__setActiveDesktopRecordingId = (id: string | null) => {
    _activeDesktopRecordingId = id;
  };

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
        const msg = message as Record<string, unknown>;

        // Handle ADD_NOTE directly (no background worker on desktop)
        if (msg?.type === 'ADD_NOTE') {
          const activeId = _activeDesktopRecordingId;
          if (!activeId) return { error: 'Not recording' };
          const raw = localStorage.getItem('recordings');
          const recordings: any[] = raw ? JSON.parse(raw) : [];
          const idx = recordings.findIndex((r: any) => r.id === activeId);
          if (idx < 0) return { error: 'Recording not found' };
          const note = {
            id: crypto.randomUUID(),
            text: msg.text as string,
            timestamp: Date.now() - (recordings[idx]?.startedAt ?? Date.now()),
            createdAt: Date.now(),
          };
          if (!recordings[idx].notes) recordings[idx].notes = [];
          recordings[idx].notes.push(note);
          localStorage.setItem('recordings', JSON.stringify(recordings));
          return { note };
        }

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


export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
}

export interface DesktopRecordingSaveResult {
  filePath: string
  filename: string
  fileSize: number
}

declare global {
  interface Window {
    electron: {
      desktop: {
        listSources(): Promise<DesktopSource[]>
        saveRecording(filename: string, data: ArrayBuffer): Promise<DesktopRecordingSaveResult>
        readRecording(filePath: string): Promise<ArrayBuffer>
        deleteRecording(filePath: string): Promise<{ ok: true }>
      }
      ipcRenderer: {
        send(channel: string, data: unknown): void
        on(channel: string, func: (...args: unknown[]) => void): () => void
        invoke(channel: string, ...args: unknown[]): Promise<unknown>
      }
    }
  }
}

export {}

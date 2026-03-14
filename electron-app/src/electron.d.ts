export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
}

export interface DesktopSourceMetadata {
  sourceId: string
  sourceName: string
  windowTitle?: string
  windowClass?: string
  processName?: string
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
        getSourceById(id: string): Promise<DesktopSource | null>
        getSourceMetadataById(id: string): Promise<DesktopSourceMetadata | null>
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

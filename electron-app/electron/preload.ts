import { contextBridge, ipcRenderer } from 'electron'

const desktop = {
  listSources() {
    return ipcRenderer.invoke('get-sources') as Promise<Array<{ id: string; name: string; thumbnail: string }>>
  },
  getSourceById(id: string) {
    return ipcRenderer.invoke('get-source-by-id', { id }) as Promise<{ id: string; name: string; thumbnail: string } | null>
  },
  getSourceMetadataById(id: string) {
    return ipcRenderer.invoke('get-source-metadata-by-id', { id }) as Promise<{
      sourceId: string
      sourceName: string
      windowTitle?: string
      windowClass?: string
      processName?: string
    } | null>
  },
  getParticipantsBySourceId(id: string) {
    return ipcRenderer.invoke('get-participants-by-source-id', { id }) as Promise<{
      names: string[]
      method: 'native-ui' | 'none'
    }>
  },
  saveRecording(filename: string, data: ArrayBuffer) {
    return ipcRenderer.invoke('desktop-save-recording', { filename, data }) as Promise<{
      filePath: string
      filename: string
      fileSize: number
    }>
  },
  readRecording(filePath: string) {
    return ipcRenderer.invoke('desktop-read-recording', { filePath }) as Promise<ArrayBuffer>
  },
  deleteRecording(filePath: string) {
    return ipcRenderer.invoke('desktop-delete-recording', { filePath }) as Promise<{ ok: true }>
  },
}

contextBridge.exposeInMainWorld('electron', {
  desktop,
  ipcRenderer: {
    send(channel: string, data: any) {
      ipcRenderer.send(channel, data)
    },
    on(channel: string, func: (...args: any[]) => void) {
      const subscription = (_event: any, ...args: any[]) => func(...args)
      ipcRenderer.on(channel, subscription)
      return () => ipcRenderer.removeListener(channel, subscription)
    },
    invoke(channel: string, ...args: any[]) {
      return ipcRenderer.invoke(channel, ...args)
    }
  }
})

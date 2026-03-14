import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function getRecordingsDir() {
  return path.join(app.getPath('userData'), 'recordings')
}

async function ensureRecordingsDir() {
  const dir = getRecordingsDir()
  await mkdir(dir, { recursive: true })
  return dir
}

async function resolveRecordingPath(filename: string) {
  const dir = await ensureRecordingsDir()
  return path.join(dir, path.basename(filename))
}

function assertManagedRecordingPath(filePath: string) {
  const recordingsDir = path.resolve(getRecordingsDir())
  const resolved = path.resolve(filePath)

  if (!resolved.startsWith(`${recordingsDir}${path.sep}`)) {
    throw new Error('Refusing to access a file outside the recordings directory')
  }

  return resolved
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || '', 'electron-vite.svg'),
    width: 400,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#000000',
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Handle clean destruction
  win.on('closed', () => {
    win = null
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  await ensureRecordingsDir()
  createWindow()
})

// IPC Handlers
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] })
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
  }))
})

ipcMain.handle('desktop-save-recording', async (_event, payload: { filename: string; data: ArrayBuffer }) => {
  const filePath = await resolveRecordingPath(payload.filename)
  const buffer = Buffer.from(payload.data)

  await writeFile(filePath, buffer)

  const fileInfo = await stat(filePath)
  return {
    filePath,
    filename: path.basename(filePath),
    fileSize: fileInfo.size,
  }
})

ipcMain.handle('desktop-read-recording', async (_event, payload: { filePath: string }) => {
  const filePath = assertManagedRecordingPath(payload.filePath)
  const buffer = await readFile(filePath)
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
})

ipcMain.handle('desktop-delete-recording', async (_event, payload: { filePath: string }) => {
  const filePath = assertManagedRecordingPath(payload.filePath)
  await rm(filePath, { force: true })
  return { ok: true }
})

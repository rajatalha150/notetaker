import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
const execFileAsync = promisify(execFile)

interface NativeWindowMetadata {
  windowTitle?: string
  windowClass?: string
  processName?: string
}

interface ParticipantProbeResult {
  names: string[]
  method: 'native-ui' | 'none'
}

function serializeSource(source: Electron.DesktopCapturerSource) {
  return {
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
  }
}

function parseX11WindowId(sourceId: string) {
  const match = sourceId.match(/^window:(\d+):/)
  if (!match) return null

  const value = Number.parseInt(match[1], 10)
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  return `0x${value.toString(16)}`
}

function parseNativeWindowHandle(sourceId: string) {
  const match = sourceId.match(/^window:(\d+):/)
  if (!match) return null

  const value = Number.parseInt(match[1], 10)
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  return value
}

function parseXPropLine(output: string, key: string) {
  return output
    .split('\n')
    .find((line) => line.trimStart().startsWith(key))
    ?.trim()
}

function parseQuotedValues(line?: string) {
  if (!line) return []

  return Array.from(line.matchAll(/"([^"]+)"/g))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => !!value)
}

async function getLinuxWindowMetadata(sourceId: string): Promise<NativeWindowMetadata | null> {
  if (process.platform !== 'linux') {
    return null
  }

  const windowId = parseX11WindowId(sourceId)
  if (!windowId) {
    return null
  }

  try {
    const { stdout } = await execFileAsync('xprop', ['-id', windowId, 'WM_CLASS', '_NET_WM_NAME', 'WM_NAME'])
    const titleLine = parseXPropLine(stdout, '_NET_WM_NAME') ?? parseXPropLine(stdout, 'WM_NAME')
    const classLine = parseXPropLine(stdout, 'WM_CLASS')
    const [windowTitle] = parseQuotedValues(titleLine)
    const windowClass = parseQuotedValues(classLine).join(' ').trim() || undefined

    if (!windowTitle && !windowClass) {
      return null
    }

    return {
      windowTitle,
      windowClass,
    }
  } catch {
    return null
  }
}

async function getWindowsWindowMetadata(sourceId: string): Promise<NativeWindowMetadata | null> {
  if (process.platform !== 'win32') {
    return null
  }

  const windowHandle = parseNativeWindowHandle(sourceId)
  if (!windowHandle) {
    return null
  }

  const command = [
    `$handle = ${windowHandle}`,
    '$process = Get-Process | Where-Object { $_.MainWindowHandle -eq $handle } | Select-Object -First 1 ProcessName, MainWindowTitle',
    'if ($process) { $process | ConvertTo-Json -Compress }',
  ].join('; ')

  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command])
    const parsed = JSON.parse(stdout.trim()) as { ProcessName?: string; MainWindowTitle?: string }

    return {
      processName: parsed.ProcessName?.trim() || undefined,
      windowTitle: parsed.MainWindowTitle?.trim() || undefined,
    }
  } catch {
    return null
  }
}

async function getNativeWindowMetadata(sourceId: string): Promise<NativeWindowMetadata | null> {
  const windowsMetadata = await getWindowsWindowMetadata(sourceId)
  if (windowsMetadata) {
    return windowsMetadata
  }

  return getLinuxWindowMetadata(sourceId)
}

async function getWindowsParticipants(sourceId: string): Promise<ParticipantProbeResult> {
  if (process.platform !== 'win32') {
    return { names: [], method: 'none' }
  }

  const windowHandle = parseNativeWindowHandle(sourceId)
  if (!windowHandle) {
    return { names: [], method: 'none' }
  }

  // UI Automation traversal to collect visible element names near the active window tree
  const command = [
    '[void][System.Reflection.Assembly]::LoadWithPartialName("UIAutomationClient")',
    `$handle = ${windowHandle}`,
    '$root = [System.Windows.Automation.AutomationElement]::FromHandle($handle)',
    'if (-not $root) { return }',
    '$treeWalker = New-Object System.Windows.Automation.TreeWalker ([System.Windows.Automation.Condition]::TrueCondition)',
    'function Get-Names($node, $depth){',
    '  if (-not $node -or $depth -gt 4) { return @() }',
    '  $names = @()',
    '  if ($node.Current.Name) { $names += $node.Current.Name }',
    '  $child = $treeWalker.GetFirstChild($node)',
    '  while($child){',
    '    $names += Get-Names $child ($depth + 1)',
    '    $child = $treeWalker.GetNextSibling($child)',
    '  }',
    '  return $names',
    '}',
    '$all = Get-Names $root 0 | Where-Object { $_ -and $_.Length -gt 1 } | Select-Object -First 20',
    '$all | ConvertTo-Json -Compress',
  ].join('; ')

  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command])
    const parsed = JSON.parse(stdout.trim()) as string[]
    const names = Array.isArray(parsed) ? parsed : []
    return { names, method: names.length ? 'native-ui' : 'none' }
  } catch {
    return { names: [], method: 'none' }
  }
}

async function getNativeParticipants(sourceId: string): Promise<ParticipantProbeResult> {
  const winResult = await getWindowsParticipants(sourceId)
  if (winResult.method !== 'none') {
    return winResult
  }

  // Linux/macOS not implemented yet
  return { names: [], method: 'none' }
}

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
  return sources.map(serializeSource)
})

ipcMain.handle('get-source-by-id', async (_event, payload: { id: string }) => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] })
  const source = sources.find((entry) => entry.id === payload.id)
  return source ? serializeSource(source) : null
})

ipcMain.handle('get-source-metadata-by-id', async (_event, payload: { id: string }) => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] })
  const source = sources.find((entry) => entry.id === payload.id)
  if (!source) {
    return null
  }

  const metadata = await getNativeWindowMetadata(source.id)
  return {
    sourceId: source.id,
    sourceName: source.name,
    windowTitle: metadata?.windowTitle,
    windowClass: metadata?.windowClass,
    processName: metadata?.processName,
  }
})

ipcMain.handle('get-participants-by-source-id', async (_event, payload: { id: string }) => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] })
  const source = sources.find((entry) => entry.id === payload.id)
  if (!source) {
    return { names: [], method: 'none' }
  }

  return getNativeParticipants(source.id)
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

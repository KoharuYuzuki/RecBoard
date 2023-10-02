import { app, BrowserWindow, dialog, systemPreferences } from 'electron'
import { join, dirname } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPCMain } from '@common/ipc'
import { isFile, readFileAsString } from '@main/utils'
import { spawn } from 'child_process'
import { writeFile } from 'fs/promises'

let mainWindow: BrowserWindow

const appName = 'RecBoard'
const appVersion = app.getVersion()

const ipc = new IPCMain()

app.whenReady()
.then(() => {
  if (process.platform === 'darwin') {
    return requestMicPermission()
  } else {
    return Promise.resolve()
  }
})
.then(() => createWindow())
.then((window: BrowserWindow) => mainWindow = window)
.catch((e) => {
  console.error(e)
  dialog.showErrorBox('致命的なエラーが発生しました\nアプリケーションを再起動してください', e.toString())
})

ipc.on('reclist:load', (_, reply) => {
  let data: { path: string, text: string }[] = []

  loadReclist()
  .then((_data) => data = _data)
  .catch(console.error)
  .finally(() => reply(data))
})

ipc.on('audio:save', ({ path, data }: { path: string, data: ArrayBuffer }, reply) => {
  const proc = spawn(
    'ffmpeg',
    [
      '-i', 'pipe:0',
      '-vn',
      '-ac', '1',
      '-ar', '48000',
      '-acodec', 'pcm_f32le',
      '-f', 'wav',
      'pipe:1'
    ]
  )
  const converted: Buffer[] = []

  proc.stdin.write(new Uint8Array(data))
  proc.stdin.end()

  proc.stdout.on('data', (data: Buffer) => {
    converted.push(data)
  })

  proc.on('close', (code) => {
    if (code !== 0) {
      reply(false)
      return
    }

    const buffer = Buffer.concat(converted)
    let result = false

    writeFile(path, buffer)
    .then(() => result = true)
    .catch(console.error)
    .finally(() => reply(result))
  })
})

function createWindow() {
  const minWidth  = 900
  const minHeight = 600

  const win = new BrowserWindow({
    width: minWidth,
    height: minHeight,
    minWidth: minWidth,
    minHeight: minHeight,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const promise =
    (is.dev && process.env['ELECTRON_RENDERER_URL']) ?
    win.loadURL(process.env['ELECTRON_RENDERER_URL']) :
    win.loadFile(join(__dirname, '../renderer/index.html'))

  return new Promise<BrowserWindow>((resolve, reject) => {
    promise
    .then(() => {
      if (is.dev) win.webContents.openDevTools()
      win.title = `${appName} v${appVersion}`
      resolve(win)
    })
    .catch(reject)
  })
}

function loadReclist () {
  let filePath = ''

  return new Promise<{ path: string, text: string }[]>((resolve, reject) => {
    dialog.showOpenDialog(mainWindow, {
      title: '収録リストを選択',
      filters: [
        {
          name: 'テキストファイル',
          extensions: ['txt']
        }
      ],
      properties: [
        'openFile',
        'showHiddenFiles'
      ]
    })
    .then((result) => {
      if (result.canceled || (result.filePaths.length <= 0)) {
        return Promise.reject('No file selected.')
      }

      filePath = result.filePaths[0]
      return isFile(filePath)
    })
    .then((result) => {
      if (!result) {
        return Promise.reject(`Selected path is not a file.\n=> ${filePath}`)
      }

      return readFileAsString(filePath)
    })
    .then((text) => {
      const dir = dirname(filePath)
      const data =
        text
        .split(new RegExp('(\r\n|\n|\r)', 'gm'))
        .map((str) => {
          const limit = 2
          const split = str.split(':', limit)
          return (split.length >= limit) ? {
            path: join(dir, `${split[0]}.wav`),
            text: split[1]
          } : null
        })
        .filter((val) => val !== null)

      resolve(data as { path: string, text: string }[])
    })
    .catch(reject)
  })
}

function requestMicPermission () {
  const result = systemPreferences.getMediaAccessStatus('microphone')
  if (result === 'granted') {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    systemPreferences.askForMediaAccess('microphone')
    .then((result) => {
      if (result === false) {
        dialog.showErrorBox(
          'マイクにアクセスできませんでした',
          'アクセス権限を付与してから、アプリケーションを再起動してください'
        )
      }

      resolve()
    })
    .catch(reject)
  })
}

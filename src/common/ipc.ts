import { ipcMain, ipcRenderer, WebContents } from 'electron'
import { randomUUID } from 'crypto'

type callback = (detail: any, reply: (detail?: any) => void) => void

interface Callbacks {
  [key: string]: Function
}

interface Message {
  id:     string
  type:   string
  detail: any
}

interface Window {
  webContents: WebContents
}

class IpcEvent extends Event {
  detail?: any

  constructor(type: string, detail: any) {
    super(type)
    this.detail = detail
  }
}

export class IPCMain extends EventTarget {
  ipc:       typeof ipcMain
  ids:       string[]
  callbacks: Callbacks

  constructor() {
    super()
    this.ipc = ipcMain
    this.ids = []
    this.callbacks = {}

    this.ipc.on('ipc-message', (event, message: Message) => {
      if (this.ids.includes(message.id)) {
        this.ids = this.ids.filter((id) => id !== message.id)
        this.dispatchEvent(new IpcEvent(message.id, message.detail))
      }
      else if (message.type in this.callbacks) {
        const callback = this.callbacks[message.type]
        const window = {webContents: event.sender}
        const reply = (detail: any = null) => this.send(window, message.type, detail, message.id)
        callback(message.detail, reply)
      }
    })
  }

  send(
    window: Window,
    type:   string,
    detail: any,
    id?:    string
  ): Promise<any> {
    return new Promise((resolve, _) => {
      if (id === undefined) {
        id = randomUUID()
        this.ids.push(id)
        this.addEventListener(id, (event: IpcEvent) => {
          resolve(event.detail)
        }, {once: true})
      } else {
        resolve(null)
      }

      window.webContents.send('ipc-message', {id, type, detail})
    })
  }

  on(type: string, callback: callback) {
    this.callbacks[type] = callback
  }
}

export class IPCRenderer extends EventTarget {
  ipc:       typeof ipcRenderer
  ids:       string[]
  callbacks: Callbacks

  constructor() {
    super()
    this.ipc = ipcRenderer
    this.ids = []
    this.callbacks = {}

    this.ipc.on('ipc-message', (_, message: Message) => {
      if (this.ids.includes(message.id)) {
        this.ids = this.ids.filter((id) => id !== message.id)
        this.dispatchEvent(new IpcEvent(message.id, message.detail))
      } else
      if (message.type in this.callbacks) {
        const callback = this.callbacks[message.type]
        const reply = (detail: any = null) => this.send(message.type, detail, message.id)
        callback(message.detail, reply)
      }
    })
  }

  send(
    type:   string,
    detail: any,
    id?:    string
  ): Promise<any> {
    return new Promise((resolve, _) => {
      if (id === undefined) {
        id = randomUUID()
        this.ids.push(id)
        this.addEventListener(id, (event: IpcEvent) => {
          resolve(event.detail)
        }, {once: true})
      } else {
        resolve(null)
      }

      this.ipc.send('ipc-message', {id, type, detail})
    })
  }

  on(type: string, callback: callback) {
    this.callbacks[type] = callback
  }
}

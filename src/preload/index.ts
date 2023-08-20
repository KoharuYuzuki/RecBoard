import { contextBridge } from 'electron'
import { IPCRenderer } from '@common/ipc'

const ipc = new IPCRenderer()

contextBridge.exposeInMainWorld('recBoard', {
  loadReclist() {
    return ipc.send('reclist:load', null)
  },
  saveAudio(path: string, data: ArrayBuffer) {
    return ipc.send('audio:save', { path, data })
  }
})

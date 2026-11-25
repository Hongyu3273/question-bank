import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api } from '../shared/ipc'

// 界面只能通过 window.api 访问这里列出的功能
const api: Api = {
  banks: {
    list: () => ipcRenderer.invoke(IPC.banksList)
  },
  settings: {
    getAll: () => ipcRenderer.invoke(IPC.settingsGetAll),
    set: (key, value) => ipcRenderer.invoke(IPC.settingsSet, key, value)
  },
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo)
  }
}

contextBridge.exposeInMainWorld('api', api)

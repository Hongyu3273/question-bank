import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api } from '../shared/ipc'

// 界面只能通过 window.api 访问这里列出的功能
const api: Api = {
  banks: {
    list: () => ipcRenderer.invoke(IPC.banksList),
    create: (name) => ipcRenderer.invoke(IPC.banksCreate, name),
    rename: (id, name) => ipcRenderer.invoke(IPC.banksRename, id, name),
    delete: (id) => ipcRenderer.invoke(IPC.banksDelete, id)
  },
  questions: {
    list: (bankId) => ipcRenderer.invoke(IPC.questionsList, bankId),
    get: (id) => ipcRenderer.invoke(IPC.questionsGet, id),
    create: (bankId, input) => ipcRenderer.invoke(IPC.questionsCreate, bankId, input),
    update: (id, input) => ipcRenderer.invoke(IPC.questionsUpdate, id, input),
    delete: (id) => ipcRenderer.invoke(IPC.questionsDelete, id),
    saveImage: (bankId, data, mimeType) => ipcRenderer.invoke(IPC.questionsSaveImage, bankId, data, mimeType)
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

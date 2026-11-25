import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api } from '../shared/ipc'

// 界面只能通过 window.api 访问这里列出的功能
const api: Api = {
  banks: {
    list: () => ipcRenderer.invoke(IPC.banksList),
    create: (name) => ipcRenderer.invoke(IPC.banksCreate, name),
    rename: (id, name) => ipcRenderer.invoke(IPC.banksRename, id, name),
    delete: (id) => ipcRenderer.invoke(IPC.banksDelete, id),
    reorder: (ids) => ipcRenderer.invoke(IPC.banksReorder, ids),
    setPriority: (bankId, priority, scope) => ipcRenderer.invoke(IPC.banksSetPriority, bankId, priority, scope),
    setStudyLimits: (bankIds, limits) => ipcRenderer.invoke(IPC.banksSetStudyLimits, bankIds, limits),
    resetProgress: (bankId) => ipcRenderer.invoke(IPC.banksResetProgress, bankId)
  },
  questions: {
    list: (bankId) => ipcRenderer.invoke(IPC.questionsList, bankId),
    get: (id) => ipcRenderer.invoke(IPC.questionsGet, id),
    create: (bankId, input) => ipcRenderer.invoke(IPC.questionsCreate, bankId, input),
    update: (id, input) => ipcRenderer.invoke(IPC.questionsUpdate, id, input),
    delete: (id) => ipcRenderer.invoke(IPC.questionsDelete, id),
    saveImage: (bankId, data, mimeType) => ipcRenderer.invoke(IPC.questionsSaveImage, bankId, data, mimeType),
    reorder: (bankId, ids) => ipcRenderer.invoke(IPC.questionsReorder, bankId, ids)
  },
  read: {
    list: (bankIds) => ipcRenderer.invoke(IPC.readList, bankIds),
    priorities: (bankIds) => ipcRenderer.invoke(IPC.readPriorities, bankIds)
  },
  recite: {
    start: (bankIds, priorities) => ipcRenderer.invoke(IPC.reciteStart, bankIds, priorities),
    next: () => ipcRenderer.invoke(IPC.reciteNext),
    prev: () => ipcRenderer.invoke(IPC.recitePrev),
    reshuffle: () => ipcRenderer.invoke(IPC.reciteReshuffle),
    status: () => ipcRenderer.invoke(IPC.reciteStatus)
  },
  study: {
    state: (bankIds, priorities) => ipcRenderer.invoke(IPC.studyState, bankIds, priorities),
    summary: (bankIds, priorities) => ipcRenderer.invoke(IPC.studySummary, bankIds, priorities),
    rate: (questionId, grade) => ipcRenderer.invoke(IPC.studyRate, questionId, grade),
    undo: () => ipcRenderer.invoke(IPC.studyUndo),
    extend: (kind, count) => ipcRenderer.invoke(IPC.studyExtend, kind, count),
    removeFromWrongBook: (questionId) => ipcRenderer.invoke(IPC.studyRemoveWrong, questionId)
  },
  io: {
    import: () => ipcRenderer.invoke(IPC.ioImport),
    resolveConflict: (token, choice) => ipcRenderer.invoke(IPC.ioResolveConflict, token, choice),
    exportBank: (bankId) => ipcRenderer.invoke(IPC.ioExportBank, bankId),
    saveTemplate: (kind) => ipcRenderer.invoke(IPC.ioSaveTemplate, kind),
    backup: () => ipcRenderer.invoke(IPC.ioBackup),
    restore: () => ipcRenderer.invoke(IPC.ioRestore)
  },
  settings: {
    getAll: () => ipcRenderer.invoke(IPC.settingsGetAll),
    set: (key, value) => ipcRenderer.invoke(IPC.settingsSet, key, value)
  },
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo),
    openDataFolder: () => ipcRenderer.invoke(IPC.appOpenDataFolder)
  }
}

contextBridge.exposeInMainWorld('api', api)

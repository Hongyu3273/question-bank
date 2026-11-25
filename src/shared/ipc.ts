// IPC 通道名与 window.api 的接口定义。
// 新增接口时三处同步修改:这里的 IPC 和 Api、preload/index.ts、main/ipc/index.ts。

import type {
  AppInfo,
  BankSummary,
  Question,
  QuestionInput,
  QuestionSummary,
  ReadBank,
  ReciteState,
  ReciteStatus,
  ImportResult,
  PriorityScope,
  PriorityStats,
  Settings
} from './types'

export const IPC = {
  banksList: 'banks:list',
  banksCreate: 'banks:create',
  banksRename: 'banks:rename',
  banksDelete: 'banks:delete',
  banksReorder: 'banks:reorder',
  banksSetPriority: 'banks:setPriority',
  questionsList: 'questions:list',
  questionsGet: 'questions:get',
  questionsCreate: 'questions:create',
  questionsUpdate: 'questions:update',
  questionsDelete: 'questions:delete',
  questionsSaveImage: 'questions:saveImage',
  questionsReorder: 'questions:reorder',
  readList: 'read:list',
  readPriorities: 'read:priorities',
  reciteStart: 'recite:start',
  reciteNext: 'recite:next',
  recitePrev: 'recite:prev',
  reciteReshuffle: 'recite:reshuffle',
  reciteStatus: 'recite:status',
  ioImport: 'io:import',
  ioResolveConflict: 'io:resolveConflict',
  ioExportBank: 'io:exportBank',
  ioSaveTemplate: 'io:saveTemplate',
  ioBackup: 'io:backup',
  ioRestore: 'io:restore',
  settingsGetAll: 'settings:getAll',
  settingsSet: 'settings:set',
  appInfo: 'app:info',
  appOpenDataFolder: 'app:openDataFolder'
} as const

export interface Api {
  banks: {
    list(): Promise<BankSummary[]>
    create(name: string): Promise<BankSummary>
    rename(id: string, name: string): Promise<void>
    /** 同时删除题库中的题目和图片 */
    delete(id: string): Promise<void>
    /** 按给定顺序重排全部题库 */
    reorder(ids: string[]): Promise<void>
    /** 批量设置题库的优先级(null 为清除),返回修改的题目数量 */
    setPriority(bankId: string, priority: string | null, scope: PriorityScope): Promise<number>
  }
  questions: {
    list(bankId: string): Promise<QuestionSummary[]>
    get(id: string): Promise<Question>
    create(bankId: string, input: QuestionInput): Promise<Question>
    update(id: string, input: QuestionInput): Promise<Question>
    delete(id: string): Promise<void>
    /** 保存粘贴或插入的图片,返回 Markdown 中使用的相对路径,如 images/ab12.png */
    saveImage(bankId: string, data: Uint8Array, mimeType: string): Promise<string>
    /** 按给定顺序重排题库内的题目 */
    reorder(bankId: string, ids: string[]): Promise<void>
  }
  read: {
    /** 按题库顺序返回所选题库的全部题目(含答案) */
    list(bankIds: string[]): Promise<ReadBank[]>
    /** 所选题库中各优先级的题目数量 */
    priorities(bankIds: string[]): Promise<PriorityStats>
  }
  recite: {
    /** 进入背题:勾选与上次相同则继续,否则重新洗牌;没有题目时返回 null */
    start(bankIds: string[], priorities: string[]): Promise<ReciteState | null>
    next(): Promise<ReciteState | null>
    prev(): Promise<ReciteState | null>
    reshuffle(): Promise<ReciteState | null>
    /** 当前进度(不改变会话),首页使用 */
    status(): Promise<ReciteStatus | null>
  }
  io: {
    /** 选择一个或多个题库文件(.zip / .md / .xlsx)并导入;每个题库一条结果 */
    import(): Promise<{ canceled: true } | { canceled: false; results: ImportResult[] }>
    /** 处理同名冲突 */
    resolveConflict(token: string, choice: 'overwrite' | 'saveAsNew' | 'skip'): Promise<ImportResult>
    exportBank(bankId: string): Promise<SaveResult>
    saveTemplate(kind: 'markdown' | 'excel'): Promise<SaveResult>
    backup(): Promise<SaveResult>
    /** 选择备份文件并替换全部数据;成功后界面需要重新加载 */
    restore(): Promise<{ canceled: true } | { canceled: false }>
  }
  settings: {
    getAll(): Promise<Settings>
    set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>
  }
  app: {
    info(): Promise<AppInfo>
    /** 在系统文件管理器中打开数据文件夹 */
    openDataFolder(): Promise<void>
  }
}

export type SaveResult = { canceled: true } | { canceled: false; path: string }

/** 图片在界面中的访问地址:qb-asset://<题库 id>/images/xxx.png */
export const ASSET_SCHEME = 'qb-asset'

export function assetUrl(bankId: string, relativePath: string): string {
  return `${ASSET_SCHEME}://${bankId}/${relativePath}`
}

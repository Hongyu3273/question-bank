// IPC 通道名与 window.api 的接口定义。
// 新增接口时三处同步修改:这里的 IPC 和 Api、preload/index.ts、main/ipc/index.ts。

import type {
  AppInfo,
  BankSummary,
  Question,
  QuestionInput,
  QuestionSummary,
  ReadBank,
  Grade,
  StudyLimits,
  StudyState,
  StudyStats,
  TodaySummary,
  AutoBackup,
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
  banksSetStudyLimits: 'banks:setStudyLimits',
  banksResetProgress: 'banks:resetProgress',
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
  studyState: 'study:state',
  studySummary: 'study:summary',
  studyRate: 'study:rate',
  studyUndo: 'study:undo',
  studyExtend: 'study:extend',
  studyRemoveWrong: 'study:removeWrong',
  studyWrongIds: 'study:wrongIds',
  studyStats: 'study:stats',
  ioAutoBackups: 'io:autoBackups',
  ioRestoreAuto: 'io:restoreAuto',
  appOpenLogFolder: 'app:openLogFolder',
  appLogError: 'app:logError',
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
    /** 设置一个或多个题库的每日新题数和复习上限 */
    setStudyLimits(bankIds: string[], limits: StudyLimits): Promise<void>
    /** 清除题库的学习进度 */
    resetProgress(bankId: string): Promise<void>
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
  /** 记忆曲线(今日任务) */
  study: {
    state(bankIds: string[], priorities: string[]): Promise<StudyState>
    summary(bankIds: string[], priorities: string[]): Promise<TodaySummary>
    /** 自评:1 不会,2 模糊,3 记住 */
    rate(questionId: string, grade: Grade): Promise<void>
    /** 撤销今天最后一次自评,返回那道题的 id */
    undo(): Promise<string | null>
    /** 再学几道新题,或提前复习几道明天的题 */
    extend(kind: 'new' | 'ahead', count: number): Promise<void>
    removeFromWrongBook(questionId: string): Promise<void>
    /** 错题本中所有题目的 id */
    wrongBookIds(): Promise<string[]>
    /** 首页的学习概况 */
    stats(): Promise<StudyStats>
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
    /** 自动备份列表,最新的在前 */
    autoBackups(): Promise<AutoBackup[]>
    /** 用某一份自动备份替换全部数据;成功后界面需要重新加载 */
    restoreAuto(name: string): Promise<void>
  }
  settings: {
    getAll(): Promise<Settings>
    set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>
  }
  app: {
    info(): Promise<AppInfo>
    /** 在系统文件管理器中打开数据文件夹 */
    openDataFolder(): Promise<void>
    /** 在系统文件管理器中打开日志文件夹 */
    openLogFolder(): Promise<void>
    /** 记录界面中发生的错误 */
    logError(message: string): Promise<void>
  }
}

export type SaveResult = { canceled: true } | { canceled: false; path: string }

/** 图片在界面中的访问地址:qb-asset://<题库 id>/images/xxx.png */
export const ASSET_SCHEME = 'qb-asset'

export function assetUrl(bankId: string, relativePath: string): string {
  return `${ASSET_SCHEME}://${bankId}/${relativePath}`
}

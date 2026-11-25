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
  Settings
} from './types'

export const IPC = {
  banksList: 'banks:list',
  banksCreate: 'banks:create',
  banksRename: 'banks:rename',
  banksDelete: 'banks:delete',
  questionsList: 'questions:list',
  questionsGet: 'questions:get',
  questionsCreate: 'questions:create',
  questionsUpdate: 'questions:update',
  questionsDelete: 'questions:delete',
  questionsSaveImage: 'questions:saveImage',
  readList: 'read:list',
  reciteStart: 'recite:start',
  reciteNext: 'recite:next',
  recitePrev: 'recite:prev',
  reciteReshuffle: 'recite:reshuffle',
  reciteStatus: 'recite:status',
  settingsGetAll: 'settings:getAll',
  settingsSet: 'settings:set',
  appInfo: 'app:info'
} as const

export interface Api {
  banks: {
    list(): Promise<BankSummary[]>
    create(name: string): Promise<BankSummary>
    rename(id: string, name: string): Promise<void>
    /** 同时删除题库中的题目和图片 */
    delete(id: string): Promise<void>
  }
  questions: {
    list(bankId: string): Promise<QuestionSummary[]>
    get(id: string): Promise<Question>
    create(bankId: string, input: QuestionInput): Promise<Question>
    update(id: string, input: QuestionInput): Promise<Question>
    delete(id: string): Promise<void>
    /** 保存粘贴或插入的图片,返回 Markdown 中使用的相对路径,如 images/ab12.png */
    saveImage(bankId: string, data: Uint8Array, mimeType: string): Promise<string>
  }
  read: {
    /** 按题库顺序返回所选题库的全部题目(含答案) */
    list(bankIds: string[]): Promise<ReadBank[]>
  }
  recite: {
    /** 进入背题:勾选与上次相同则继续,否则重新洗牌;没有题目时返回 null */
    start(bankIds: string[]): Promise<ReciteState | null>
    next(): Promise<ReciteState | null>
    prev(): Promise<ReciteState | null>
    reshuffle(): Promise<ReciteState | null>
    /** 当前进度(不改变会话),首页使用 */
    status(): Promise<ReciteStatus | null>
  }
  settings: {
    getAll(): Promise<Settings>
    set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>
  }
  app: {
    info(): Promise<AppInfo>
  }
}

/** 图片在界面中的访问地址:qb-asset://<题库 id>/images/xxx.png */
export const ASSET_SCHEME = 'qb-asset'

export function assetUrl(bankId: string, relativePath: string): string {
  return `${ASSET_SCHEME}://${bankId}/${relativePath}`
}

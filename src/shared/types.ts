// 主进程与界面共用的数据类型

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontSize = 's' | 'm' | 'l'
export type Language = 'zh-CN' | 'en'

/** 用户可修改的设置项 */
export interface Settings {
  theme: ThemeMode
  fontSize: FontSize
  language: Language
  /** 首页勾选的题库 id */
  selectedBankIds: string[]
  /** 看题模式上次读到的题目 id */
  readPosition: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 'm',
  language: 'zh-CN',
  selectedBankIds: [],
  readPosition: null
}

export interface BankSummary {
  id: string
  name: string
  questionCount: number
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/** 题目列表中的一项(不含答案) */
export interface QuestionSummary {
  id: string
  bankId: string
  title: string
  sortOrder: number
  /** 答案的纯文本摘要(一行) */
  snippet: string
  updatedAt: number
}

export interface Question {
  id: string
  bankId: string
  title: string
  sortOrder: number
  /** 答案,Markdown 格式;图片用相对路径 images/xxx.png */
  answerMd: string
  createdAt: number
  updatedAt: number
}

/** 看题模式:一个题库及其全部题目 */
export interface ReadBank {
  id: string
  name: string
  questions: Question[]
}

/** 背题模式当前状态 */
export interface ReciteState {
  question: Question
  bankName: string
  /** 本轮第几题(从 1 开始) */
  index: number
  /** 本轮题目总数 */
  total: number
  /** 第几轮 */
  round: number
  /** 刚刚完成一轮并重新洗牌 */
  roundCompleted: boolean
}

/** 首页显示的背题进度 */
export interface ReciteStatus {
  bankIds: string[]
  index: number
  total: number
  round: number
}

export interface QuestionInput {
  title: string
  answerMd: string
}

export interface AppInfo {
  version: string
  platform: string
}

/** 导入文件中发现的问题 */
export interface ImportIssue {
  code:
    | 'NO_QUESTIONS'
    | 'TITLE_EMPTY'
    | 'TITLE_TOO_LONG'
    | 'SEPARATOR_MISSING'
    | 'TEXT_BEFORE_SEPARATOR'
    | 'ANSWER_TOO_LONG'
    | 'IMAGE_MISSING'
    | 'EXCEL_HEADER_MISSING'
  /** 第几题(Markdown) */
  question?: number
  /** 第几行(Markdown 为文件行号) */
  line?: number
  /** 第几行(Excel) */
  row?: number
  detail?: string
}

/** 导入一个文件的结果 */
export type ImportResult =
  | { file: string; status: 'imported'; bankId: string; name: string; questionCount: number; replaced: boolean }
  | { file: string; status: 'conflict'; token: string; name: string; questionCount: number }
  | { file: string; status: 'invalid'; issues: ImportIssue[] }
  | { file: string; status: 'failed'; error: string }
  | { file: string; status: 'skipped'; name: string }

/** 字段长度限制,主进程校验与界面提示共用 */
export const LIMITS = {
  bankName: 50,
  questionTitle: 500,
  answer: 200_000,
  imageBytes: 10 * 1024 * 1024
} as const

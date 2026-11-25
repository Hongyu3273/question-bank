// 主进程与界面共用的数据类型

export type ReciteMode = 'today' | 'shuffle'
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
  /** 只看/只背这些优先级的题目;空数组表示全部 */
  priorityFilter: string[]
  /** 是否显示英文题干 */
  showEnglish: boolean
  /** 背题方式:今日任务(记忆曲线)或全部刷一遍(洗牌) */
  reciteMode: ReciteMode
  /** 每天从几点开始算新的一天(0–23),默认凌晨 4 点 */
  dayStartHour: number
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 'm',
  language: 'zh-CN',
  selectedBankIds: [],
  readPosition: null,
  priorityFilter: [],
  showEnglish: true,
  reciteMode: 'today',
  dayStartHour: 4
}

export interface BankSummary {
  id: string
  name: string
  questionCount: number
  /** 每日新题数 */
  newPerDay: number
  /** 每日复习上限 */
  reviewPerDay: number
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
  /** 答案的纯文本摘要(一行,不含元信息) */
  snippet: string
  /** 优先级;未设置时为 null */
  priority: string | null
  updatedAt: number
  /** 学习状态:没学过 / 学习中(今天答错或刚学) / 按天复习中 */
  studyStatus: StudyStatus
  inWrongBook: boolean
}

export type StudyStatus = 'new' | 'learning' | 'review'

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

/** 所选题库中各优先级的题目数量 */
export interface PriorityStats {
  total: number
  /** 优先级 → 题目数量(按 高、中、低 排序) */
  counts: { priority: string; count: number }[]
  /** 没有标注优先级的题目数量 */
  unlabeled: number
}

/** 批量设置优先级的范围:只改未设置的题目,或全部题目 */
export type PriorityScope = 'missing' | 'all'

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
  /** 三个自评按钮对应的下次复习间隔 */
  previews: GradePreview[]
  /** 这道题在错题本中 */
  inWrongBook: boolean
}

/** 首页显示的背题进度 */
export interface ReciteStatus {
  bankIds: string[]
  priorities: string[]
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

// ---------- 记忆曲线 ----------

/** 错题本在题库勾选中使用的特殊 id */
export const WRONG_BOOK_ID = '__wrongbook__'

/** 自评:1 不会,2 模糊,3 记住 */
export type Grade = 1 | 2 | 3
export const GRADES: readonly Grade[] = [1, 2, 3]

/** 选择某个自评后,距离下次复习的时间 */
export interface GradePreview {
  grade: Grade
  intervalMs: number
}

/** 今日任务的剩余数量 */
export interface TodayCounts {
  /** 还要学的新题 */
  newLeft: number
  /** 还要复习的到期题 */
  reviewLeft: number
  /** 今天答错、还要再过一遍的题 */
  learningLeft: number
  /** 今天已经自评的次数 */
  doneToday: number
}

/** 今日任务中的一道题 */
export interface StudyCard {
  question: Question
  bankName: string
  /** 第一次学 */
  isNew: boolean
  inWrongBook: boolean
  previews: GradePreview[]
}

/** 今日任务的状态 */
export type StudyState =
  | { status: 'card'; card: StudyCard; counts: TodayCounts; canUndo: boolean }
  | {
      status: 'done'
      counts: TodayCounts
      canUndo: boolean
      /** 还没学过的新题数量(可以"再学几道") */
      moreNew: number
      /** 明天到期、可以提前复习的数量 */
      ahead: number
      /** 错题本中的题目数量 */
      wrongBook: number
      /** 今天各档自评的次数 */
      grades: GradeCounts
      /** 今天大约学习了几分钟 */
      minutes: number
    }
  | { status: 'empty' }

/** 首页显示的今日任务概况 */
export interface TodaySummary {
  counts: TodayCounts
  wrongBook: number
}

/** 题库的学习设置 */
export interface StudyLimits {
  newPerDay: number
  reviewPerDay: number
}

export const STUDY_LIMITS = { newPerDay: 999, reviewPerDay: 9999 } as const

export interface GradeCounts {
  again: number
  hard: number
  good: number
}

/** 首页的学习概况 */
export interface StudyStats {
  /** 连续学习天数(今天还没学时从昨天往前算) */
  streak: number
  studiedToday: boolean
  /** 今天各档自评次数和学习时长 */
  grades: GradeCounts
  minutes: number
  /** 最近 7 天每天的自评次数,最后一项是今天 */
  last7: { day: string; count: number }[]
  /** 未来 7 天每天到期的题数,第一项是今天(含已过期的) */
  next7: { day: string; count: number }[]
  /** 每个题库的掌握情况 */
  banks: { id: string; name: string; total: number; learned: number; wrongBook: number }[]
}

/** 自动备份 */
export interface AutoBackup {
  /** 文件名,如 auto-2026-11-26.qbak */
  name: string
  /** 备份日期 YYYY-MM-DD */
  date: string
  size: number
}

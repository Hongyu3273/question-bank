// 主进程抛出、界面翻译的业务错误。
// Electron 跨进程传递错误时只保留 message,所以把错误码编码进 message。

export type ErrorCode =
  | 'BANK_NAME_EMPTY'
  | 'BANK_NAME_TOO_LONG'
  | 'BANK_NAME_EXISTS'
  | 'BANK_NOT_FOUND'
  | 'QUESTION_TITLE_EMPTY'
  | 'QUESTION_TITLE_TOO_LONG'
  | 'ANSWER_TOO_LONG'
  | 'QUESTION_NOT_FOUND'
  | 'IMAGE_TYPE_UNSUPPORTED'
  | 'IMAGE_TOO_LARGE'
  | 'RECITE_NO_SESSION'
  | 'ARCHIVE_INVALID'
  | 'ARCHIVE_UNSAFE'
  | 'ARCHIVE_TOO_LARGE'
  | 'ARCHIVE_NO_QUESTIONS'
  | 'EXCEL_INVALID'
  | 'IMPORT_TYPE_UNSUPPORTED'
  | 'IMPORT_EXPIRED'
  | 'BACKUP_INVALID'
  | 'BACKUP_TOO_NEW'
  | 'INVALID_ARGUMENT'

export class AppError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(`[QB:${code}]`)
    this.name = 'AppError'
  }
}

/** 从跨进程收到的错误中取出错误码;不是业务错误时返回 null */
export function parseErrorCode(err: unknown): ErrorCode | null {
  const message = err instanceof Error ? err.message : String(err)
  const match = /\[QB:([A-Z_]+)\]/.exec(message)
  return match ? (match[1] as ErrorCode) : null
}

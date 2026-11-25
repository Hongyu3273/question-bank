import { useDeferredValue, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { LIMITS, type QuestionInput } from '@shared/types'
import { CodeIcon, ImageIcon, TableIcon } from '../../components/icons'
import MarkdownEditor, { type MarkdownEditorHandle } from '../../components/MarkdownEditor'
import MarkdownView from '../../components/MarkdownView'
import styles from './ManagePage.module.css'

interface Props {
  bankId: string
  draft: QuestionInput
  isNew: boolean
  dirty: boolean
  saving: boolean
  onChange: (draft: QuestionInput) => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  /** 保存图片,返回相对路径;失败时返回 null(调用方负责提示) */
  onImage: (file: File) => Promise<string | null>
}

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp'

export default function QuestionEditor({
  bankId,
  draft,
  isNew,
  dirty,
  saving,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onImage
}: Props) {
  const { t } = useTranslation()
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  // 预览延后渲染,输入时不卡顿
  const preview = useDeferredValue(draft.answerMd)

  // 新增题目时聚焦题干
  useEffect(() => {
    if (isNew) titleRef.current?.focus()
  }, [isNew])

  const insertImages = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      const path = await onImage(file)
      if (path) editorRef.current?.insert(`![](${path})\n`)
    }
  }

  return (
    <section
      className={styles.editor}
      aria-label={t('manage.editQuestion')}
      onKeyDown={(e) => {
        // Ctrl+S / Cmd+S 保存
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault()
          if (dirty && !saving) onSave()
        }
      }}
    >
      <label className={styles.fieldLabel}>
        {t('manage.title')}
        <input
          ref={titleRef}
          className="input"
          value={draft.title}
          maxLength={LIMITS.questionTitle}
          placeholder={t('manage.titlePlaceholder')}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
      </label>

      <div className={styles.answerHeader}>
        <span className={styles.fieldLabelText}>{t('manage.answer')}</span>
        <div className={styles.toolbar} role="toolbar" aria-label={t('manage.toolbar')}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('manage.insertImage')}
            title={t('manage.insertImage')}
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon size={16} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('manage.insertCode')}
            title={t('manage.insertCode')}
            onClick={() => editorRef.current?.insert('\n```java\n\n```\n')}
          >
            <CodeIcon size={16} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('manage.insertTable')}
            title={t('manage.insertTable')}
            onClick={() => editorRef.current?.insert(`\n| ${t('manage.tableHead')} | ${t('manage.tableHead')} |\n| --- | --- |\n|  |  |\n`)}
          >
            <TableIcon size={16} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              void insertImages(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className={styles.split}>
        <div className={styles.editorPane}>
          <MarkdownEditor
            ref={editorRef}
            value={draft.answerMd}
            onChange={(answerMd) => onChange({ ...draft, answerMd })}
            onImage={onImage}
            ariaLabel={t('manage.answerSource')}
          />
        </div>
        <div className={styles.previewPane} aria-label={t('manage.preview')}>
          <div className={styles.previewLabel}>{t('manage.preview')}</div>
          {preview.trim() ? (
            <MarkdownView markdown={preview} bankId={bankId} />
          ) : (
            <p className={styles.previewEmpty}>{t('manage.previewEmpty')}</p>
          )}
        </div>
      </div>

      <div className={styles.editorFooter}>
        {!isNew && (
          <button type="button" className={`btn ${styles.deleteButton}`} onClick={onDelete}>
            {t('manage.deleteQuestion')}
          </button>
        )}
        <span className={styles.footerHint}>{dirty ? t('manage.unsaved') : t('manage.pasteHint')}</span>
        <button type="button" className="btn" onClick={onCancel} disabled={!dirty && !isNew}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={!dirty || saving}>
          {t('common.save')}
        </button>
      </div>
    </section>
  )
}

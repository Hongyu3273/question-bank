import { useDeferredValue, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { composeAnswer, extractMeta, PRIORITIES, type QuestionMeta } from '@shared/meta'
import { LIMITS, type QuestionInput } from '@shared/types'
import {
  CheckIcon,
  CodeIcon,
  FunctionIcon,
  ImageIcon,
  InlineCodeIcon,
  LinkIcon,
  ListIcon,
  MoreIcon,
  OrderedListIcon,
  QuoteIcon,
  TableIcon,
  TrashIcon
} from '../../components/icons'
import MarkdownEditor, { type MarkdownEditorHandle } from '../../components/MarkdownEditor'
import MarkdownView from '../../components/MarkdownView'
import MetaTags from '../../components/MetaTags'
import { usePriorityLabel } from '../../hooks/usePriorityLabel'
import Menu, { anchorBelow, type MenuAnchor } from '../../components/Menu'
import { formatRelative } from '../../lib/time'
import styles from './ManagePage.module.css'

type ViewMode = 'edit' | 'preview'

/**
 * 元信息输入框:保留正在输入的原文(包括末尾空格),
 * 只有外部值真正变化(例如切换题目)时才同步。分隔符 ｜ 会替换为 /,避免破坏格式。
 */
function MetaInput({
  value,
  onCommit,
  ...rest
}: { value: string; onCommit: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(value)
  useEffect(() => {
    setText((current) => (current.trim() === value ? current : value))
  }, [value])
  return (
    <input
      {...rest}
      value={text}
      onChange={(e) => {
        const v = e.target.value.replace(/[｜|]/g, '/')
        setText(v)
        onCommit(v)
      }}
    />
  )
}
const VIEW_KEY = 'qb.editorView'

function loadViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v === 'edit' || v === 'preview') return v
  } catch {
    // 读取失败时使用默认值
  }
  return 'edit'
}

interface Props {
  bankId: string
  bankName: string
  /** 题号(从 1 开始);新增时为 null */
  number: number | null
  updatedAt: number | null
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

/** 右侧编辑区:大标题题干、格式工具栏、编辑/预览切换、底部保存状态 */
export default function QuestionEditor({
  bankId,
  bankName,
  number,
  updatedAt,
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
  const { t, i18n } = useTranslation()
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const [view, setView] = useState<ViewMode>(loadViewMode)
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const priorityLabel = usePriorityLabel()
  // 答案拆成元信息(优先级、分类等)和正文:元信息用表单编辑,编辑器只编辑正文
  const { meta, body } = useMemo(() => extractMeta(draft.answerMd), [draft.answerMd])
  const setMeta = (patch: Partial<QuestionMeta>) => onChange({ ...draft, answerMd: composeAnswer({ ...meta, ...patch }, body) })
  const setBody = (next: string) => onChange({ ...draft, answerMd: composeAnswer(meta, next) })
  // 预览延后渲染,输入时不卡顿
  const preview = useDeferredValue(body)

  // 新增题目时聚焦题干
  useEffect(() => {
    if (isNew) titleRef.current?.focus()
  }, [isNew])

  // 题干输入框随内容自动增高
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft.title])

  const changeView = (mode: ViewMode) => {
    setView(mode)
    try {
      localStorage.setItem(VIEW_KEY, mode)
    } catch {
      // 保存失败不影响使用
    }
  }

  const insertImages = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      const path = await onImage(file)
      if (path) editorRef.current?.insert(`![](${path})\n`)
    }
  }

  const ed = () => editorRef.current
  const tools: { label: string; icon: ReactNode; run: () => void }[][] = [
    [
      { label: t('manage.fmtHeading'), icon: <b className={styles.glyph}>H</b>, run: () => ed()?.prefixLines('### ') },
      { label: t('manage.fmtBold'), icon: <b className={styles.glyph}>B</b>, run: () => ed()?.wrap('**', '**', t('manage.fmtBold')) },
      { label: t('manage.fmtItalic'), icon: <i className={styles.glyph}>I</i>, run: () => ed()?.wrap('*', '*', t('manage.fmtItalic')) },
      { label: t('manage.fmtStrike'), icon: <s className={styles.glyph}>S</s>, run: () => ed()?.wrap('~~', '~~', t('manage.fmtStrike')) }
    ],
    [
      { label: t('manage.fmtList'), icon: <ListIcon size={16} />, run: () => ed()?.prefixLines('- ') },
      { label: t('manage.fmtOrdered'), icon: <OrderedListIcon size={16} />, run: () => ed()?.prefixLines((i) => `${i + 1}. `) },
      { label: t('manage.fmtQuote'), icon: <QuoteIcon size={16} />, run: () => ed()?.prefixLines('> ') }
    ],
    [
      { label: t('manage.fmtInlineCode'), icon: <InlineCodeIcon size={16} />, run: () => ed()?.wrap('`', '`', 'code') },
      { label: t('manage.insertCode'), icon: <CodeIcon size={16} />, run: () => ed()?.wrap('\n```java\n', '\n```\n', '') },
      { label: t('manage.fmtLink'), icon: <LinkIcon size={16} />, run: () => ed()?.wrap('[', '](https://)', t('manage.fmtLinkText')) },
      { label: t('manage.fmtMath'), icon: <FunctionIcon size={16} />, run: () => ed()?.wrap('$', '$', 'E=mc^2') },
      {
        label: t('manage.insertTable'),
        icon: <TableIcon size={16} />,
        run: () =>
          ed()?.insert(`\n| ${t('manage.tableHead')} | ${t('manage.tableHead')} |\n| --- | --- |\n|  |  |\n`)
      },
      { label: t('manage.insertImage'), icon: <ImageIcon size={16} />, run: () => fileRef.current?.click() }
    ]
  ]

  const status = saving
    ? t('manage.saving')
    : dirty
      ? t('manage.unsaved')
      : isNew
        ? t('manage.newQuestionHint')
        : updatedAt
          ? t('manage.savedAt', { time: formatRelative(updatedAt, i18n.language, t('manage.justNow')) })
          : ''

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
      <header className={styles.editorHeader}>
        <div className={styles.editorMeta}>
          <span className={styles.metaChip}>{bankName}</span>
          <span>{number ? t('manage.questionNumber', { number }) : t('manage.untitled')}</span>
        </div>
        <div className={styles.segmented} role="radiogroup" aria-label={t('manage.viewMode')}>
          {(['edit', 'preview'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={view === mode}
              className={view === mode ? `${styles.segment} ${styles.segmentOn}` : styles.segment}
              onClick={() => changeView(mode)}
            >
              {t(`manage.view_${mode}`)}
            </button>
          ))}
        </div>
        {!isNew && (
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('manage.moreActions')}
            aria-haspopup="menu"
            onClick={(e) => setMenu(anchorBelow(e.currentTarget))}
          >
            <MoreIcon size={18} />
          </button>
        )}
      </header>

      <textarea
        ref={titleRef}
        rows={1}
        className={styles.titleInput}
        value={draft.title}
        maxLength={LIMITS.questionTitle}
        placeholder={t('manage.titlePlaceholder')}
        aria-label={t('manage.title')}
        onChange={(e) => onChange({ ...draft, title: e.target.value.replace(/\n/g, ' ') })}
        onKeyDown={(e) => {
          // 题干是单行文字,回车跳到答案编辑区
          if (e.key === 'Enter') {
            e.preventDefault()
            ed()?.insert('')
          }
        }}
      />

      {/* 题目信息:优先级、分类、英文题干、出处 */}
      <div className={styles.metaForm}>
        <div className={styles.metaField}>
          <span className={styles.metaLabel}>{t('manage.priority')}</span>
          <div className={styles.segmented} role="radiogroup" aria-label={t('manage.priority')}>
            {(['', ...PRIORITIES] as string[]).map((p) => {
              const on = (meta.priority ?? '') === p
              return (
                <button
                  key={p || 'none'}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={on ? `${styles.segment} ${styles.segmentOn}` : styles.segment}
                  onClick={() => setMeta({ priority: p })}
                >
                  {p ? priorityLabel(p) : t('meta.none')}
                </button>
              )
            })}
            {meta.priority && !(PRIORITIES as readonly string[]).includes(meta.priority) && (
              <span className={`${styles.segment} ${styles.segmentOn}`}>{meta.priority}</span>
            )}
          </div>
        </div>
        <label className={styles.metaField}>
          <span className={styles.metaLabel}>{t('manage.category')}</span>
          <MetaInput
            className={styles.metaInput}
            value={meta.category ?? ''}
            maxLength={60}
            placeholder={t('manage.categoryPlaceholder')}
            onCommit={(v) => setMeta({ category: v })}
          />
        </label>
        <label className={`${styles.metaField} ${styles.metaWide}`}>
          <span className={styles.metaLabel}>{t('manage.english')}</span>
          <MetaInput
            className={styles.metaInput}
            value={meta.english ?? ''}
            maxLength={300}
            placeholder={t('manage.englishPlaceholder')}
            onCommit={(v) => setMeta({ english: v })}
          />
        </label>
        <label className={`${styles.metaField} ${styles.metaWide}`}>
          <span className={styles.metaLabel}>{t('manage.source')}</span>
          <MetaInput
            className={styles.metaInput}
            value={meta.source ?? ''}
            maxLength={200}
            placeholder={t('manage.sourcePlaceholder')}
            onCommit={(v) => setMeta({ source: v })}
          />
        </label>
      </div>

      {view === 'edit' && (
        <div className={styles.formatBar} role="toolbar" aria-label={t('manage.toolbar')}>
          {tools.map((group, gi) => (
            <div key={gi} className={styles.formatGroup}>
              {group.map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  className={styles.formatButton}
                  aria-label={tool.label}
                  title={tool.label}
                  onClick={tool.run}
                >
                  {tool.icon}
                </button>
              ))}
            </div>
          ))}
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
      )}

      <div className={styles.workArea}>
        {view === 'edit' ? (
          <div className={styles.editorPane}>
            <MarkdownEditor
              ref={editorRef}
              value={body}
              onChange={setBody}
              onImage={onImage}
              ariaLabel={t('manage.answerSource')}
              placeholder={t('manage.answerPlaceholder')}
            />
          </div>
        ) : (
          <div className={styles.previewPane} aria-label={t('manage.preview')}>
            <MetaTags meta={meta} showSource priorityLabel={priorityLabel} />
            {meta.english && <p className={styles.previewEnglish}>{meta.english}</p>}
            {preview.trim() ? (
              <MarkdownView markdown={preview} bankId={bankId} />
            ) : (
              <p className={styles.previewEmpty}>{t('manage.previewEmpty')}</p>
            )}
          </div>
        )}
      </div>

      <footer className={styles.editorFooter}>
        <span className={dirty ? `${styles.status} ${styles.statusDirty}` : styles.status} aria-live="polite">
          {dirty ? <span className={styles.dirtyDot} aria-hidden="true" /> : !isNew && <CheckIcon size={14} />}
          {status}
        </span>
        <span className={styles.shortcutHint}>{t('manage.shortcutHint')}</span>
        {(dirty || isNew) && (
          <button type="button" className="btn btn-sm" onClick={onCancel} disabled={saving}>
            {isNew ? t('common.cancel') : t('manage.revert')}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-primary" onClick={onSave} disabled={!dirty || saving}>
          {t('common.save')}
        </button>
      </footer>

      <Menu
        anchor={menu}
        label={t('manage.moreActions')}
        onClose={() => setMenu(null)}
        items={[{ label: t('manage.deleteQuestion'), icon: <TrashIcon size={15} />, danger: true, onSelect: onDelete }]}
      />
    </section>
  )
}

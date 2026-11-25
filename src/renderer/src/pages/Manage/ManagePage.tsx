import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LIMITS, type BankSummary, type QuestionInput, type QuestionSummary } from '@shared/types'
import { ArrowLeftIcon, ChevronRightIcon, FolderIcon, PencilIcon, PlusIcon, UploadIcon } from '../../components/icons'
import NameDialog from '../../components/NameDialog'
import { exportBank, saveTemplate, startImport } from '../../lib/dataActions'
import { errorMessage } from '../../lib/errors'
import { confirmDialog } from '../../stores/confirm'
import { useImportStore } from '../../stores/import'
import { useToastStore } from '../../stores/toast'
import BankList from './BankList'
import QuestionEditor from './QuestionEditor'
import QuestionList from './QuestionList'
import styles from './ManagePage.module.css'

type Selection = { kind: 'none' } | { kind: 'new' } | { kind: 'existing'; id: string }

const EMPTY: QuestionInput = { title: '', answerMd: '' }
const NONE: Selection = { kind: 'none' }

export default function ManagePage() {
  const { t } = useTranslation()
  const toast = useToastStore((s) => s.show)
  const navigate = useNavigate()

  const [banks, setBanks] = useState<BankSummary[] | null>(null)
  const [bankId, setBankId] = useState<string | null>(null)
  /** 新建或重命名题库的弹窗 */
  const [nameDialog, setNameDialog] = useState<{ mode: 'create' } | { mode: 'rename'; bank: BankSummary } | null>(
    null
  )
  const [questions, setQuestions] = useState<QuestionSummary[]>([])
  const [selection, setSelection] = useState<Selection>(NONE)
  const [saved, setSaved] = useState<QuestionInput>(EMPTY)
  const [draft, setDraft] = useState<QuestionInput>(EMPTY)
  const [saving, setSaving] = useState(false)

  const dirty = selection.kind !== 'none' && (draft.title !== saved.title || draft.answerMd !== saved.answerMd)
  const fail = useCallback((err: unknown) => toast(errorMessage(err, t), 3000), [toast, t])

  /** 有未保存的修改时,先确认是否放弃 */
  const confirmDiscard = useCallback(
    async () =>
      !dirty ||
      confirmDialog({
        title: t('manage.discardTitle'),
        message: t('manage.discardMessage'),
        confirmLabel: t('manage.discard'),
        danger: true
      }),
    [dirty, t]
  )

  // 离开题库管理页面前,同样确认未保存的修改
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void confirmDialog({
      title: t('manage.discardTitle'),
      message: t('manage.discardMessage'),
      confirmLabel: t('manage.discard'),
      danger: true
    }).then((ok) => (ok ? blocker.proceed() : blocker.reset()))
  }, [blocker, t])

  const refreshBanks = useCallback(async () => {
    const list = await window.api.banks.list()
    setBanks(list)
    return list
  }, [])

  const loadQuestions = useCallback(async (id: string) => {
    setQuestions(await window.api.questions.list(id))
  }, [])

  const resetEditor = () => {
    setSelection(NONE)
    setSaved(EMPTY)
    setDraft(EMPTY)
  }

  /** 切换到某个题库(不做未保存确认) */
  const openBank = useCallback(
    async (id: string | null) => {
      setBankId(id)
      resetEditor()
      if (id) await loadQuestions(id)
      else setQuestions([])
    },
    [loadQuestions]
  )

  // 首次进入:加载题库并选中第一个
  useEffect(() => {
    void refreshBanks()
      .then((list) => openBank(list[0]?.id ?? null))
      .catch(fail)
  }, [refreshBanks, openBank, fail])

  // 导入了新题库或覆盖了题库后刷新
  const importVersion = useImportStore((s) => s.version)
  const lastImportVersion = useRef(importVersion)
  useEffect(() => {
    if (importVersion === lastImportVersion.current) return
    lastImportVersion.current = importVersion
    void refreshBanks()
      .then(async (list) => {
        const keep = list.find((b) => b.id === bankId)
        if (keep && !dirty) await openBank(keep.id)
        else if (!keep) await openBank(list[0]?.id ?? null)
      })
      .catch(fail)
  }, [importVersion, refreshBanks, openBank, bankId, dirty, fail])

  // ---------- 题库 ----------

  const selectBank = async (id: string) => {
    if (id === bankId || !(await confirmDiscard())) return
    await openBank(id).catch(fail)
  }

  const renameBank = async (id: string, name: string) => {
    await window.api.banks.rename(id, name)
    await refreshBanks()
  }

  const submitBankName = async (name: string) => {
    if (!nameDialog) return
    if (nameDialog.mode === 'create') {
      // 先关闭弹窗,再处理未保存确认,避免两个弹窗叠在一起
      if (dirty && !(await confirmDiscard())) return
      const bank = await window.api.banks.create(name)
      setNameDialog(null)
      await refreshBanks()
      await openBank(bank.id)
      toast(t('manage.bankCreated'))
    } else {
      await renameBank(nameDialog.bank.id, name)
      setNameDialog(null)
    }
  }

  const deleteBank = async (bank: BankSummary) => {
    const ok = await confirmDialog({
      title: t('manage.deleteBankTitle', { name: bank.name }),
      message: t('manage.deleteBankMessage', { count: bank.questionCount }),
      confirmLabel: t('common.delete'),
      danger: true
    })
    if (!ok) return
    try {
      await window.api.banks.delete(bank.id)
      const list = await refreshBanks()
      if (bank.id === bankId) await openBank(list[0]?.id ?? null)
      toast(t('manage.bankDeleted'))
    } catch (err) {
      fail(err)
    }
  }

  // ---------- 题目 ----------

  const selectQuestion = async (id: string) => {
    if (selection.kind === 'existing' && selection.id === id) return
    if (!(await confirmDiscard())) return
    try {
      const q = await window.api.questions.get(id)
      const input = { title: q.title, answerMd: q.answerMd }
      setSelection({ kind: 'existing', id })
      setSaved(input)
      setDraft(input)
    } catch (err) {
      fail(err)
    }
  }

  const newQuestion = async () => {
    if (!bankId || !(await confirmDiscard())) return
    setSelection({ kind: 'new' })
    setSaved(EMPTY)
    setDraft(EMPTY)
  }

  const save = async () => {
    if (!bankId || selection.kind === 'none' || saving) return
    setSaving(true)
    try {
      const q =
        selection.kind === 'new'
          ? await window.api.questions.create(bankId, draft)
          : await window.api.questions.update(selection.id, draft)
      const input = { title: q.title, answerMd: q.answerMd }
      setSelection({ kind: 'existing', id: q.id })
      setSaved(input)
      setDraft(input)
      await Promise.all([loadQuestions(bankId), refreshBanks()])
      toast(t('manage.saved'))
    } catch (err) {
      fail(err)
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    if (selection.kind === 'new') resetEditor()
    else setDraft(saved)
  }

  const deleteQuestion = async () => {
    if (selection.kind !== 'existing' || !bankId) return
    const ok = await confirmDialog({
      title: t('manage.deleteQuestionTitle'),
      message: saved.title,
      confirmLabel: t('common.delete'),
      danger: true
    })
    if (!ok) return
    try {
      await window.api.questions.delete(selection.id)
      resetEditor()
      await Promise.all([loadQuestions(bankId), refreshBanks()])
      toast(t('manage.questionDeleted'))
    } catch (err) {
      fail(err)
    }
  }

  const saveImage = async (file: File): Promise<string | null> => {
    if (!bankId) return null
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      return await window.api.questions.saveImage(bankId, data, file.type)
    } catch (err) {
      fail(err)
      return null
    }
  }

  /** 返回上一页;没有上一页时回到首页。有未保存修改时由 useBlocker 确认 */
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/')
  }

  // ---------- 渲染 ----------

  const selectedQuestionId = selection.kind === 'existing' ? selection.id : selection.kind === 'new' ? 'new' : null
  const currentBank = banks?.find((b) => b.id === bankId) ?? null
  const currentIndex = selection.kind === 'existing' ? questions.findIndex((q) => q.id === selection.id) : -1

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className="btn btn-sm" onClick={goBack}>
          <ArrowLeftIcon size={16} />
          {t('common.back')}
        </button>
        <nav className={styles.breadcrumb} aria-label={t('manage.breadcrumb')}>
          <h1 className={styles.title}>{t('nav.manage')}</h1>
          {currentBank && (
            <>
                <ChevronRightIcon size={16} />
                <span className={styles.breadcrumbCurrent}>{currentBank.name}</span>
            </>
          )}
        </nav>
        <button type="button" className="btn" onClick={() => void startImport(t)}>
          <UploadIcon size={16} />
          {t('data.import')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setNameDialog({ mode: 'create' })}>
          <PlusIcon size={16} />
          {t('manage.newBank')}
        </button>
      </header>

      {banks && banks.length === 0 ? (
        <div className={styles.emptyPage}>
          <div className={styles.emptyIcon}>
            <FolderIcon size={28} />
          </div>
          <div className={styles.emptyTitle}>{t('home.emptyTitle')}</div>
          <p className={styles.emptyDesc}>{t('manage.emptyDesc')}</p>
          <div className={styles.emptyActions}>
            <button type="button" className="btn" onClick={() => void startImport(t)}>
              <UploadIcon size={16} />
              {t('data.import')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setNameDialog({ mode: 'create' })}>
              <PlusIcon size={16} />
              {t('manage.newBank')}
            </button>
          </div>
          <TemplateLinks />
        </div>
      ) : (
        <div className={styles.body}>
          <BankList
            banks={banks ?? []}
            selectedId={bankId}
            onSelect={(id) => void selectBank(id)}
            onNew={() => setNameDialog({ mode: 'create' })}
            onRename={(bank) => setNameDialog({ mode: 'rename', bank })}
            onExport={(bank) => void exportBank(bank.id, t)}
            onDelete={(bank) => void deleteBank(bank)}
          />

          {bankId && currentBank && questions.length === 0 && selection.kind === 'none' ? (
            // 空题库:不显示题目栏,用一个居中的引导代替
            <div className={styles.bankEmpty}>
              <div className={styles.emptyIcon}>
                <PencilIcon size={26} />
              </div>
              <div className={styles.emptyTitle}>{t('manage.bankEmptyTitle', { name: currentBank.name })}</div>
              <p className={styles.emptyDesc}>{t('manage.bankEmptyDesc')}</p>
              <button type="button" className="btn btn-primary" onClick={() => void newQuestion()}>
                <PlusIcon size={16} />
                {t('manage.addFirstQuestion')}
              </button>
              <p className={styles.emptyTip}>{t('manage.bankEmptyTip')}</p>
              <TemplateLinks />
            </div>
          ) : (
            <>
              {bankId && (
                <QuestionList
                  questions={questions}
                  selectedId={selectedQuestionId}
                  dirty={dirty}
                  onSelect={(id) => void selectQuestion(id)}
                  onNew={() => void newQuestion()}
                />
              )}

              {bankId && selection.kind !== 'none' ? (
                <QuestionEditor
                  key={selection.kind === 'existing' ? selection.id : 'new'}
                  bankId={bankId}
                  bankName={currentBank?.name ?? ''}
                  number={currentIndex >= 0 ? currentIndex + 1 : null}
                  updatedAt={currentIndex >= 0 ? questions[currentIndex].updatedAt : null}
                  draft={draft}
                  isNew={selection.kind === 'new'}
                  dirty={dirty}
                  saving={saving}
                  onChange={setDraft}
                  onSave={() => void save()}
                  onCancel={cancel}
                  onDelete={() => void deleteQuestion()}
                  onImage={saveImage}
                />
              ) : (
                <div className={styles.editorEmpty}>
                  <p>{bankId ? t('manage.selectQuestionHint') : t('manage.selectBankHint')}</p>
                  {bankId && (
                    <button type="button" className="btn btn-sm" onClick={() => void newQuestion()}>
                      <PlusIcon size={14} />
                      {t('manage.newQuestion')}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <NameDialog
        open={nameDialog !== null}
        title={nameDialog?.mode === 'rename' ? t('manage.renameBank') : t('manage.newBank')}
        description={nameDialog?.mode === 'rename' ? undefined : t('manage.newBankDesc')}
        label={t('manage.bankName')}
        placeholder={t('manage.bankNamePlaceholder')}
        initialValue={nameDialog?.mode === 'rename' ? nameDialog.bank.name : ''}
        maxLength={LIMITS.bankName}
        submitLabel={nameDialog?.mode === 'rename' ? t('common.save') : t('manage.create')}
        onSubmit={submitBankName}
        onClose={() => setNameDialog(null)}
        errorText={(err) => errorMessage(err, t)}
      />
    </div>
  )
}

/** 下载导入模板的链接 */
function TemplateLinks() {
  const { t } = useTranslation()
  return (
    <p className={styles.templateLinks}>
      {t('data.templates')}
      <button type="button" onClick={() => void saveTemplate('markdown', t)}>
        Markdown
      </button>
      ·
      <button type="button" onClick={() => void saveTemplate('excel', t)}>
        Excel
      </button>
    </p>
  )
}

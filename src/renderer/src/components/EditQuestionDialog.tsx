// 在看题、背题时直接修改当前题目,不用跳到题库管理

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Question, QuestionInput } from '@shared/types'
import { errorMessage } from '../lib/errors'
import QuestionEditor from '../pages/Manage/QuestionEditor'
import { useConfirmStore } from '../stores/confirm'
import { useToastStore } from '../stores/toast'
import styles from './EditQuestionDialog.module.css'

interface Props {
  /** 要编辑的题目;为 null 时关闭 */
  question: Question | null
  bankName: string
  onSaved: (question: Question) => void
  onClose: () => void
}

export default function EditQuestionDialog({ question, bankName, onSaved, onClose }: Props) {
  const { t } = useTranslation()
  const toast = useToastStore((s) => s.show)
  const ask = useConfirmStore((s) => s.ask)
  const ref = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<QuestionInput>({ title: '', answerMd: '' })
  const [saved, setSaved] = useState<QuestionInput>({ title: '', answerMd: '' })
  const [saving, setSaving] = useState(false)
  const dirty = draft.title !== saved.title || draft.answerMd !== saved.answerMd

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (question) {
      const input = { title: question.title, answerMd: question.answerMd }
      setDraft(input)
      setSaved(input)
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) dialog.close()
  }, [question])

  /** 有未保存的修改时先确认 */
  const requestClose = async () => {
    if (dirty) {
      const ok = await ask({
        title: t('quickEdit.discardTitle'),
        message: t('quickEdit.discardMessage'),
        confirmLabel: t('quickEdit.discard'),
        danger: true
      })
      if (!ok) return
    }
    onClose()
  }

  const save = async () => {
    if (!question || !dirty || saving) return
    if (!draft.title.trim()) {
      toast(t('errors.QUESTION_TITLE_EMPTY'))
      return
    }
    setSaving(true)
    try {
      const updated = await window.api.questions.update(question.id, draft)
      setSaved({ title: updated.title, answerMd: updated.answerMd })
      setDraft({ title: updated.title, answerMd: updated.answerMd })
      onSaved(updated)
      toast(t('quickEdit.saved'))
      onClose()
    } catch (err) {
      toast(errorMessage(err, t), 3000)
    } finally {
      setSaving(false)
    }
  }

  const saveImage = async (file: File): Promise<string | null> => {
    if (!question) return null
    try {
      return await window.api.questions.saveImage(question.bankId, new Uint8Array(await file.arrayBuffer()), file.type)
    } catch (err) {
      toast(errorMessage(err, t), 3000)
      return null
    }
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={t('quickEdit.title')}
      onCancel={(e) => {
        e.preventDefault()
        void requestClose()
      }}
    >
      {question && (
        <QuestionEditor
          bankId={question.bankId}
          bankName={bankName}
          number={null}
          updatedAt={question.updatedAt}
          draft={draft}
          isNew={false}
          dirty={dirty}
          saving={saving}
          onChange={setDraft}
          onSave={() => void save()}
          onCancel={() => (dirty ? setDraft(saved) : onClose())}
          onImage={saveImage}
          shortcutHint={t('quickEdit.hint')}
        />
      )}
    </dialog>
  )
}

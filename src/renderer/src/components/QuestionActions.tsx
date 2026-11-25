import { useTranslation } from 'react-i18next'
import { CloseIcon, PencilIcon } from './icons'
import styles from './QuestionActions.module.css'

interface Props {
  inWrongBook: boolean
  onEdit: () => void
  onRemoveWrong: () => void
}

/** 题目右上角的操作:错题本标记(可移出)和编辑 */
export default function QuestionActions({ inWrongBook, onEdit, onRemoveWrong }: Props) {
  const { t } = useTranslation()
  return (
    <span className={styles.actions} data-search-skip>
      {inWrongBook && (
        <span className={styles.wrong}>
          {t('wrongBook.name')}
          <button
            type="button"
            className={styles.remove}
            aria-label={t('wrongBook.remove')}
            title={t('wrongBook.remove')}
            onClick={onRemoveWrong}
          >
            <CloseIcon size={12} />
          </button>
        </span>
      )}
      <button type="button" className={styles.edit} onClick={onEdit} title={t('quickEdit.buttonHint')}>
        <PencilIcon size={14} />
        {t('quickEdit.button')}
      </button>
    </span>
  )
}

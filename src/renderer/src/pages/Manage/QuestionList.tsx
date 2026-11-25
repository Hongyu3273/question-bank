import { useTranslation } from 'react-i18next'
import type { QuestionSummary } from '@shared/types'
import { PlusIcon } from '../../components/icons'
import styles from './ManagePage.module.css'

interface Props {
  questions: QuestionSummary[]
  /** 当前编辑的题目 id;'new' 表示正在新增 */
  selectedId: string | 'new' | null
  onSelect: (id: string) => void
  onNew: () => void
}

export default function QuestionList({ questions, selectedId, onSelect, onNew }: Props) {
  const { t } = useTranslation()

  return (
    <section className={styles.questionColumn} aria-label={t('manage.questions')}>
      <div className={styles.questionHeader}>
        <span className={styles.questionHeaderTitle}>{t('manage.questionsCount', { count: questions.length })}</span>
        <button type="button" className="btn btn-sm" onClick={onNew}>
          <PlusIcon size={14} />
          {t('manage.newQuestion')}
        </button>
      </div>

      <ol className={styles.questionList}>
        {selectedId === 'new' && (
          <li>
            <span className={`${styles.questionRow} ${styles.questionRowSelected}`}>
              <span className={styles.questionIndex}>{questions.length + 1}</span>
              <span className={styles.questionTitle}>{t('manage.untitled')}</span>
            </span>
          </li>
        )}
        {questions.map((q, i) => {
          const selected = q.id === selectedId
          return (
            <li key={q.id}>
              <button
                type="button"
                className={selected ? `${styles.questionRow} ${styles.questionRowSelected}` : styles.questionRow}
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(q.id)}
              >
                <span className={styles.questionIndex}>{i + 1}</span>
                <span className={styles.questionTitle}>{q.title}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {questions.length === 0 && selectedId !== 'new' && (
        <p className={styles.columnEmpty}>{t('manage.noQuestions')}</p>
      )}
    </section>
  )
}

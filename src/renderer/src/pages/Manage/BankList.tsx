import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BankSummary } from '@shared/types'
import { PencilIcon, TrashIcon } from '../../components/icons'
import { errorMessage } from '../../lib/errors'
import NameInput from './NameInput'
import styles from './ManagePage.module.css'

interface Props {
  banks: BankSummary[]
  selectedId: string | null
  creating: boolean
  onCreatingChange: (creating: boolean) => void
  onSelect: (id: string) => void
  onCreate: (name: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (bank: BankSummary) => void
}

export default function BankList({
  banks,
  selectedId,
  creating,
  onCreatingChange,
  onSelect,
  onCreate,
  onRename,
  onDelete
}: Props) {
  const { t } = useTranslation()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const errorText = (err: unknown) => errorMessage(err, t)

  return (
    <section className={styles.bankColumn} aria-label={t('manage.banks')}>
      <div className={styles.columnLabel}>{t('manage.banksCount', { count: banks.length })}</div>

      {creating && (
        <NameInput
          placeholder={t('manage.bankNamePlaceholder')}
          ariaLabel={t('manage.bankName')}
          errorText={errorText}
          onSubmit={async (name) => {
            await onCreate(name)
            onCreatingChange(false)
          }}
          onCancel={() => onCreatingChange(false)}
        />
      )}

      <ul className={styles.bankList}>
        {banks.map((bank) => {
          const selected = bank.id === selectedId
          if (bank.id === renamingId) {
            return (
              <li key={bank.id}>
                <NameInput
                  initialValue={bank.name}
                  placeholder={t('manage.bankNamePlaceholder')}
                  ariaLabel={t('manage.bankName')}
                  errorText={errorText}
                  onSubmit={async (name) => {
                    await onRename(bank.id, name)
                    setRenamingId(null)
                  }}
                  onCancel={() => setRenamingId(null)}
                />
              </li>
            )
          }
          return (
            <li key={bank.id} className={selected ? `${styles.bankRow} ${styles.bankRowSelected}` : styles.bankRow}>
              <button
                type="button"
                className={styles.bankButton}
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(bank.id)}
                onDoubleClick={() => setRenamingId(bank.id)}
              >
                <span className={styles.bankName}>{bank.name}</span>
                <span className={styles.bankCount}>{bank.questionCount}</span>
              </button>
              {selected && (
                <>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={t('manage.renameBank')}
                    title={t('manage.renameBank')}
                    onClick={() => setRenamingId(bank.id)}
                  >
                    <PencilIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.iconDanger}`}
                    aria-label={t('manage.deleteBank')}
                    title={t('manage.deleteBank')}
                    onClick={() => onDelete(bank)}
                  >
                    <TrashIcon size={15} />
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BankSummary } from '@shared/types'
import { MoreIcon, PencilIcon, PlusIcon, TrashIcon } from '../../components/icons'
import Menu, { anchorBelow, type MenuAnchor } from '../../components/Menu'
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

/** 左侧题库列表:类似备忘录的文件夹栏。更多操作在"⋯"按钮和右键菜单里 */
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
  const [menu, setMenu] = useState<{ bank: BankSummary; anchor: MenuAnchor } | null>(null)
  const errorText = (err: unknown) => errorMessage(err, t)

  return (
    <nav className={styles.bankColumn} aria-label={t('manage.banks')}>
      <div className={styles.bankHeader}>
        <span className={styles.sectionLabel}>{t('manage.banksLabel')}</span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('manage.newBank')}
          title={t('manage.newBank')}
          onClick={() => onCreatingChange(true)}
        >
          <PlusIcon size={16} />
        </button>
      </div>

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
            <li
              key={bank.id}
              className={selected ? `${styles.bankRow} ${styles.bankRowSelected}` : styles.bankRow}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu({ bank, anchor: { x: e.clientX, y: e.clientY } })
              }}
            >
              <button
                type="button"
                className={styles.bankButton}
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(bank.id)}
                onDoubleClick={() => setRenamingId(bank.id)}
                title={bank.name}
              >
                <span className={styles.bankName}>{bank.name}</span>
                <span className={styles.bankCount}>{bank.questionCount}</span>
              </button>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.rowMore}`}
                aria-label={t('manage.bankActions', { name: bank.name })}
                aria-haspopup="menu"
                onClick={(e) => setMenu({ bank, anchor: anchorBelow(e.currentTarget) })}
              >
                <MoreIcon size={16} />
              </button>
            </li>
          )
        })}
      </ul>

      <Menu
        anchor={menu?.anchor ?? null}
        label={t('manage.bankActions', { name: menu?.bank.name ?? '' })}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                { label: t('manage.renameBank'), icon: <PencilIcon size={15} />, onSelect: () => setRenamingId(menu.bank.id) },
                { label: t('manage.deleteBank'), icon: <TrashIcon size={15} />, danger: true, onSelect: () => onDelete(menu.bank) }
              ]
            : []
        }
      />
    </nav>
  )
}

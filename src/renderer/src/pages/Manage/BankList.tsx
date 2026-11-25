import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BankSummary } from '@shared/types'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DownloadIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon
} from '../../components/icons'
import Menu, { anchorBelow, type MenuAnchor } from '../../components/Menu'
import { stepId, useDragReorder } from '../../hooks/useDragReorder'
import styles from './ManagePage.module.css'

interface Props {
  banks: BankSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (bank: BankSummary) => void
  onExport: (bank: BankSummary) => void
  onDelete: (bank: BankSummary) => void
  onReorder: (ids: string[]) => void
}

/** 左侧题库列表:类似备忘录的文件夹栏。更多操作在"⋯"按钮和右键菜单里 */
export default function BankList({
  banks,
  selectedId,
  onSelect,
  onNew,
  onRename,
  onExport,
  onDelete,
  onReorder
}: Props) {
  const { t } = useTranslation()
  const [menu, setMenu] = useState<{ bank: BankSummary; anchor: MenuAnchor } | null>(null)
  const ids = banks.map((b) => b.id)
  const drag = useDragReorder(ids, onReorder)

  return (
    <nav className={styles.bankColumn} aria-label={t('manage.banks')}>
      <div className={styles.bankHeader}>
        <span className={styles.sectionLabel}>{t('manage.banksLabel')}</span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('manage.newBank')}
          title={t('manage.newBank')}
          onClick={onNew}
        >
          <PlusIcon size={16} />
        </button>
      </div>

      <ul className={styles.bankList}>
        {banks.map((bank) => {
          const selected = bank.id === selectedId
          const mark = drag.indicator(bank.id)
          const cls = [
            styles.bankRow,
            selected && styles.bankRowSelected,
            mark === 'dragging' && styles.dragging,
            mark === 'before' && styles.dropBefore,
            mark === 'after' && styles.dropAfter
          ]
          return (
            <li
              key={bank.id}
              className={cls.filter(Boolean).join(' ')}
              {...drag.rowProps(bank.id)}
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
                onDoubleClick={() => onRename(bank)}
                onKeyDown={(e) => {
                  // Alt + ↑ / ↓ 移动题库位置
                  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault()
                    const next = stepId(ids, bank.id, e.key === 'ArrowUp' ? -1 : 1)
                    if (next !== ids) onReorder(next)
                  }
                }}
                title={`${bank.name}\n${t('manage.dragHint')}`}
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

      <button type="button" className={styles.addBankRow} onClick={onNew}>
        <PlusIcon size={15} />
        {t('manage.newBank')}
      </button>

      <Menu
        anchor={menu?.anchor ?? null}
        label={t('manage.bankActions', { name: menu?.bank.name ?? '' })}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                { label: t('manage.renameBank'), icon: <PencilIcon size={15} />, onSelect: () => onRename(menu.bank) },
                { label: t('manage.exportBank'), icon: <DownloadIcon size={15} />, onSelect: () => onExport(menu.bank) },
                {
                  label: t('manage.moveUp'),
                  icon: <ArrowUpIcon size={15} />,
                  onSelect: () => onReorder(stepId(ids, menu.bank.id, -1))
                },
                {
                  label: t('manage.moveDown'),
                  icon: <ArrowDownIcon size={15} />,
                  onSelect: () => onReorder(stepId(ids, menu.bank.id, 1))
                },
                { label: t('manage.deleteBank'), icon: <TrashIcon size={15} />, danger: true, onSelect: () => onDelete(menu.bank) }
              ]
            : []
        }
      />
    </nav>
  )
}

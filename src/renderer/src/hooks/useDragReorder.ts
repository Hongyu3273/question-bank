import { useState, type DragEvent } from 'react'

/** 把 id 从原位置移到 target 之前或之后,返回新顺序 */
export function moveId(ids: string[], id: string, target: string, after: boolean): string[] {
  if (id === target) return ids
  const rest = ids.filter((x) => x !== id)
  const i = rest.indexOf(target)
  if (i === -1) return ids
  rest.splice(after ? i + 1 : i, 0, id)
  return rest
}

/** 把 id 上移或下移一位 */
export function stepId(ids: string[], id: string, delta: -1 | 1): string[] {
  const i = ids.indexOf(id)
  const j = i + delta
  if (i === -1 || j < 0 || j >= ids.length) return ids
  const next = [...ids]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/**
 * 列表拖动排序。返回每一行要绑定的拖动属性,以及插入位置指示(在哪一行的上方或下方)。
 * enabled 为 false 时不能拖动(例如搜索过滤中)。
 */
export function useDragReorder(ids: string[], onReorder: (ids: string[]) => void, enabled = true) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null)

  const rowProps = (id: string) =>
    enabled
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            setDragId(id)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', id)
          },
          onDragOver: (e: DragEvent<HTMLElement>) => {
            if (!dragId) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            const rect = e.currentTarget.getBoundingClientRect()
            const after = e.clientY > rect.top + rect.height / 2
            if (over?.id !== id || over.after !== after) setOver({ id, after })
          },
          onDrop: (e: DragEvent) => {
            e.preventDefault()
            if (dragId && over) {
              const next = moveId(ids, dragId, over.id, over.after)
              if (next.join() !== ids.join()) onReorder(next)
            }
            setDragId(null)
            setOver(null)
          },
          onDragEnd: () => {
            setDragId(null)
            setOver(null)
          }
        }
      : {}

  /** 某一行的指示状态:'before' / 'after' / 正在拖动的行 'dragging' */
  const indicator = (id: string): 'before' | 'after' | 'dragging' | null => {
    if (id === dragId) return 'dragging'
    if (over?.id === id && dragId && dragId !== id) return over.after ? 'after' : 'before'
    return null
  }

  return { rowProps, indicator }
}

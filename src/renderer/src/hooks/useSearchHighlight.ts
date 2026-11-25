import { useCallback, useEffect, useState, type RefObject } from 'react'

const ALL = 'qb-search'
const CURRENT = 'qb-search-current'

/** 不参与搜索的区域:KaTeX 的隐藏文本,以及显式标记的元素 */
const SKIP_SELECTOR = '.katex-mathml, [data-search-skip]'

function findRanges(root: HTMLElement, query: string): Range[] {
  const q = query.toLowerCase()
  const ranges: Range[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(SKIP_SELECTOR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  })
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node as Text).data.toLowerCase()
    for (let i = text.indexOf(q); i !== -1; i = text.indexOf(q, i + q.length)) {
      const range = new Range()
      range.setStart(node, i)
      range.setEnd(node, i + q.length)
      ranges.push(range)
    }
  }
  return ranges
}

/**
 * 在容器内搜索文字并高亮。
 * 使用 CSS Custom Highlight API:不改动页面结构,Markdown 渲染结果保持不变。
 * contentKey 变化(题目重新加载)时重新搜索。
 */
export function useSearchHighlight(container: RefObject<HTMLElement | null>, query: string, contentKey: unknown) {
  const [ranges, setRanges] = useState<Range[]>([])
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const root = container.current
    const q = query.trim()
    const found = root && q ? findRanges(root, q) : []
    setRanges(found)
    setCurrent(0)
    if (found.length > 0) CSS.highlights.set(ALL, new Highlight(...found))
    else CSS.highlights.delete(ALL)
  }, [container, query, contentKey])

  // 当前匹配项单独高亮,并滚动到可见位置
  useEffect(() => {
    const range = ranges[current]
    if (!range) {
      CSS.highlights.delete(CURRENT)
      return
    }
    CSS.highlights.set(CURRENT, new Highlight(range))
    range.startContainer.parentElement?.scrollIntoView({ block: 'center' })
  }, [ranges, current])

  // 离开页面时清除高亮
  useEffect(
    () => () => {
      CSS.highlights.delete(ALL)
      CSS.highlights.delete(CURRENT)
    },
    []
  )

  const next = useCallback(() => setCurrent((i) => (ranges.length ? (i + 1) % ranges.length : 0)), [ranges])
  const prev = useCallback(
    () => setCurrent((i) => (ranges.length ? (i - 1 + ranges.length) % ranges.length : 0)),
    [ranges]
  )

  return { count: ranges.length, current, next, prev }
}

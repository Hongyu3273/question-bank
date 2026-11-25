import { useEffect, type RefObject } from 'react'


/** 不参与高亮的区域:KaTeX 的隐藏文本,以及显式标记的元素 */
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
 * 高亮容器内所有匹配的文字。
 * 使用 CSS Custom Highlight API:不改动页面结构,Markdown 渲染结果保持不变。
 * 页面内容变化(例如更多答案渲染出来)时传入新的 version 重新计算。
 */
export function useSearchHighlight(
  container: RefObject<HTMLElement | null>,
  query: string,
  version: unknown,
  /** 高亮名称,对应 CSS ::highlight(名称);同一页面有多处高亮时用不同的名称 */
  name = 'qb-search'
): void {
  useEffect(() => {
    const root = container.current
    const q = query.trim()
    // 等这一帧渲染完成后再计算
    const frame = requestAnimationFrame(() => {
      const ranges = root && q ? findRanges(root, q) : []
      if (ranges.length > 0) CSS.highlights.set(name, new Highlight(...ranges))
      else CSS.highlights.delete(name)
    })
    return () => cancelAnimationFrame(frame)
  }, [container, query, version, name])

  useEffect(() => () => void CSS.highlights.delete(name), [name])
}

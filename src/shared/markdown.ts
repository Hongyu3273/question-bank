/** 把 Markdown 转成一行纯文本摘要,用于题目列表 */
export function markdownSnippet(md: string, maxLength = 120): string {
  const text = md
    .replace(/```[\s\S]*?(```|$)/g, ' ') // 代码块
    .replace(/\$\$[\s\S]*?\$\$/g, ' ') // 块级公式
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // 标题、引用、列表标记
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, ' ') // 表格分隔行
    .replace(/[`*_~|$]/g, '') // 行内标记
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

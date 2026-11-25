import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'

import { memo } from 'react'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { assetUrl } from '@shared/ipc'
import styles from './MarkdownView.module.css'

interface Props {
  markdown: string
  /** 用于把 images/xxx.png 解析为该题库的图片地址 */
  bankId: string
  className?: string
}

const components: Components = {
  // 链接一律用系统浏览器打开
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

/**
 * 渲染题目答案。
 * 支持表格、任务列表(GFM)、代码高亮、LaTeX 公式;不渲染原始 HTML,防止导入的题库夹带脚本。
 */
function MarkdownView({ markdown, bankId, className }: Props) {
  const urlTransform = (url: string, key: string) => {
    if (key === 'src') {
      const relative = url.replace(/^\.\//, '')
      if (relative.startsWith('images/')) return assetUrl(bankId, relative)
    }
    return defaultUrlTransform(url)
  }

  return (
    <div className={className ? `${styles.markdown} ${className}` : styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: false }]]}
        urlTransform={urlTransform}
        components={components}
        skipHtml
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

export default memo(MarkdownView)

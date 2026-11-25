import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MarkdownView from '../../src/renderer/src/components/MarkdownView'

const BANK = '0b6f3c2e-8a4d-4c1e-9f7a-2d5b8e1c3a90'
const render = (md: string) => renderToStaticMarkup(<MarkdownView markdown={md} bankId={BANK} />)

describe('MarkdownView', () => {
  it('把题库内的相对图片路径转换为 qb-asset 地址', () => {
    expect(render('![](images/a.png)')).toContain(`src="qb-asset://${BANK}/images/a.png"`)
    expect(render('![](./images/b.png)')).toContain(`src="qb-asset://${BANK}/images/b.png"`)
  })

  it('不渲染原始 HTML,也不保留 javascript: 链接', () => {
    const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
  })

  it('支持表格、代码高亮和公式', () => {
    const html = render('| a | b |\n|---|---|\n| 1 | 2 |\n\n```java\nint x = 1;\n```\n\n$E=mc^2$')
    expect(html).toContain('<table>')
    expect(html).toContain('hljs')
    expect(html).toContain('katex')
  })

  it('链接在新窗口打开(由主进程交给系统浏览器)', () => {
    expect(render('[文档](https://example.com)')).toContain('target="_blank"')
  })
})

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { useResolvedTheme } from '../hooks/useResolvedTheme'

export interface MarkdownEditorHandle {
  /** 在光标处插入文本(替换选中内容)并聚焦编辑器 */
  insert: (text: string) => void
  /** 用前后标记包住选中文字;没有选中时插入占位文字并选中它 */
  wrap: (before: string, after: string, placeholder: string) => void
  /** 给选中的每一行加前缀(标题、列表、引用);prefix 可按行号生成 */
  prefixLines: (prefix: string | ((index: number) => string)) => void
}

interface Props {
  value: string
  onChange: (value: string) => void
  /** 粘贴或拖入图片时调用;返回图片的相对路径,失败时返回 null */
  onImage: (file: File) => Promise<string | null>
  ariaLabel: string
  placeholder?: string
}

const baseTheme = (dark: boolean) =>
  EditorView.theme(
    {
      '&': {
        height: '100%',
        fontSize: '0.8125rem',
        backgroundColor: 'transparent',
        color: 'var(--text)'
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.75' },
      '.cm-content': { padding: '16px 12px', caretColor: 'var(--text)' },
      '.cm-placeholder': { color: 'var(--text-muted)' },
      '.cm-cursor': { borderLeftColor: 'var(--text)' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: dark ? '#3a4a70' : '#cdd9f7'
      }
    },
    { dark }
  )

/** 答案的 Markdown 编辑器(CodeMirror 6),支持粘贴和拖入图片 */
const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor(
  { value, onChange, onImage, ariaLabel, placeholder },
  ref
) {
  const viewRef = useRef<EditorView | null>(null)
  const onImageRef = useRef(onImage)
  onImageRef.current = onImage
  const dark = useResolvedTheme() === 'dark'

  const insert = (text: string) => {
    const view = viewRef.current
    if (!view) return
    view.dispatch(view.state.replaceSelection(text))
    view.focus()
  }

  const wrap = (before: string, after: string, placeholder: string) => {
    const view = viewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    const text = view.state.sliceDoc(from, to) || placeholder
    view.dispatch({
      changes: { from, to, insert: before + text + after },
      selection: { anchor: from + before.length, head: from + before.length + text.length }
    })
    view.focus()
  }

  const prefixLines = (prefix: string | ((index: number) => string)) => {
    const view = viewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    const first = view.state.doc.lineAt(from).number
    const last = view.state.doc.lineAt(to).number
    const changes = []
    for (let n = first; n <= last; n++) {
      const insert = typeof prefix === 'function' ? prefix(n - first) : prefix
      changes.push({ from: view.state.doc.line(n).from, insert })
    }
    view.dispatch({ changes })
    view.focus()
  }

  useImperativeHandle(ref, () => ({ insert, wrap, prefixLines }))

  const extensions = useMemo(() => {
    const handleFiles = (files: FileList | undefined | null): boolean => {
      const images = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'))
      if (images.length === 0) return false
      void (async () => {
        for (const file of images) {
          const path = await onImageRef.current(file)
          if (path) insert(`![](${path})\n`)
        }
      })()
      return true
    }

    return [
      markdown(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
      syntaxHighlighting(dark ? oneDarkHighlightStyle : defaultHighlightStyle),
      baseTheme(dark),
      EditorView.domEventHandlers({
        paste: (event) => {
          const handled = handleFiles(event.clipboardData?.files)
          if (handled) event.preventDefault()
          return handled
        },
        drop: (event) => {
          const handled = handleFiles(event.dataTransfer?.files)
          if (handled) event.preventDefault()
          return handled
        }
      })
    ]
  }, [dark, ariaLabel])

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={(view) => {
        viewRef.current = view
      }}
      theme="none"
      placeholder={placeholder}
      height="100%"
      style={{ height: '100%', minHeight: 0 }}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        autocompletion: false,
        searchKeymap: true
      }}
      extensions={extensions}
    />
  )
})

export default MarkdownEditor

import type { Ctx } from '@milkdown/kit/ctx'
import { editorViewOptionsCtx } from '@milkdown/kit/core'

/** Recognize a complete display expression, leaving ordinary prose and partial
 * equations to the normal rich-text paste handler. Keep the authored source. */
export function pastedDisplayLatex(value: string): string | null {
  const source = value.trim()
  if (source.startsWith('$$') && source.endsWith('$$') && source.length > 4) {
    return source.slice(2, -2).trim() || null
  }
  if (source.startsWith('\\[') && source.endsWith('\\]')) {
    return source.slice(2, -2).trim() || null
  }
  return /^\\begin\{([a-zA-Z]+\*?)\}[\s\S]*\\end\{\1\}$/.test(source) ? source : null
}

/** Answer slots accept full display math directly from the clipboard. A latex
 * code block is the editor's existing display-math representation, shared by
 * saved Questions, print, PDF and DOCX. */
export function configureAnswerLatex(ctx: Ctx) {
  ctx.update(editorViewOptionsCtx, prev => ({
    ...prev,
    handlePaste(view, event, slice) {
      const { $from, $to } = view.state.selection
      let answerDepth = 0
      for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type.name === 'suggestedAnswer') {
          answerDepth = depth
          break
        }
      }
      const sameAnswer = answerDepth > 0 && $to.depth >= answerDepth
        && $from.start(answerDepth) === $to.start(answerDepth)
      // CodeMirror handles source editing itself; never nest a display block
      // inside the equation the teacher is already editing.
      const source = sameAnswer && $from.parent.type.name !== 'code_block'
        ? pastedDisplayLatex(event.clipboardData?.getData('text/plain') ?? '')
        : null
      const code = view.state.schema.nodes.code_block
      if (!source || !code || !$from.sameParent($to) || !$from.parent.isTextblock) {
        return prev.handlePaste?.(view, event, slice) ?? false
      }
      event.preventDefault()
      const block = code.create({ language: 'latex' }, view.state.schema.text(source))
      // Keep the leading paragraph required by a list item. ProseMirror's
      // generic block insertion can lift an empty answer out of its list,
      // losing the subquestion label the equation belongs to.
      const before = $from.parent.copy($from.parent.content.cut(0, $from.parentOffset))
      const after = $to.parent.copy($to.parent.content.cut($to.parentOffset))
      view.dispatch(view.state.tr.replaceWith(
        $from.before(), $to.after(),
        [before, block, ...(after.content.size > 0 ? [after] : [])],
      ).scrollIntoView())
      return true
    },
  }))
}

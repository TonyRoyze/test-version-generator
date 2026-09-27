import type { Ctx, MilkdownPlugin } from '@milkdown/kit/ctx'
import { createSlice } from '@milkdown/kit/ctx'
import { $nodeSchema, $prose, $view } from '@milkdown/kit/utils'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { Plugin } from '@milkdown/kit/prose/state'
import type { NodeView } from '@milkdown/kit/prose/view'

// Whether the question being edited keeps an inline answer block, and the
// label it shows. Short Answer uses Suggested Answer; objective questions use
// Explanation below their choices.
export type AnswerBlockLabel = 'Suggested Answer' | 'Explanation'
export const suggestedAnswerModeCtx = createSlice<AnswerBlockLabel | false>(false, 'suggestedAnswerMode')

export const suggestedAnswerMode = (label: AnswerBlockLabel | false): MilkdownPlugin => (
  ctx,
) => {
  ctx.inject(suggestedAnswerModeCtx, label)
  return () => () => {
    ctx.remove(suggestedAnswerModeCtx)
  }
}

// The inline answer region is authored inside the editing document and lifted
// back out when the dialog saves. Only the question content reaches storage.
export const suggestedAnswerSchema = $nodeSchema('suggestedAnswer', () => ({
  group: 'block',
  content: 'paragraph block*',
  defining: true,
  attrs: { label: { default: 'Suggested Answer' } },
  parseDOM: [{ tag: 'div[data-type="suggested-answer"]', getAttrs: (dom) => ({ label: (dom as HTMLElement).dataset.label ?? 'Suggested Answer' }) }],
  toDOM: (node) => ['div', { 'data-type': 'suggested-answer', 'data-label': node.attrs.label }, 0],
  parseMarkdown: { match: () => false, runner: () => undefined },
  toMarkdown: { match: () => false, runner: () => undefined },
}))

// Keep the block on the page. A teacher's answer is optional, so an empty block
// is the resting state rather than something to add: it is always there to type
// into, and leaving it empty is how a question ends up with no Suggested
// Answer. Backspacing or cutting it away therefore re-grows an empty one at the
// end of the document rather than removing the affordance for the rest of the
// editing session.
export const keepSuggestedAnswer = $prose((ctx: Ctx) =>
  new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!ctx.get(suggestedAnswerModeCtx)) return null
      if (!transactions.some((tr) => tr.docChanged)) return null
      let present = false
      newState.doc.forEach((node) => {
        if (node.type.name === 'suggestedAnswer') present = true
      })
      if (present) return null
      const block = newState.schema.nodes.suggestedAnswer
      const paragraph = newState.schema.nodes.paragraph
      if (!block || !paragraph) return null
      return newState.tr.insert(
        newState.doc.content.size,
        block.create({ label: ctx.get(suggestedAnswerModeCtx) }, paragraph.create()),
      )
    },
  }),
)

// Node view: the label sits where a choice carries its radio, and the editable
// answer beside it. The label is the whole control — there is nothing to pick.
export const suggestedAnswerView = $view(
  suggestedAnswerSchema.node,
  () => (initialNode: ProseNode): NodeView => {
    let node: ProseNode = initialNode

    const dom = document.createElement('div')
    dom.className = 'sa-block'
    dom.dataset.type = 'suggested-answer'
    dom.dataset.label = String(initialNode.attrs.label)

    const label = document.createElement('div')
    label.className = 'sa-label'
    label.contentEditable = 'false'
    label.textContent = String(initialNode.attrs.label)

    const contentDOM = document.createElement('div')
    contentDOM.className = 'sa-body'

    dom.append(label, contentDOM)

    return {
      dom,
      contentDOM,
      update(next) {
        if (next.type !== node.type) return false
        node = next
        dom.dataset.label = String(next.attrs.label)
        label.textContent = String(next.attrs.label)
        return true
      },
      ignoreMutation: (mutation) => label.contains(mutation.target),
      stopEvent: (event) => label.contains(event.target as Node),
    }
  },
)

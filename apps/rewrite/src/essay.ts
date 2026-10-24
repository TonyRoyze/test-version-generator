import { withAnswerLines } from './answer-lines'
import type { ProseMirrorJSON } from './question-doc'
import { labelAt, sequenceTokenAt, type LabelSequence } from './number-style'

export type EssayType = 'structured-essay' | 'essay'
export function isEssayType(type: string): type is EssayType {
  return type === 'structured-essay' || type === 'essay'
}
export function hasParts(type: string): boolean {
  return type === 'multipart' || isEssayType(type)
}
export function essayPartLabel(type: EssayType, index: number, partCount?: number): string {
  if (type === 'essay' && partCount === 1) return ''
  return labelAt({ sequence: type === 'structured-essay' ? 'lower-roman' : 'upper-alpha', brackets: 'paren' }, index)
}

/** Ordered lists inside an Essay group are subquestions, not answer choices.
 * Labels are derived, so the canonical rich text stays ordinary editable lists. */
export function essayStem(nodes: readonly ProseMirrorJSON[], type: string): ProseMirrorJSON[] {
  if (!isEssayType(type)) return [...nodes]
  const visit = (node: ProseMirrorJSON, depth: number): ProseMirrorJSON => {
    const ordered = node.type === 'ordered_list'
    const sequence = (depth + (type === 'structured-essay' ? 1 : 0)) % 2 === 0 ? 'lower-roman' : 'lower-alpha'
    return {
      ...node,
      ...(ordered ? { attrs: { ...(typeof node.attrs === 'object' && node.attrs !== null ? node.attrs : {}), essaySequence: sequence } } : {}),
      ...(Array.isArray(node.content) ? { content: (node.content as ProseMirrorJSON[]).map((child) => visit(child, depth + (ordered ? 1 : 0))) } : {}),
    }
  }
  return withAnswerLines(nodes).map((node) => visit(node, 0))
}
export function essayListLabel(sequence: unknown, index: number): string | null {
  return sequence === 'lower-roman' || sequence === 'lower-alpha'
    ? `(${sequenceTokenAt(sequence as LabelSequence, index)})`
    : null
}

/** An answer slot for every authored subquestion, including nested prompts.
 * Ordinary rich-text lists keep answers portable through existing bank formats. */
export function subquestionAnswerSlots(stem: readonly ProseMirrorJSON[]): ProseMirrorJSON[] {
  const lists: ProseMirrorJSON[] = []
  for (const node of stem) {
    if (node.type !== 'ordered_list') continue
    const items = Array.isArray(node.content) ? node.content as ProseMirrorJSON[] : []
    lists.push({
      type: 'ordered_list',
      attrs: { order: Number((node.attrs as Record<string, unknown> | undefined)?.order) || 1 },
      content: items.map(item => ({
        type: 'list_item',
        content: [{ type: 'paragraph' }, ...subquestionAnswerSlots(Array.isArray(item.content) ? item.content as ProseMirrorJSON[] : [])],
      })),
    })
  }
  return lists
}

/** The editor requires a leading paragraph before rich answer blocks. An
 * empty one is an insertion point, not a blank row in the answer hierarchy. */
export function essayAnswer(nodes: readonly ProseMirrorJSON[], type: string): ProseMirrorJSON[] {
  const first = nodes[0]
  const placeholder = isEssayType(type) && nodes.length > 1
    && first?.type === 'paragraph'
    && (!Array.isArray(first.content) || first.content.length === 0)
    && nodes[1]?.type !== 'paragraph'
  return essayStem(placeholder ? nodes.slice(1) : nodes, type)
}

import type { ProseMirrorJSON } from './question-doc'

/** Authoring shorthand remains ordinary editable text in the saved question.
 * Only Essay presentation projects it into an answer_lines block. */
export function withAnswerLines(nodes: readonly ProseMirrorJSON[]): ProseMirrorJSON[] {
  return nodes.flatMap((node) => {
    const children = Array.isArray(node.content) ? node.content as ProseMirrorJSON[] : []
    if (node.type === 'code_block') return [node]
    if (node.type !== 'paragraph') {
      return [{ ...node, ...(children.length ? { content: withAnswerLines(children) } : {}) }]
    }
    // Offsets let a marker span differently formatted text nodes without losing
    // the formatting, links, images or maths on either side. Inline code is literal.
    const source = children.map((child) => child.type === 'text'
      && !(Array.isArray(child.marks) && child.marks.some((mark) => mark.type === 'inlineCode' || mark.type === 'code'))
      ? String(child.text ?? '') : '\uFFFC'.repeat(typeof child.text === 'string' ? child.text.length : 1)).join('')
    const matches = [...source.matchAll(/<([1-9]|1\d|20)lines?>/gi)]
    if (!matches.length) return [node]
    const slice = (from: number, to: number): ProseMirrorJSON[] => {
      let offset = 0
      return children.flatMap((child) => {
        const length = typeof child.text === 'string' ? child.text.length : 1
        const start = Math.max(from - offset, 0)
        const end = Math.min(to - offset, length)
        offset += length
        if (start >= end) return []
        return [child.type === 'text' ? { ...child, text: String(child.text).slice(start, end) } : child]
      })
    }
    const blocks: ProseMirrorJSON[] = []
    let offset = 0
    for (const match of matches) {
      const content = slice(offset, match.index)
      if (blocks.length === 0 || content.some((child) => child.type !== 'text' || String(child.text).trim())) {
        blocks.push({ ...node, content })
      }
      blocks.push({ type: 'answer_lines', attrs: { lines: Number(match[1]) } })
      offset = match.index + match[0].length
    }
    const tail = slice(offset, source.length)
    if (tail.some((child) => child.type !== 'text' || String(child.text).trim())) blocks.push({ ...node, content: tail })
    return blocks
  })
}

/** Fixed ruled rows shared by the read view and both file adapters. */
export function answerLinesSpace(lines: number) {
  return { height: 24 + (lines - 1) * 32, style: 'lines' as const, lines, fill: false, rows: { first: 24, pitch: 32 } }
}

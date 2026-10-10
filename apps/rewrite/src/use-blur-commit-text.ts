import { useState } from 'react'

/** Keep keystrokes inside the field; publish one change when editing ends. */
export function useBlurCommitText(value: string, onCommit?: (value: string) => void) {
  const [draft, setDraft] = useState<string | null>(null)
  return {
    value: draft ?? value,
    onFocus: () => setDraft(value),
    onChange: (text: string) => setDraft(text.replace(/\s*\n\s*/g, ' ')),
    onBlur: () => {
      if (draft !== null && draft !== value) onCommit?.(draft)
      setDraft(null)
    },
  }
}

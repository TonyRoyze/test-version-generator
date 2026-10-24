import { expect, test } from 'bun:test'
import { pastedDisplayLatex } from './answer-latex'

test('recognizes complete LaTeX blocks without changing their multiline source', () => {
  const source = String.raw`\begin{aligned}
M(\mathrm{CuSO_4}) &= 64 + 32 + (16 \times 4) = 160\ \mathrm{g\,mol^{-1}}\\
V &= \frac{500}{1000} = 0.5\ \mathrm{dm^3}\\
m &= CVM\\
  &= 1 \times 0.5 \times 160\\
  &= 80\ \mathrm{g}
\end{aligned}`
  expect(pastedDisplayLatex(source)).toBe(source)
  expect(pastedDisplayLatex(`$$\n${source}\n$$`)).toBe(source)
  expect(pastedDisplayLatex(`\\[\n${source}\n\\]`)).toBe(source)
  expect(pastedDisplayLatex(String.raw`\begin{align*}x &= 1\end{align*}`)).not.toBeNull()
})

test('leaves prose, incomplete environments and ordinary inline equations alone', () => {
  for (const source of ['', 'The mass is 80 g.', '$m = CVM$', String.raw`\begin{aligned}x &= 1`, String.raw`\begin{aligned}x &= 1\end{matrix}`, 'Before $$x$$ after']) {
    expect(pastedDisplayLatex(source)).toBeNull()
  }
})

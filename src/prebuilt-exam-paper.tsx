import type { CoverPageTemplate } from './cover-templates/templates'
import { PaperBookCover } from './cover-templates/paper-book'

/** A representative first question page paired with each prebuilt cover. */
export function PrebuiltExamPaper({ template }: { template: CoverPageTemplate }) {
  const { cover } = template
  if (template.id === 'paper-book') return <PaperBookCover cover={cover} printedPageCount={5} disabled pageNumber={2} answers={[{ number: '4', answer: '(2)', reason: 'The pressure increases with depth in the liquid.' }, { number: '5', answer: '(3)' }]}>
    <div className="space-y-8 font-[Georgia,serif] text-[15px] leading-[1.35]">
      <section>
        <strong className="font-sans text-[13px]">GCE O/L 2007</strong>
        <p className="mt-4">4. Write a multiple choice question here. Add a diagram in the question editor if needed.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 pl-5">
          <span>(1) First choice</span><span>(2) Second choice</span>
          <span>(3) Third choice</span><span>(4) Fourth choice</span>
        </div>
      </section>
      <section>
        <strong className="font-sans text-[13px]">GCE O/L 2008</strong>
        <p className="mt-4">5. The next editable question appears below it.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 pl-5">
          <span>(1) First choice</span><span>(2) Second choice</span>
          <span>(3) Third choice</span><span>(4) Fourth choice</span>
        </div>
      </section>
    </div>
  </PaperBookCover>
  return (
    <div className="prebuilt-exam-paper-content">
      <header>
        <strong>{cover.schoolName || 'School Name'}</strong>
        <span>{cover.assessment || 'Assessment'}</span>
        <span>{cover.subject || 'Subject'} · {cover.grade || 'Grade'}</span>
      </header>
      <div className="prebuilt-exam-paper-rule" />
      <h4>Section A — Multiple Choice</h4>
      <p>Answer each question by selecting the best answer.</p>
      {[1, 2, 3, 4].map((number) => (
        <div className="prebuilt-exam-question" key={number}>
          <strong>{number}.</strong>
          <div>
            <span>Write your question here.</span>
            <ol type="A"><li>Answer option</li><li>Answer option</li></ol>
          </div>
        </div>
      ))}
      <footer>Page 2</footer>
    </div>
  )
}

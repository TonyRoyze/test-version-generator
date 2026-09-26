import type { ExamCover } from './page-cover'

/** A representative first question page paired with each prebuilt cover. */
export function PrebuiltExamPaper({ cover }: { cover: ExamCover }) {
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

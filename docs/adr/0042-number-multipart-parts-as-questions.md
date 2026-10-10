---
status: accepted
---

# Number Multipart Parts as questions on the paper

A teacher needs the questions following shared material to have ordinary question numbers, rather than letters beneath one numbered parent. Each Part of a Multipart question therefore takes one consecutive question number, using the Exam's question-number sequence and punctuation. The shared stem prints unnumbered before the first Part and stays with it wherever they fit on a page; later Parts can continue on subsequent pages. The next Question starts after the numbers those Parts took, and a numbering restart at the group starts its first Part at one.

This supersedes ADR 0024's printed numbering and grouped Answer Key. The authoring model stays whole: the Question Bank keeps one Multipart question, Exams add, move, remove and vary that group together, and Parts keep their authored order and presentation identities. The Answer Key gives each Part its own numbered entry with its correct answer or Suggested Answer and the group's metadata. Paper Book's answers column uses those same numbers. Creating independent bank Questions would separate the Parts from the shared material they need, so numbering belongs to the Layout Plan instead.

New planned Parts carry their question number. Previously recorded Parts lack that number and retain their lettered layout when re-exported, as immutable Export Records require. The stored Question and exchange format do not change.

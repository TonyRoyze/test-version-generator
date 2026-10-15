# Question Bank Record 0.11.0

This version adds `structured-essay` and `essay` to the existing question types. Both contain a rich-text `stem` and an ordered `parts` array. Each part has a unique package-local id, `type: "short-answer"`, a rich-text `stem`, and an optional `suggestedAnswer`. Parent questions cannot carry choices or a Suggested Answer; answers belong to their parts.

Structured Essay prints one question number and Parts labelled (i), (ii), …. Essay prints one question number and groups labelled (A), (B), …; a single group omits its letter. Both use dedicated written Parts with no automatic Work Space or resize handles. Markers such as `<2lines>` or `<2line>` in a Part’s text create ruled answer space at that position (1–20 lines). In an Essay group's stem, ordered lists represent roman-labelled subquestions; nesting adds alphabetic labels. Labels are derived presentation; answer-space markers remain editable text in the record. The parent Essay type restores the portable `short-answer` shape as a dedicated written Part.

All 0.10.0 rich text, media, explanations, and other question types remain supported. Each retained format version is validated against its own unchanged schema before migration. Public schemas and examples are in `apps/rewrite/public/formats/question-bank/0.11.0/`.

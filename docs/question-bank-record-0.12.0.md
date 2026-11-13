# Question Bank Record 0.12.0

Each Question may carry an optional `source` string, an attribution such as `GCE O/L 2024 34` or `GCE O/L 2024 2 (i) a)`. It belongs to the whole Question, independently of its type and of any Exam numbering. It is free text; punctuation and nested references have no special syntax. Blank sources are omitted when saved or exported.

Sources appear in the Question Bank, import preview and Question Bank PDF, and participate in bank search. Student tests and copied question content keep their existing presentation.

All 0.11.0 content remains supported. Older records continue to validate against their own schemas and migrate forward without a source; an unknown `source` on an older record is discarded. Schemas and examples are published under `apps/rewrite/public/formats/question-bank/0.12.0/`.

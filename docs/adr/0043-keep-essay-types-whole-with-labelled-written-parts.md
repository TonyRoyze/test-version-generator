---
status: accepted
---

# Keep Structured Essay and Essay as distinct whole Questions

The reference Science II paper uses one number for a Structured Essay with roman-labelled written prompts, and one number for an Essay containing capital-labelled groups and further roman and alphabetic prompts. These are distinct Question Types; neither changes Multipart's consecutive numbering established in ADR 0042.

Reuse the existing Part authoring and Suggested Answer components. Essay Parts are written responses only. Written Parts are distinct from Short Answer Parts: they have no automatic Work Space, Work Space menu or resizing handle. Response areas are authored in the Part text with `<2lines>` (or `<2line>`) markers, which the shared presentation projects into ruled blocks at that position. Legacy Exam Work Space settings for these Parts are ignored, so they cannot restore unwanted space. One bank Question, one random-selection quota, and one replacement always encompass the whole hierarchy. Parts are never shuffled independently. An Essay with a single Part omits its group letter in authoring, previews, the paper and Answer Key; multiple groups retain (A), (B), ….

An Essay Part's numbered rich-text lists express its subquestions. The editor provides Add subquestions; ordinary Enter and list indentation author further prompts and nested levels. Labels are derived from the Question Type by the shared Layout Plan, not stored as manually typed content. The editor and bank previews show the same conventions. Suggested Answers remain answer material and never print on the student test.

Question Bank Record 0.11.0 adds `structured-essay` and `essay`, using the existing `parts` representation restricted to written responses. The portable `short-answer` shape remains compatible; the parent Essay type determines that the domain Part is written rather than a Short Answer Part. Older format schemas remain unchanged and older records continue to import. Existing Export Records retain their captured labels and layout; a historical export is never rebuilt with the new defaults.

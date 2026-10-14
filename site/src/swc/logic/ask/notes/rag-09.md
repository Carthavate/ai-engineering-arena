---
item: rag-9
---
## The problem with one separator
CharacterTextSplitter splits on a single separator. If a paragraph is longer than chunk_size and contains no such separator, you get oversized chunks or awkward cuts.

## RecursiveCharacterTextSplitter
The recursive splitter takes a list of separators in priority order, by default ["\n\n", "\n", ". ", " ", ""]. It first tries to split on paragraph breaks; any piece still too big is split on line breaks, then sentence ends, then spaces, and only as a last resort on single characters. The course demonstrates this with chunk_size=100 and chunk_overlap=0 to make the difference visible.

## Token-based splitting
Models count tokens, not characters. Token-based splitters (for example with tiktoken) measure chunk size in tokens, which is safer when you must stay under a model's context or embedding limit.

## Structure-aware splitting
For Markdown and code, LangChain offers splitters that understand the structure: they split on headings, or on functions and classes for a given programming language, so each chunk is a meaningful unit.

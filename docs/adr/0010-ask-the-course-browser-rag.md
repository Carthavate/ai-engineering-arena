# ADR-0010: "Ask the course" is RAG in the browser over our own notes

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

We wanted a chatbot that answers questions about the RAG course, built with the same techniques the course teaches. Raw video transcripts belong to the course author and this repository is public, so they can't be republished. Paid model APIs are ruled out (ADR-0006).

## Decision

- The knowledge base is our **own lecture notes**, original summaries in `site/src/swc/logic/ask/notes/`, plus each player's **private notes**, stored only in their browser (IndexedDB, behind `LibraryPort`).
- Retrieval is **hybrid**:
  - BM25 and MiniLM embeddings, fused with reciprocal rank fusion (k = 60).
  - The top 4 chunks are sent to the model.
  - Embeddings are cached by content hash, so text is embedded once.
- Generation uses the local Qwen2.5-0.5B. Follow-ups are rewritten into standalone questions first (lesson #7).
- The 0.5B model doesn't cite sources reliably: it ignored instructions and copied format examples. So citations are added **after** generation, by matching each sentence to the source it overlaps most (BM25).
- Search works without the model. The model is opt-in, because of its size.
- The UI shows every pipeline step.

## Consequences

- Free, private, and educational.
- Answer quality is limited by a 0.5B model, but the sources shown are always the real retrieved passages.
- Adding a lecture means writing its note. A test checks that every RAG lecture has one.

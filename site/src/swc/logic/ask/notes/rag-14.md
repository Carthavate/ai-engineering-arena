---
item: rag-14
---
## One query is a narrow window
The user's wording might not match the wording in the documents. A single embedding of a single phrasing can miss relevant chunks, especially for vague or broad questions.

## Generating variations
Multi-query retrieval asks an LLM to rewrite the question into several variations that approach it from different angles. The course uses gpt-4o with structured output (a Pydantic model holding a list of queries) to get exactly 3 variations.

## Retrieve for each, then merge
Each variation is used to retrieve chunks (k=5 each). The result lists are combined and de-duplicated, so the final set covers more of the relevant material than any single query would. This mainly improves recall.

## Cost and next step
It costs an extra LLM call and several searches per question. Merging lists by simple union ignores how highly each chunk ranked, which is what reciprocal rank fusion fixes in the next lesson.

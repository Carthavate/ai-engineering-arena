---
item: rag-11
---
## Letting an LLM chunk
Agentic chunking hands the text to an LLM and asks it to decide where chunks should begin and end, grouping sentences that belong to the same idea. The course uses gpt-3.5-turbo with temperature 0 and a prompt that describes how to split.

## Propositions
A related idea is to rewrite text into propositions: short, self-contained statements such as "Model Y represents 60% of Tesla's vehicle sales." Each proposition can be understood without its neighbours, which makes it a very clean unit to embed and retrieve.

## Trade-offs
It is the most expensive and slowest strategy: every document passes through an LLM during ingestion. Results can vary between runs and the LLM may drop or alter details. It shines on messy text where structure-based or embedding-based splitting struggles, and is overkill for clean, well-structured documents.

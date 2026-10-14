---
item: rag-8
---
## Why chunking matters
Retrieval returns chunks, not documents, so how you split text decides what the model gets to see. A chunk that cuts an idea in half, or mixes three topics, makes both retrieval and answers worse.

## Strategies
Fixed-size chunking cuts every N characters; it is simple but splits mid-sentence. Recursive chunking tries natural boundaries first (paragraphs, then lines, then sentences, then words). Semantic chunking splits where the meaning changes, measured with embeddings. Agentic chunking lets an LLM decide the boundaries. Each step up costs more but respects the text better.

## Chunk size trade-offs
Small chunks are precise but can lose the surrounding context needed to understand them. Large chunks keep context but blur several topics into one embedding, which weakens similarity search, and they use more of the prompt. There is no universal best size; it depends on the documents and the questions, so test a few.

## Overlap
Chunk overlap repeats the end of one chunk at the start of the next. It protects sentences and facts that straddle a boundary, at the cost of storing some text twice.

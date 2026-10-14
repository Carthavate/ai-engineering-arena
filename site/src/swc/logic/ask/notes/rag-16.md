---
item: rag-16
---
## Dense vs sparse retrieval
Vector search (dense retrieval) matches meaning: it finds "electric car maker" for a question about Tesla's business. Keyword search (sparse retrieval) matches exact words. Each fails where the other succeeds.

## BM25
BM25 is the classic keyword scoring function. A chunk scores higher when it contains the query terms often (term frequency, with diminishing returns), when those terms are rare across all chunks (inverse document frequency), and it is normalised for chunk length so long chunks don't win just by being long.

## When keywords win
Exact terms such as product names, numbers and codes ("Cybertruck", "7.5 billion") are often handled poorly by embeddings but found instantly by BM25.

## Hybrid search
The course builds a BM25Retriever and a vector retriever over the same documents and combines them with LangChain's EnsembleRetriever using weights=[0.7, 0.3]: 70% vector, 30% keyword. The ensemble merges the two ranked lists with weighted reciprocal rank fusion, giving the best of both.

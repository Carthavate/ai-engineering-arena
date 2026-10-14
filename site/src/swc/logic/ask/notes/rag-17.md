---
item: rag-17
---
## Two-stage retrieval
Fast retrievers (vector or hybrid) are good at finding a broad set of candidates but imperfect at ordering them. Reranking adds a second stage: retrieve many candidates cheaply, then reorder them with a more accurate model and keep only the best.

## Bi-encoders vs cross-encoders
Embedding models are bi-encoders: the query and each document are encoded separately, so document vectors can be computed in advance and searched quickly. A cross-encoder reads the query and one document together and outputs a relevance score. It is much more accurate, but it must run once per query-document pair, so it is only used on the shortlist.

## In the course
Candidates come from the hybrid retriever, then Cohere's rerank-english-v3.0 model reorders them and keeps top_n=10.

## Trade-offs and next steps
Reranking adds latency and, with an API, cost per query, in exchange for noticeably better top results. The usual next steps are evaluating retrieval and answers on a test set, then tuning chunking, retrieval and prompts based on what the evaluation shows.

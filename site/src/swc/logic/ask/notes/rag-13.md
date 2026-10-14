---
item: rag-13
---
## Beyond plain similarity
A basic retriever returns the k most similar chunks. The course compares three retrieval methods on the same vector store.

## Similarity search
search_kwargs={"k": 3}: always returns the top 3 chunks, however weak the match.

## Score threshold
search_type="similarity_score_threshold" with score_threshold=0.3 returns only chunks above a similarity cutoff, so unrelated questions return fewer or no chunks.

## Maximal marginal relevance (MMR)
Top results are often near-duplicates of each other, wasting the prompt on the same fact. MMR first fetches a larger pool (fetch_k=10), then picks k results one at a time, balancing relevance to the query against difference from what is already picked. lambda_mult controls the balance: 1 means pure relevance, 0 means maximum diversity; the course uses 0.5.

## Metadata filtering
Chunks carry metadata such as the source file. Filtering on metadata (for example only documents about one company) narrows the search before similarity is computed.

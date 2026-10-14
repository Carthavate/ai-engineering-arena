---
item: rag-15
---
## Combining ranked lists
When several retrievers or query variations each return a ranked list, we need one final ranking. Their raw scores are often not comparable (different scales, different methods), but their ranks are.

## The formula
Reciprocal rank fusion gives each document a score of the sum over all lists of 1 / (k + rank), where rank starts at 1 for the top result in each list. Documents ranked high in many lists win. The course implements this by hand with k=60.

## The k constant
k dampens the advantage of the very top positions. With k=60, rank 1 is worth 1/61 and rank 2 is worth 1/62, so a document that appears in several lists usually beats one that is first in only one list. A small k would let single top-ranked documents dominate.

## Why it works well
RRF needs no score normalisation and no tuning beyond k, it is cheap, and it is robust. It is the standard way to merge multi-query results and to combine keyword and vector search in hybrid retrieval.

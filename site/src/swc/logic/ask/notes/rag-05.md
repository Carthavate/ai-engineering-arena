---
item: rag-5
---
## The formula
Cosine similarity measures the angle between two vectors: cos(a, b) = (a · b) / (|a| × |b|). The dot product a · b multiplies matching components and adds them up; |a| is the vector's length (magnitude), the square root of the sum of its squared components.

## The range of values
The result lies between -1 and 1. A value of 1 means the vectors point in exactly the same direction (very similar meaning), 0 means they are unrelated (perpendicular), and -1 means opposite directions. With sentence embeddings most scores fall between about 0 and 1.

## Why direction, not length
Cosine ignores vector length, so a long document and a short sentence about the same topic can still score high. Only the direction, the "meaning", matters.

## Normalised vectors
If vectors are normalised to length 1, the denominator is 1 and cosine similarity equals the plain dot product, which is faster to compute. Many embedding pipelines normalise for exactly this reason.

## Similarity vs distance
Vector databases often report cosine distance, which is 1 - cosine similarity. Smaller distance means more similar. Chroma's {"hnsw:space": "cosine"} setting makes it rank results by this distance.

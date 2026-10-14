---
item: rag-10
---
## Splitting by meaning
Semantic chunking puts a boundary where the topic changes instead of after a fixed number of characters. LangChain's SemanticChunker does this using an embedding model (all-MiniLM-L6-v2 in the course).

## How it works
The text is split into sentences and each sentence is embedded. The chunker then measures the distance between the embeddings of consecutive sentences. Where the distance jumps, the meaning changed, and a new chunk starts.

## Breakpoint thresholds
You choose what counts as a jump. With breakpoint_threshold_type="percentile" and breakpoint_threshold_amount=70 (the course's setting), any gap larger than 70% of all gaps becomes a split. Other options are "standard_deviation" and "interquartile". A lower threshold creates more, smaller chunks.

## Cost
Every sentence must be embedded during ingestion, which is slower and more expensive than character splitting, and chunk sizes become uneven. In return, chunks tend to hold one coherent idea, which helps retrieval on documents that jump between topics.

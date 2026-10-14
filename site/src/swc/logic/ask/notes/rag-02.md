---
item: rag-2
---
## Vector embeddings
An embedding is a list of numbers (a vector) that represents the meaning of a piece of text. An embedding model is trained so that texts with similar meanings get vectors that point in similar directions. "A kitten is sleeping" and "The cat is napping" end up close together even though they share almost no words.

## The model used in the course
The course uses sentence-transformers/all-MiniLM-L6-v2 through LangChain's HuggingFaceEmbeddings. It is small, free, runs locally and turns any text into a 384-dimensional vector. The Ask the course tab on this site uses the same model in your browser.

## Semantic similarity
Because meaning becomes geometry, "find related text" becomes "find nearby vectors". Similarity is usually measured with cosine similarity, which compares the direction of two vectors.

## Vector databases
A vector database stores embeddings together with the original text and metadata, and can quickly find the vectors closest to a query vector, even among millions. The course uses Chroma, which saves everything to a folder on disk.

## Two pipelines
The ingestion pipeline turns documents into searchable vectors: load, split into chunks, embed, store. The retrieval pipeline answers questions: embed the question with the same model, search the database for the nearest chunks, and send the top chunks to the LLM. The question and the chunks must be embedded with the same model, otherwise their vectors are not comparable.

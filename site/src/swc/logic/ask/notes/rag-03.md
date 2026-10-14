---
item: rag-3
---
## Loading documents
The ingestion script loads every text file in a docs folder with DirectoryLoader and TextLoader. The sample data is a set of company descriptions (Google, Microsoft, Nvidia, SpaceX, Tesla). Each loaded file becomes a LangChain Document with page_content (the text) and metadata such as the source file path.

## Splitting into chunks
Whole documents are too long to embed well and too long to paste into a prompt, so they are split into chunks. The first version uses CharacterTextSplitter with chunk_size=800 characters and chunk_overlap=0. Chunk size controls how much text each vector represents; overlap repeats a little text between neighbouring chunks so a sentence cut at a boundary still appears whole somewhere.

## Embedding and storing
Each chunk is embedded with all-MiniLM-L6-v2 and stored in a Chroma vector store persisted to db/chroma_db. The collection is created with collection_metadata {"hnsw:space": "cosine"}, so Chroma's HNSW index measures closeness with cosine distance.

## Why persist the database
Embedding is the expensive part. Persisting to disk means ingestion runs once; later scripts simply open the existing database. Re-run ingestion only when the documents change.

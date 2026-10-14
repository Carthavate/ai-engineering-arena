---
item: rag-4
---
## Opening the vector store
The retrieval script opens the persisted Chroma database from db/chroma_db, passing the same embedding model used during ingestion and the same cosine setting. Using a different embedding model at query time would make the similarity scores meaningless.

## Retrievers
In LangChain, db.as_retriever() wraps the vector store in a retriever: an object you invoke with a question that returns a list of Documents. With search_kwargs={"k": 5} it returns the 5 chunks most similar to the question, best first. Each result keeps its metadata, so you can show where the text came from.

## Top-k
k is a trade-off. A small k gives the LLM less noise but may miss the chunk that contains the answer. A large k improves the chance of including it but costs more prompt tokens and can distract the model.

## Score thresholds
Instead of a fixed k you can use search_type="similarity_score_threshold" with a score_threshold such as 0.3. Only chunks at least that similar are returned. That avoids sending irrelevant chunks for questions the documents can't answer, but it can return nothing at all, so the app must handle an empty result.

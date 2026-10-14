---
item: rag-6
---
## Putting it together
The first complete RAG app runs the whole flow: take a question, retrieve the top chunks with the retriever (k=5), build a prompt that contains the question and the retrieved text, and send it to a chat model (gpt-4o in the course) to write the answer.

## The prompt
The retrieved chunks are pasted into the prompt as context, followed by an instruction along the lines of "answer using only these documents". The model receives a system message describing its role and a human message with the question and the documents.

## Grounding and "I don't know"
The key instruction is that the model must answer from the provided documents and say it doesn't know when the answer isn't there. Without that, the model falls back on its own memory and may hallucinate, which defeats the purpose of RAG.

## End-to-end flow
Question, embed, search, top-k chunks, prompt, LLM, answer. Every RAG improvement in the rest of the course plugs into one of these steps: better chunks, better retrieval, better ranking, or a better prompt.

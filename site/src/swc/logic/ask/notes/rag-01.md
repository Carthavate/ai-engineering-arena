---
item: rag-1
---
## What RAG is
Retrieval augmented generation (RAG) lets a language model answer questions using documents it was never trained on. Instead of hoping the model remembers a fact, we first look up the relevant text and paste it into the prompt, then ask the model to answer from that text.

## Why it exists
A model only knows its training data, and that data stops at a knowledge cutoff date. It has never seen your company's internal documents, your lecture PDFs or yesterday's news. When asked about something it doesn't know, a model often hallucinates: it produces a fluent, confident answer that is wrong. RAG reduces this by grounding the answer in real sources.

## Two steps: retrieval then generation
Retrieval finds the pieces of text (chunks) most related to the question. Generation gives those chunks plus the question to the LLM, which writes the answer. If retrieval returns the wrong chunks, even a great model can't answer well, so retrieval quality matters as much as the model.

## Indexing time vs query time
Some work happens once, ahead of time: loading documents, splitting them into chunks, embedding the chunks and storing them in a vector database. This is the ingestion (indexing) pipeline. Other work happens on every question: embedding the question, searching for similar chunks and generating the answer. This is the retrieval pipeline.

## RAG vs fine-tuning
Fine-tuning bakes knowledge into the model's weights, which is slow and must be redone when facts change. With RAG you update knowledge by updating documents, and you can show which sources an answer came from.

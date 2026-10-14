---
item: rag-7
---
## Why chat history breaks naive RAG
In a conversation people ask follow-ups like "and what about its revenue?". Searching the vector database with that sentence alone finds nothing useful, because "its" only makes sense with the previous messages.

## Rewriting into a standalone question
The fix is a history-aware step. Before retrieving, the app sends the chat history and the new question to the LLM and asks it to rewrite the question so it can be understood on its own, for example "What is Tesla's revenue?". That standalone question is what gets embedded and searched.

## The conversational loop
The course's chat keeps a list of messages. For each turn it (1) rewrites the question if there is history, (2) retrieves the top chunks (k=3) with the rewritten question, (3) answers using the chunks plus the conversation, and (4) appends both the question and the answer to the history before the next turn.

## Trade-offs
The rewrite costs an extra LLM call per turn, but without it follow-up questions retrieve the wrong chunks. Long histories also cost tokens, so real apps keep only recent turns or summarise older ones.

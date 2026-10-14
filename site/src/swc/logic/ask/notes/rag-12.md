---
item: rag-12
---
## Documents are more than text
Real PDFs contain images, charts and tables. A text-only pipeline either drops them or turns tables into jumbled text, so questions about them fail.

## Partitioning with unstructured
The course uses unstructured's partition_pdf with strategy="hi_res" (most accurate, slower), infer_table_structure=True (keeps tables as structured HTML) and image extraction into base64 payloads. The result is a list of typed elements: titles, narrative text, tables and images. The example document is the "Attention Is All You Need" paper.

## Chunking by title
Elements are grouped with a title-based strategy so each chunk follows the document's sections, with a hard limit of 3000 characters per chunk. A chunk keeps references to the tables and images it contains.

## Summaries for retrieval
Images and tables don't embed well as raw data, so an LLM (with vision for images) writes a text summary of each. The summaries are embedded and searched, while the original table or image is kept and passed to the model when generating the answer.

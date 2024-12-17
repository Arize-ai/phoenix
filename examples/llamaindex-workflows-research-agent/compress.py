from typing import List

from llama_index.core import VectorStoreIndex
from llama_index.core.embeddings import BaseEmbedding
from llama_index.core.postprocessor import SimilarityPostprocessor
from llama_index.core.schema import Document
from llama_index.core.text_splitter import SentenceSplitter


async def get_compressed_context(
    query: str, docs: List[Document], embed_model: BaseEmbedding
) -> str:
    index = VectorStoreIndex.from_documents(
        docs,
        embed_model=embed_model,
        transformations=[SentenceSplitter()],
    )

    retriever = index.as_retriever(similarity_top_k=100)

    nodes = retriever.retrieve(query)

    processor = SimilarityPostprocessor(similarity_cutoff=0.38)
    filtered_nodes = processor.postprocess_nodes(nodes)
    # print(filtered_nodes)
    print(
        f"\n> Filtered {len(filtered_nodes)} nodes from {len(nodes)} nodes for subquery: {query}\n"
    )

    context = ""

    for node_with_score in filtered_nodes:
        node = node_with_score.node
        node_info = (
            f"---\nSource: {node.metadata.get('source', 'Unknown')}\n"
            f"Title: {node.metadata.get('title', '')}\n"
            f"Content: {node.text}\n---\n"
        )
        context += node_info + "\n"

    return context

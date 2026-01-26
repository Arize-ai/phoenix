# Graph Attributes

Detailed reference for graph/workflow structures (e.g., LangGraph).


## Node Identification

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `metadata.graph.node.id` | String | Node identifier in graph | "retrieval_node" |
| `metadata.graph.node.name` | String | Human-readable node name | "Document Retrieval" |
| `metadata.graph.parent.id` | String | Parent node ID (for subgraphs) | "main_graph" |

## Graph Structure

```json
{
  "openinference.span.kind": "CHAIN",
  "metadata.graph.node.id": "retrieval_node",
  "metadata.graph.node.name": "Document Retrieval",
  "metadata.graph.parent.id": "qa_workflow",
  "metadata.graph.execution_order": 2,
  "input.value": "machine learning",
  "output.value": "[{\"doc_id\": \"doc_123\", \"content\": \"...\"}]"
}
```

## LangGraph Example

LangGraph traces typically have:
- Root CHAIN span for the graph
- Child CHAIN spans for each node
- LLM/RETRIEVER/TOOL spans as children of node spans

**Complete example:**
```
Trace: LangGraph QA Workflow
├─ CHAIN: qa_workflow (root)
│  ├─ CHAIN: retrieval_node (graph.node.id = "retrieval_node")
│  │  └─ RETRIEVER: vector_search
│  │     └─ EMBEDDING: embed_query
│  ├─ CHAIN: rerank_node (graph.node.id = "rerank_node")
│  │  └─ RERANKER: cohere_rerank
│  └─ CHAIN: answer_node (graph.node.id = "answer_node")
│     └─ LLM: generate_answer
```

Each node span attributes:
```json
{
  "openinference.span.kind": "CHAIN",
  "metadata.graph.node.id": "retrieval_node",
  "metadata.graph.node.name": "Document Retrieval",
  "metadata.graph.parent.id": "qa_workflow"
}
```

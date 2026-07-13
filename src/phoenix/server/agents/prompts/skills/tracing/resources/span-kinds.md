# Span Kinds

Every OpenInference span carries `openinference.span.kind` (surfaced as `spanKind` in GraphQL,
`span_kind` in CLI/filters). The kind tells you what work the span did and therefore which
attributes to expect on it — see `semantic-conventions` for the attribute lists.

There are **11** kinds. `UNKNOWN` is a fallback; the other 10 are semantic.

| Kind | What it represents | Look for |
| ---- | ------------------ | -------- |
| `LLM` | A single call to a language model. | `llm.model_name`, `llm.input_messages.*`, `llm.output_messages.*`, `llm.token_count.*`, `llm.invocation_parameters` |
| `EMBEDDING` | Turning text into vectors. | `embedding.model_name`, `embedding.embeddings.*.embedding.text` / `.vector` |
| `RETRIEVER` | Fetching documents/chunks (the "R" in RAG). | `retrieval.documents.*.document.content` / `.id` / `.score` |
| `RERANKER` | Reordering retrieved documents by relevance. | `reranker.model_name`, `reranker.query`, `reranker.input_documents.*`, `reranker.output_documents.*`, `reranker.top_k` |
| `TOOL` | Executing an external tool or function. | `tool.name`, `tool.description`, `tool.parameters`, plus `input.value` / `output.value` |
| `CHAIN` | A link/step that wires other spans together; the generic "some work happened" node. | Often just `input.value` / `output.value`; children carry the specifics |
| `AGENT` | A reasoning block that coordinates LLMs and tools, usually the root of an agent turn. | `agent.name`; children of mixed kinds; good target for end-to-end (task/trajectory) judgments |
| `GUARDRAIL` | A safety/policy check (jailbreak, PII, content filter). | `input.value` / `output.value`; a pass/block decision |
| `EVALUATOR` | Assessing another output (LLM-as-judge or code eval) as part of the app. | `input.value` / `output.value`; a score or label as output |
| `PROMPT` | Rendering a prompt template into a concrete prompt. | `llm.prompt_template.template` / `.variables` / `.version` |
| `UNKNOWN` | The instrumentor didn't set a kind. | Treat as un-typed; fall back to `input.value` / `output.value` and the span name |

## Using span kind well

- **Pick the right span to inspect or annotate by its kind.** Model quality lives on the `LLM` span;
  retrieval quality on the `RETRIEVER` span; tool behavior on the `TOOL` span; end-to-end task success
  on the `AGENT`/root span. Pinning a judgment to the wrong kind makes it hard to act on later.
- **A trace is usually a tree of mixed kinds.** A single RAG turn might be `CHAIN → RETRIEVER →
  (RERANKER) → LLM`. An agent turn might be `AGENT → LLM → TOOL → LLM …`. Read the tree, not one node.
- **Kind is structure, not correctness.** An `LLM` span with `statusCode == "OK"` can still contain a
  hallucination; a `TOOL` span with an exception may be expected. The attributes are the evidence.
- **`CHAIN` and `UNKNOWN` are low-information by design.** When you hit one, the useful detail is almost
  always on its children or in `input.value` / `output.value`, not the node itself.

## Where the kind shows up

- GraphQL: `Span.spanKind`.
- CLI / span `filterCondition`: `span_kind == 'LLM'` (values are the upper-case strings above).
- Raw attribute: `openinference.span.kind`.

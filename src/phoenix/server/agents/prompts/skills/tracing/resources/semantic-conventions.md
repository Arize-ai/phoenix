# Semantic Conventions Lookup

OpenInference is the semantic-convention spec that says *which attribute key carries which value* on
a span. When you need to read or filter on a value and aren't sure of the key, look it up here first —
never guess a key. The authoritative source is the `openinference-semantic-conventions` package (a
Phoenix dependency); this resource is the fast path for the attributes that matter in practice.

## How attributes are shaped

- **Dot-namespaced keys.** Every attribute is a flat string key like `llm.model_name` or
  `retrieval.documents.0.document.content`. There is no nesting in storage — the dots are the structure.
- **Lists are index-flattened.** A list becomes `<prefix>.<i>.<field>` with a zero-based integer index:
  the first input message's role is `llm.input_messages.0.message.role`, its content is
  `llm.input_messages.0.message.content`. Increment the index for later elements.
- **Absence means "not emitted," not "zero."** An instrumentor populates only what it captures. A
  missing `llm.token_count.total` means the token count was never recorded, not that it was 0.

## Namespace map

| Namespace | Carries |
| --------- | ------- |
| `openinference.span.kind` | The span kind (see `span-kinds`). |
| `input.*` / `output.*` | `value` (the raw payload) and `mime_type`. Present on almost every kind. |
| `llm.*` | Everything about a model call: `model_name`, `provider`, `system`, `input_messages.*`, `output_messages.*`, `invocation_parameters`, `tools.*`, `token_count.*`, `cost.*`, `prompt_template.*`, `finish_reason`. |
| `message.*` (inside `llm.*_messages.*`) | `role`, `content`, and tool calls: `message.tool_calls.*.tool_call.function.name` / `.arguments`. |
| `retrieval.documents.*.document.*` | Retrieved chunks: `id`, `content`, `score`, `metadata`. |
| `embedding.*` | `model_name`, and `embeddings.*.embedding.text` / `.vector`. |
| `reranker.*` | `model_name`, `query`, `top_k`, `input_documents.*`, `output_documents.*`. |
| `tool.*` | Tool definition/call: `name`, `description`, `parameters`, `json_schema`. |
| `session.id` | Groups spans/traces into a multi-turn session. |
| `user.id` | The end user the request belongs to. |
| `metadata` | Arbitrary app-supplied JSON on the span. |
| `tag.tags` | Freeform categorization tags. |
| `prompt.*` | Prompt provenance: `id`, `url`, `vendor`. |
| `graph.node.*` | Execution-graph position: `id`, `name`, `parent_id` (e.g. LangGraph). |
| `exception.*` | Error detail on a failed span: `exception.message`, `exception.type`, `exception.stacktrace`. |

## Key attributes by span kind

Only the high-value keys are listed; a span may carry more. See `span-kinds` for what each kind means.

- **LLM** — `llm.model_name`, `llm.provider`, `llm.invocation_parameters` (JSON string: temperature,
  max_tokens, …), `llm.input_messages.{i}.message.role` / `.content`,
  `llm.output_messages.{i}.message.content`, `llm.token_count.*` (see `token-cost-and-context`),
  `llm.finish_reason`, `llm.tools.{i}.tool.json_schema`.
- **EMBEDDING** — `embedding.model_name`, `embedding.embeddings.{i}.embedding.text`, `…embedding.vector`.
- **RETRIEVER** — `retrieval.documents.{i}.document.id` / `.content` / `.score` / `.metadata`.
- **RERANKER** — `reranker.model_name`, `reranker.query`, `reranker.top_k`,
  `reranker.input_documents.{i}.document.*`, `reranker.output_documents.{i}.document.*`.
- **TOOL** — `tool.name`, `tool.description`, `tool.parameters`, `input.value` (the call args),
  `output.value` (the tool's return).
- **PROMPT** — `llm.prompt_template.template`, `llm.prompt_template.variables`,
  `llm.prompt_template.version`.
- **AGENT** — `agent.name`; otherwise judge it end-to-end via `input.value` / `output.value` and its
  child spans.
- **CHAIN / GUARDRAIL / EVALUATOR / UNKNOWN** — generally just `input.value` / `output.value`; the
  substance is on child spans or the raw payload.

## Looking up a key you don't see here

The `openinference-semantic-conventions` Python package is the source of truth and is installed with
Phoenix. When surveying an unfamiliar span, prefer reading the actual attribute keys off a real span
(`Span.attributes` in GraphQL) over recalling a key from memory — instrumentors occasionally add keys
ahead of the spec. If you must confirm a canonical name, it comes from that package's `SpanAttributes`,
`MessageAttributes`, `DocumentAttributes`, and `OpenInferenceSpanKindValues`.

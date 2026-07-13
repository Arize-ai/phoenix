---
name: tracing
description: >
  The vocabulary of Phoenix tracing — what spans, span kinds, token counts, cost,
  annotations, and notes actually mean, and how to look up the OpenInference
  semantic-convention attribute that carries a given piece of data. Load this when
  you need to *interpret* trace data rather than act on it: deciding which attribute
  holds a value, what a span kind implies, how to read token/cost/context-window
  usage, or whether a signal is a human annotation, an LLM judgment, or an open-coding
  note. Do NOT load for: running a diagnosis (use debug-trace), writing feedback (use
  annotate-spans), or composing queries (use phoenix-graphql) — though those skills
  lean on the concepts defined here.
summary: Reference for the Phoenix tracing data model — span kinds, semantic conventions, token/cost/context usage, and annotations vs. notes.
---

### What this skill is

This is a **reference**, not a workflow. It defines the concepts the other tracing
skills operate on. When `debug-trace`, `annotate-spans`, or `phoenix-graphql` leave you
unsure what a field *means* — is `llm.token_count.prompt_details.cache_read` additive?
what does a `RERANKER` span contain? is this signal authoritative? — the answer is here.
Load the one resource that covers your question; don't read all four.

### The data model at a glance

A **trace** is one end-to-end request, made of **spans** arranged in a parent/child tree.
Each span records one unit of work and carries:

- **`openinference.span.kind`** — the *kind* of work (LLM, RETRIEVER, TOOL, …). It tells you
  which other attributes to expect. See `span-kinds`.
- **Attributes** — flattened, dot-namespaced OpenInference key/value pairs (`llm.model_name`,
  `retrieval.documents.0.document.score`, …) carrying the inputs, outputs, and metadata of the
  work. See `semantic-conventions` for the namespace map and per-kind attribute lists.
- **Token counts and cost** — how much the LLM work consumed, and how that maps to context-window
  pressure and dollars. See `token-cost-and-context`.

Separately, spans and traces accumulate **feedback** attached after the fact:

- **Annotations** — durable, named labels/scores from a human, an LLM judge, or code. A human
  annotation is the closest thing to ground truth. See `annotations-and-notes`.
- **Notes** — free-form open-coding text, modeled as an annotation named `note`. Distinct from a
  scored annotation. See `annotations-and-notes`.

### Resources

Read only the one you need with `read_skill_resource`.

| Resource | Covers |
| -------- | ------ |
| `span-kinds` | The span-kind taxonomy — what each of the OpenInference kinds represents and when it appears |
| `semantic-conventions` | How to look up the attribute that carries a value: namespaces, flattening rules, and the key attributes per span kind |
| `token-cost-and-context` | Reading token counts (prompt/completion/total, cache, reasoning, audio), cost, cumulative rollups, and reasoning about context-window usage |
| `annotations-and-notes` | Annotations as a source of truth for human/LLM evaluation, `annotatorKind`, and notes as open-coding |

### Ground rules

- **Never invent an attribute name.** OpenInference attribute keys are exact strings. If you are
  unsure a key exists, check `semantic-conventions` (or introspect a real span) rather than guessing.
- **Attributes are populated by whatever instrumented the app.** A missing attribute usually means
  the instrumentation didn't emit it, not that the value is zero — treat absence as unknown.
- **Don't read a span kind or status code as truth about behavior.** They describe structure, not
  correctness; the payload in the attributes is the evidence. (`debug-trace` and `annotate-spans`
  both restate this — it originates here.)

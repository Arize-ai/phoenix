# Evaluator Config Schemas

JSON Schema definitions for validating evaluator configuration YAML files.

## Usage

Add the schema directive at the top of your YAML config file:

```yaml
# yaml-language-server: $schema=../schemas/classification_evaluator.schema.json
```

This enables IDE validation and autocompletion in editors that support YAML Language Server (VS Code, Cursor, etc.).

## Specification Fields

The `specification` section in evaluator configs provides structured metadata for filtering and discovery.

### `use_cases`

Application types this evaluator is designed for:

- `chat` - Conversational AI / chatbots
- `rag` - Retrieval-augmented generation
- `agent` - Agentic / tool-using systems
- `code` - Code generation and analysis
- `general` - General purpose, applicable broadly

### `measures`

What aspect of the output is being evaluated:

- `correctness` - Factual accuracy and completeness
- `grounding` - Faithfulness to provided context/sources
- `safety` - Harmful content, policy compliance
- `quality` - Writing quality, coherence, style
- `tool_use` - Tool selection and invocation accuracy

### `requires`

Required data fields for evaluation:

- `input` - User query or prompt
- `output` - Model response to evaluate
- `context` - Retrieved context or reference documents
- `reference` - Ground truth or expected output
- `tools` - Available tool definitions
- `tool_calls` - Model's tool invocations
- `messages` - Full conversation history

### `level`

Evaluation granularity:

- `document` - Per-document evaluation (e.g., document relevance)
- `span` - Per-span evaluation (e.g., individual LLM call)
- `trace` - Trace-level evaluation (e.g., end-to-end correctness)
- `session` - Session-level evaluation (e.g., multi-turn conversations)

### `span_kind`

Applicable span types when `level` includes `span`:

- `llm` - LLM inference spans
- `tool` - Tool execution spans
- `retriever` - Retrieval spans
- `any` - Applicable to any span type

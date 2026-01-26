# Annotations Overview

Annotations allow you to add human or automated feedback to traces, spans, documents, and sessions. Annotations are essential for evaluation, quality assessment, and building training datasets.

## Annotation Types

Phoenix supports four types of annotations:

| Type                    | Target                           | Purpose                                  | Example Use Case                 |
| ----------------------- | -------------------------------- | ---------------------------------------- | -------------------------------- |
| **Span Annotation**     | Individual span                  | Feedback on a specific operation         | "This LLM response was accurate" |
| **Document Annotation** | Document within a RETRIEVER span | Feedback on retrieved document relevance | "This document was not helpful"  |
| **Trace Annotation**    | Entire trace                     | Feedback on end-to-end interaction       | "User was satisfied with result" |
| **Session Annotation**  | User session                     | Feedback on multi-turn conversation      | "Session ended successfully"     |

## Annotation Fields

Every annotation has these fields:

### Required Fields

| Field     | Type   | Description                                                                   |
| --------- | ------ | ----------------------------------------------------------------------------- |
| Entity ID | String | ID of the target entity (span_id, trace_id, session_id, or document_position) |
| `name`    | String | Annotation name/label (e.g., "quality", "relevance", "helpfulness")           |

### Result Fields (At Least One Required)

| Field         | Type              | Description                                                       |
| ------------- | ----------------- | ----------------------------------------------------------------- |
| `label`       | String (optional) | Categorical value (e.g., "good", "bad", "relevant", "irrelevant") |
| `score`       | Float (optional)  | Numeric value (typically 0-1, but can be any range)               |
| `explanation` | String (optional) | Free-text explanation of the annotation                           |

**At least one** of `label`, `score`, or `explanation` must be provided.

### Optional Fields

| Field            | Type   | Description                                                                             |
| ---------------- | ------ | --------------------------------------------------------------------------------------- |
| `annotator_kind` | String | Who created this annotation: "HUMAN", "LLM", or "CODE" (default: "HUMAN")               |
| `identifier`     | String | Unique identifier for upsert behavior (updates existing if same name+entity+identifier) |
| `metadata`       | Object | Custom metadata as key-value pairs                                                      |

## Annotator Kinds

| Kind    | Description                    | Example                           |
| ------- | ------------------------------ | --------------------------------- |
| `HUMAN` | Manual feedback from a person  | User ratings, expert labels       |
| `LLM`   | Automated feedback from an LLM | GPT-4 evaluating response quality |
| `CODE`  | Automated feedback from code   | Rule-based checks, heuristics     |

## Common Annotation Names

**Quality Assessment:**

- `quality` - Overall quality (label: good/fair/poor, score: 0-1)
- `correctness` - Factual accuracy (label: correct/incorrect, score: 0-1)
- `helpfulness` - User satisfaction (label: helpful/not_helpful, score: 0-1)

**RAG-Specific:**

- `relevance` - Document relevance to query (label: relevant/irrelevant, score: 0-1)
- `faithfulness` - Answer grounded in context (label: faithful/unfaithful, score: 0-1)

**Safety:**

- `toxicity` - Contains harmful content (score: 0-1)
- `pii_detected` - Contains personally identifiable information (label: yes/no)

**Custom:**

- Any domain-specific annotation name

## Identifier and Upsert Behavior

The `identifier` field enables upsert behavior (update if exists, insert if not):

- Annotations are uniquely identified by: `(name, entity_id, identifier)`
- If an annotation with the same `(name, entity_id, identifier)` exists, it gets **updated**
- If no match exists, a **new annotation** is created
- Leave `identifier` as `None` to always create new annotations
- Use custom `identifier` when you want to update existing annotations

**Important:** Document annotations do **not support** custom identifiers (must be empty or null).

## Language-Specific Documentation

- Python client methods and examples
- TypeScript/JavaScript client methods and examples
- Direct HTTP API usage

## Related Documentation

- Automated quality assessment spans
- Document retrieval (for document annotations)
- Querying annotations
- Custom metadata conventions

## Phoenix UI Behavior

**Display:**

- Annotations shown as badges on spans/traces/documents
- Scores visualized with color coding (red/yellow/green)
- Explanations in tooltips or expandable sections
- Annotation history tracked (who, when, what)

**Analytics:**

- Compare human vs LLM annotations
- Track inter-annotator agreement
- Identify patterns in low-scoring items
- Export annotations for model training

**Filtering:**

- Filter traces/spans by annotation name, label, or score
- Find items missing annotations
- Compare before/after annotation distributions

# Client Migration Skill

## Description
Migrate legacy `phoenix.Client()` usage to new `phoenix.client` interfaces.

## When to Use
- Migrating code that uses `import phoenix as px` with `px.Client()`
- Converting `query_spans`, `get_spans_dataframe`, `upload_dataset`, etc.
- Updating evaluation logging patterns

## Quick Reference

**Core Migrations:**
1. `import phoenix as px` → `from phoenix.client import Client` (or `AsyncClient`)
2. `px.Client()` → `Client()` (variable: `px_client`)
3. `client.query_spans(...)` → `client.spans.get_spans_dataframe(...)`
4. `client.upload_dataset(...)` → `client.datasets.create_dataset(...)`
5. `px.Client().log_evaluations(SpanEvaluations(...))` → `px_client.spans.log_span_annotations_dataframe(...)`

**Parameter Changes:**
- `project_name=` → `project_identifier=`
- `dataset_name=` → `name=`
- `eval_name=` → `annotation_name=`

**Import Changes:**
- `from phoenix.experiments import` → `from phoenix.client.experiments import`
- `from phoenix.trace.dsl import SpanQuery` → `from phoenix.client.types.spans import SpanQuery`

## Client Type Selection

```
IF file extension == ".ipynb":
    USE AsyncClient
    ADD await before method calls
ELIF file extension == ".py":
    USE Client (synchronous)
    NO await needed
```

## Complete Details

See `.cursor/rules/client-migration.mdc` for comprehensive migration patterns and examples.

## Commands

No specific commands. This skill provides knowledge for manual code migration.

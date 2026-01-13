# Evals Migration Skill

## Description
Migrate legacy Phoenix Evals API (pre-v2.0) to new unified interface.

## When to Use
- Migrating code using `phoenix.evals.models.*` (OpenAIModel, AnthropicModel, etc.)
- Converting `llm_classify`, `llm_generate`, or `run_evals` functions
- Updating evaluator classes

## Quick Reference

**Model Interfaces:**
- All `phoenix.evals.models.*` → `phoenix.evals.llm.LLM`

**Core Functions:**
- `llm_classify` → `create_classifier` + `evaluate_dataframe`
- `llm_generate` → `LLM.generate_text`
- `run_evals` → `evaluate_dataframe`

**Evaluators:**
- Use `create_classifier` for classification tasks
- Use `create_evaluator` decorator for custom metrics
- Import built-in evaluators from `phoenix.evals.metrics`

## Basic Example

**Old:**
```python
from phoenix.evals.models import OpenAIModel
from phoenix.evals import llm_classify

model = OpenAIModel(model="gpt-4o")
evals_df = llm_classify(data=df, model=model, rails=["good", "bad"], ...)
```

**New:**
```python
from phoenix.evals.llm import LLM
from phoenix.evals import create_classifier, evaluate_dataframe

llm = LLM(provider="openai", model="gpt-4o")
evaluator = create_classifier(
    name="quality",
    prompt_template="...",
    llm=llm,
    choices={"good": 1.0, "bad": 0.0}
)
results_df = evaluate_dataframe(dataframe=df, evaluators=[evaluator])
```

## Complete Details

See `.cursor/rules/evals-migration.mdc` for comprehensive migration patterns and examples.

## Commands

No specific commands. This skill provides knowledge for manual code migration.

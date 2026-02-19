# Fundamentals

Application-specific tests for AI systems. Code first, LLM for nuance, human for truth.

## Evaluator Types

| Type | Speed | Cost | Use Case |
| ---- | ----- | ---- | -------- |
| **Code** | Fast | Cheap | Regex, JSON, format, exact match |
| **LLM** | Medium | Medium | Subjective quality, complex criteria |
| **Human** | Slow | Expensive | Ground truth, calibration |

**Decision:** Code first → LLM only when code can't capture criteria → Human for calibration.

## Score Structure

| Property | Required | Description |
| -------- | -------- | ----------- |
| `name` | Yes | Evaluator name |
| `kind` | Yes | `"code"`, `"llm"`, `"human"` |
| `score` | No* | 0-1 numeric |
| `label` | No* | `"pass"`, `"fail"` |
| `explanation` | No | Rationale |

*One of `score` or `label` required.

## Binary > Likert

Use pass/fail, not 1-5 scales. Clearer criteria, easier calibration.

```python
# Multiple binary checks instead of one Likert scale
evaluators = [AnswersQuestion(), UsesContext(), NoHallucination()]
```

## Patterns

See dedicated rules for working code examples:
- Code evaluators → `evaluators-code-python.md` / `evaluators-code-typescript.md`
- LLM evaluators → `evaluators-llm-python.md` / `evaluators-llm-typescript.md`
- Running experiments → `experiments-running-python.md` / `experiments-running-typescript.md`

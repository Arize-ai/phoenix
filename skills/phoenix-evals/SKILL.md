---
name: phoenix-evals
description: Best practices for evaluating AI/LLM applications using Phoenix.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: Python, TypeScript
---

# Phoenix Evals

Guide for evaluating AI/LLM applications using Phoenix. Follows the scientific method: observe, analyze, automate, experiment, validate, iterate.

## The Eval-Driven Development Cycle

```
OBSERVE → ERROR ANALYSIS → AXIAL CODING → BUILD EVALS → EXPERIMENT → VALIDATE → PRODUCTION
   ↑                                                                                  │
   └──────────────────────────────────────────────────────────────────────────────────┘
```

- Setting up evaluation for an AI/LLM application
- Reviewing traces to find failure modes
- Building automated evaluators (code or LLM-based)
- Running experiments to test improvements
- Deploying evals to CI/CD or production

## Rule Categories

| Priority | Category       | Description                                   | Prefix             |
| -------- | -------------- | --------------------------------------------- | ------------------ |
| 1        | Fundamentals   | Core concepts, anti-patterns, model selection | `fundamentals-*`   |
| 2        | Observe        | Tracing, sampling                             | `observe-*`        |
| 3        | Error Analysis | Failure identification, multi-turn debugging  | `error-analysis-*` |
| 4        | Axial Coding   | Failure taxonomies, agent workflows           | `axial-coding-*`   |
| 5        | Evaluators     | Code, LLM, and RAG evaluators                 | `evaluators-*`     |
| 6        | Experiments    | Datasets, tasks, runs                         | `experiments-*`    |
| 7        | Validation     | Calibrating judges, golden datasets           | `validation-*`     |
| 8        | Production     | CI/CD, monitoring, guardrails                 | `production-*`     |

## Setup

Before running evals, install the required packages:

- **Python:** See [setup-python](rules/setup-python.md)
- **TypeScript:** See [setup-typescript](rules/setup-typescript.md)

## Quick Start Workflows

**Starting Fresh:**
`observe-tracing-setup` → `observe-sampling-{python|typescript}` → `error-analysis-process` → `axial-coding-taxonomy` → `evaluators-overview`

**Building an Evaluator:**
`fundamentals-types` → `evaluators-{code|llm}-{python|typescript}` → `validation-human-calibration-{python|typescript}` → `experiments-running-{python|typescript}`

**Evaluating RAG Systems:**
`evaluators-rag` → `evaluators-code-{python|typescript}` (retrieval metrics) → `evaluators-llm-{python|typescript}` (faithfulness)

**Going to Production:**
`production-overview` → `production-guardrails` → `production-continuous`

## Key Principles

| Principle            | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| Error Analysis First | You cannot automate what you haven't observed                |
| Custom > Generic     | Application-specific metrics beat off-the-shelf              |
| Code First           | Use deterministic checks before LLM judges                   |
| Validate Judges      | Measure TPR/TNR before trusting any LLM evaluator            |
| Binary > Likert      | Pass/fail forces clearer criteria than 1-5 scales            |

**Warning:** Pre-built "quality" or "helpfulness" evaluators create false confidence. Build evaluators based on failures discovered through error analysis.

## References

- [Phoenix Documentation](https://docs.arize.com/phoenix)
- [Phoenix Evals Python](https://arize-phoenix.readthedocs.io/projects/evals/en/latest/)
- [Phoenix Evals TypeScript](https://arize-ai.github.io/phoenix/modules/_arizeai_phoenix-evals.html)

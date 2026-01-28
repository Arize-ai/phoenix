---
name: phoenix-evals
description: Build and run evaluators for AI/LLM applications using Phoenix.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: Python, TypeScript
---

# Phoenix Evals

Build evaluators for AI/LLM applications. Code first, LLM for nuance, validate against humans.

## Quick Reference

| Task | Files |
| ---- | ----- |
| Setup | `setup-python`, `setup-typescript` |
| Build code evaluator | `evaluators-code-{python\|typescript}` |
| Build LLM evaluator | `evaluators-llm-{python\|typescript}`, `evaluators-custom-templates` |
| Run experiment | `experiments-running-{python\|typescript}` |
| Create dataset | `experiments-datasets-{python\|typescript}` |
| Validate evaluator | `validation`, `validation-calibration-{python\|typescript}` |
| Analyze errors | `error-analysis`, `axial-coding` |
| RAG evals | `evaluators-rag` |
| Production | `production-overview`, `production-guardrails` |

## Workflows

**Starting Fresh:**
`observe-tracing-setup` → `error-analysis` → `axial-coding` → `evaluators-overview`

**Building Evaluator:**
`fundamentals` → `evaluators-{code\|llm}-{python\|typescript}` → `validation-calibration-{python\|typescript}`

**RAG Systems:**
`evaluators-rag` → `evaluators-code-*` (retrieval) → `evaluators-llm-*` (faithfulness)

**Production:**
`production-overview` → `production-guardrails` → `production-continuous`

## Rule Categories

| Prefix | Description |
| ------ | ----------- |
| `fundamentals-*` | Types, scores, anti-patterns |
| `observe-*` | Tracing, sampling |
| `error-analysis-*` | Finding failures |
| `axial-coding-*` | Categorizing failures |
| `evaluators-*` | Code, LLM, RAG evaluators |
| `experiments-*` | Datasets, running experiments |
| `validation-*` | Calibrating judges |
| `production-*` | CI/CD, monitoring |

## Key Principles

| Principle | Action |
| --------- | ------ |
| Error analysis first | Can't automate what you haven't observed |
| Custom > generic | Build from your failures |
| Code first | Deterministic before LLM |
| Validate judges | >80% TPR/TNR |
| Binary > Likert | Pass/fail, not 1-5 |

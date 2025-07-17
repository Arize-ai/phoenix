# Evals

Authors: @mikeldking

## Core Pillars

- **Speed** - Speed should be a distinct advantage of using phoenix evals over others. This may come at a trade-off of accuracy at times and should be weighed but in general speed of iteration should be heavily weighed and speed should always be able to be tuned.
- **Transparency** - What's happening under the hood is not abstracted away, anything and everything that is done under the hood should be configurable via parameters, configuration, or other mechanisms. The library should be natively instrumented so that traces from the library can be leveraged for observability and improvement.
- **Customizability** - Prompts, models, parameters - all should be easily swappable with custom code or setups
- **Extensible** - There should be sufficient utility in the framework such that a user could create a custom metric and leverage the "structure" of the framework to build a good eval for custom tasks
- **Benchmarked** - All evaluations within the framework that are built-in should be benchmarked and these benchmarks should be made publicly available.
- **Vendor Agnostic** - The evals should not be married to any one provider / platform. It should espouse platform independence.
- **Batteries Semi-Included** - There's enough utility in the package itself such that I can get up and running with evals without another library. The library should also foster contributions.
- **Pluggable** - Evals should be easily usable with any platform (Phoenix etc.) or framework (pytest), or prompt management system.
- **Phoenix.Evals Inside** - Phoenix Server evaluators should entirely rely on this library as its engine. The phoenix platform should dogfood the evals library as it's mechanism to run evals.
- **Open-Source** - The entire evals library and its dependencies must stay open-source.

## What is an Eval

An Eval is simply a function by which you can "evaluate" the generation of an LLM or AI system. By this definition many different strategies can be used. Evals in general should result in human digestable output in the form of a "metric" and these metrics should be used to benchmark and improve the AI system under test.

## Evaluation Methods

Phoenix Evals will support multiple evaluation methodologies to comprehensively assess AI system performance across different dimensions and use cases.

### LLM Evaluations

These evaluations use large language models to assess the quality of AI-generated content, leveraging the reasoning capabilities of advanced models to provide nuanced evaluation. These should be leveraged in conjunction with human judgement and be tuned for human alignment.

### Heuristic Evaluations (Code Evaluations)

Rule-based and algorithmic evaluations that provide fast, deterministic assessments.

Examples: `Levenshtein Distance`, `Exact Match`

### Pairwise Evaluations

This evaluation method involves comparing two responses side-by-side to determine which one better meets a specific criteria, rather than scoring responses individually. For example, reinforcement learning from human feedback (RLHF) employs pairwise evaluation in LLM alignment where human trainers are presented with pairs of LLM responses for the same input and select which one better aligns with certain criteria (e.g., helpfulness, informativeness, or safety). This approach is often more intuitive for humans than assigning absolute scores and can be implemented through human annotation, LLM-as-a-judge, or automated metrics.

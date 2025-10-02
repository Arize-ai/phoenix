---
description: Definition and types of Evaluators. Score abstraction.
---

# Evaluators

At the core, an Evaluator is anything that returns a Score. Evaluators can be split into two broad categories:&#x20;

* LLM-based: evaluators that use an LLM to perform the judgement.
  * Examples: hallucination, document relevance
* Heuristic: evaluators that use a deterministic process or calculation.
  * Examples: exact match, BLEU, precision

## Scores

* Every score has the following properties:
  * name: The human-readable name of the score/evaluator.
  * source: The origin of the evaluation signal (llm, heuristic, or human)
  * direction: The optimization direction; whether a high score is better or worse
* Scores may also have some of the following properties:
  * score: numeric score
  * label: The categorical outcome (e.g., "good", "bad", or other label).
  * explanation: A brief rationale or justification for the result.
  * metadata: Arbitrary extra context such as model details, intermediate scores, or run info.

## Properties of Evaluators

All phoenix-evals `Evaluators` have the following properties:&#x20;

* Sync and async evaluate methods for evaluating a single record or example&#x20;
* Single record evals return a list of `Score` objects. Oftentimes, this is a list of length 1 (e.g. `exact_match`), but some evaluators return multiple scores (e.g. precision-recall).
* A discoverable `input_schema` that describes what inputs it requires to run.
* Evaluators accept an arbitrary `eval_input` payload, and an optional `input_mapping` which map/transforms the input to the shape they require.&#x20;

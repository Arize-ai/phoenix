# Built-in metrics and evaluators

This module includes all of the built-in evaluators that are available to use out of the box. 

## exact_match
Evaluator to determine if two strings are an exact match. Behavior: returns 1.0 if `output == expected`, else 0.0
No text normalization is performed. 

Examples
```python
from phoenix.evals.metrics.exact_match import exact_match

# 1) No mapping
scores = exact_match({"output": "no", "expected": "yes"})
print(scores[0].score)  # 0.0

# 2) With field mapping
scores = exact_match(
    {"prediction": "yes", "gold": "yes"},
    input_mapping={"output": "prediction", "expected": "gold"},
)
print(scores[0].score)  # 1.0
```

## HallucinationEvaluator
Evaluation to determine if a response to a query is grounded in the context or hallucinated. 

- Inherits: `ClassificationEvaluator`
- Required fields: `{input, output, context}` 
- Choices: `{"hallucinated": 0.0, "factual": 1.0}`

Examples
```python
from phoenix.evals.metrics.hallucination import HallucinationEvaluator
from phoenix.evals.llm import LLM

llm = LLM(provider="openai", model="gpt-4o-mini", client="openai")
hallucination = HallucinationEvaluator(llm=llm)

eval_input = {
    "input": "What is the capital of France?",
    "output": "Paris is the capital of France.",
    "context": "Paris is the capital and largest city of France.",
}
scores = hallucination(eval_input)
print(scores[0].label, scores[0].score)
```

Note: requires an LLM that supports tool calling or structured output. 

## Precision Recall F Score 
Calculates the precision, recall, and f score (default f1) given lists of output and expected values. 

Returns: 
A list of three `Score` objects: precision, recall, and f 

Notes:
- Works for binary or multi-class classification
- Inputs can be lists of integers or string labels. 
- If binary, 1.0 is presumed positive. Otherwise, provide `positive_label` for best results.
- Beta is configurable if you wish to calculate an F score other than F1.
- Default averaging technique is macro, but it is configurable.

Examples
```python
from phoenix.evals.metrics.precision_recall import PrecisionRecallFScore

precision_recall_fscore = PrecisionRecallFScore(positive_label="yes") # can also specify beta and averaging technique
result = precision_recall_fscore({"output": ["no", "yes", "yes"], "expected": ["yes", "no", "yes"]})
print("Results:")
print(result[0]) # precision
print(result[1]) # recall
print(result[2]) # f1
```
# Server Evaluators

Author: @mikeldking

Server-side evaluators, sometimes called "online" evals, is the idea of having evaluation or judgement performed on live traces and synthesis. Server-side evaluation aims to create a level of automation that makes it possible to analyze the performance and quality of LLM-powered tasks and workflows.

## Terminology

### Evaluator

We will define an Evaluator as a function that grades particular task. The `evaluator` can be powered by an llm, be based on code, or be a very simple heuristic. Some evaluators are well understood (e.x. JSON distance, cosine similarity), while others are user defined to try to catch failure modes of a particular task.

### Task

We will use the word `task` to denote a function that is under test. These tasks are LLM powered and thus have a level of indeterminism that needs `evaluation`.

### Evaluation Target

The `tasks` performed will be recorded as artifacts in the form of `spans`, `traces`, `sessions`, and `experiment` runs. These artifacts will be able to serve as the target of evaluation. Each one of these artifacts capture the task's `input`, `output` and other relevant context and metadata that can be used for evaluation.

### Annotation

Annotations capture the scores that are the result of evaluation. They are named `annotations` because they `annotate` artifacts of the `task` described above. For example, you can have `span` annotations, `trace` annotations, `session` annotations, and `experiment run` annotations. In this context `span`, `trace`, and `session` refer to larger and larger tasks of increasing complexity and interdependency. Below are some examples of `annotations` or evals that could be necessary at each level of complexity.

- Span
  - Did an LLM call the right tool
  - Did the LLM leak internal private information
- Trace
  - Did the server respond with an answer to a user's question
  - Does the user sound frustrated
- Session
  - Did the agent stay coherent
  - Did the agent maintain a steady trajectory to resolution

## Product Requirements

### Evaluator Definitions

As a user of Phoenix, I want to define different evaluation metrics to be re-used across the platform. These metric definitions will have 3 types:

- LLM-as-a-judge
- Heuristic / Code (e.x. JSON distance, exact match, similarity, contains regex)
- Custom Code

To make the eval definitions re-usable across various targets, the evaluators will be described as having:

- `input schema` - what data is required to perform the evaluation at a record level
- `annotation config` - the definition of the score it produces
- `source` - how the evaluation is performed

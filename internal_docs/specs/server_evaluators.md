# Server Evaluators

Author: @mikeldking

Server-side evaluators, sometimes called "online" evals, are the idea of having evaluation or judgment performed on live traces and synthesis. Server-side evaluation aims to create a level of automation that makes it possible to analyze the performance and quality of LLM-powered tasks and workflows.

## Terminology

### Evaluator

We will define an Evaluator as a function that grades a particular task. The `evaluator` can be powered by an LLM, be based on code, or be a very simple heuristic. Some evaluators are well understood (e.g., JSON distance, cosine similarity), while others are user-defined to try to catch failure modes of a particular task.

### LLM Evaluators

LLM Evaluators are functions that use an LLM to perform an evaluation. For simplicity, we will think of LLM evaluators as single-shot prompts, where a set of inputs is passed into a well-formed prompt template to produce a score.

### Task

We will use the word `task` to denote a function that is under test. These tasks are LLM-powered and thus have a level of non-determinism that requires `evaluation`.

### Evaluation Target

The `tasks` performed will be recorded as artifacts in the form of `spans`, `traces`, `sessions`, and `experiment runs`. These artifacts will be able to serve as the target of evaluation. Each one of these artifacts captures the task's `input`, `output`, and other relevant context and metadata that can be used for evaluation.

### Score

Score is the output of an evaluator (evaluators are also referred to as scorers). A score may not necessarily be numeric. It's meant to capture judgment and thus can be made up of:

- label - typically a classification of discrete values
- score - a floating point or integer grade
- explanation - the reasoning for why the grade was given or purely a textual assessment

In addition to the above, a score can have meta information or a definition. Notably:

- direction - also known as optimization direction, to refer to the desired goal (e.g., 'maximize' denotes we want the metric to be higher)
- metadata - any key-value pairs to describe the judgment (e.g., performed by `gpt`)

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

As a user of Phoenix, I want to define different evaluation metrics to be re-used across the platform. These metric definitions will have various types:

- LLM-as-a-judge
- Heuristic / Code (e.g., JSON distance, exact match, similarity, contains regex)
- Custom Code
- Remote (webhook-based)

To make the eval definitions re-usable across various targets, the evaluators will be described as having:

- `input schema` - what data is required to perform the evaluation at a record level
- `annotation config` - the definition of the score it produces
- `source` - how the evaluation is performed (e.g., 'LLM')

### LLM Evaluator Prompts

As a user of Phoenix, the prompts used for LLM judgment need to be tracked carefully as they could have a drastic impact on the quality (e.g., true-positive rate) of the evaluator. For this reason, prompts used for LLM judgment must be tracked via Phoenix's built-in prompt management system.

For a prompt to be deemed sufficiently good for an evaluator, it should be testable via Phoenix's built-in prompt playground. Once the evaluator prompt is sufficiently benchmarked (e.g., has a sufficiently good experiment backing its performance), the prompt will be promoted via a prompt version tag and will be picked up by the evaluator.

An example user flow:

1. Create an LLM Evaluator (Dataset or otherwise)
2. A prompt is scaffolded and saved with the initial version. The evaluator is tracking "heads/latest" implicitly or a specific tag
3. The user then iterates on the prompt and when sufficiently confident marks the prompt via a tag as ready to be used for the evaluator

### Dataset Evaluators

As a user of Phoenix, datasets contain examples for a particular task. In the case of prompt engineering, the dataset contains examples of inputs to the prompt. Evaluators will serve as "test cases" that automatically score the prompt output. Examples are:

- Does the output call the right tool
- Is the output similar to the desired reference output
- Does the output match the desired output exactly (heuristic/code evaluator)
- Does the output hallucinate or properly say that it lacks knowledge (LLM)

These evaluators will run by default when an experiment is performed using the dataset unless otherwise specified.

Metaphorically speaking, datasets now define a workbench. When you load a particular dataset into the prompt playground, it automatically sets up the evaluators, which form a metaphorical "unit" testing suite.

### Project Evaluators (e.g. online evals)

As a user of Phoenix, once I start production tracing, I want certain segments of my data to be automatically evaluated at or after ingestion so that I can monitor and triage critical or potential failures. Project evaluators are the use of the above evaluation methodologies but with an associated automation. An example of a project evaluator definition might be:

- Filter for LLM spans with a particular attribute ("final synthesis")
- Sample down to 80% of traffic
- Perform evaluation

As a user, I am tapping into different types of "events" in the system and performing particular types of automation (e.g., a trigger). An automation might look like:

- event: ingestion - A trace gets marked as "incorrect" by an evaluator
- trigger: add to dataset - the trace gets captured as a dataset for human review and/or regression testing

### Evaluator Traces

As a user of Phoenix who is trying to audit or improve the evaluators, I want a clear project that captures all my evaluator traces. These traces can be annotated for corrective measures and even be used for training on my next iteration on the prompt (e.g., building out a train split).

In a larger sense, as a user of Phoenix Evaluators, I want resources. Resources can be scaffolded initially (e.g., a training dataset) but also can be created from evaluator traces (e.g., corrected judgments).

# Smolagents

**SmolAgents** is a lightweight Python library for composing tool-using, task-oriented agents. This guide outlines common agent workflows we've implemented—covering routing, evaluation loops, task orchestration, and parallel execution. For each pattern, we include an overview, a reference notebook, and guidance on how to evaluate agent quality.

***

### Design Considerations and Limitations

While the API is minimal—centered on `Agent`, `Task`, and `Tool`—there are important tradeoffs and design constraints to be aware of.

| Design Considerations                                           | Limitations                                                                                                                                                                                                                  |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API centered on `Agent`, `Task`, and `Tool`                     | Tools are just Python functions decorated with `@tool`. There’s no centralized registry or schema enforcement, so developers must define conventions and structure on their own.                                             |
| Provides flexibility for orchestration                          | No retry mechanism or built-in workflow engine                                                                                                                                                                               |
| Supports evaluator-optimizer loops, routing, and fan-out/fan-in |                                                                                                                                                                                                                              |
| Agents are composed, not built-in abstractions                  | Must implement orchestration logic                                                                                                                                                                                           |
| Multi-Agent support                                             | No built-in support for collaboration structures like voting, planning, or debate.                                                                                                                                           |
|                                                                 | Token-level streaming is not supported                                                                                                                                                                                       |
|                                                                 | No state or memory management out of the box. Applications that require persistent state—such as conversations or multi-turn workflows—will need to integrate external storage (e.g., a vector database or key-value store). |
|                                                                 | There’s no native memory or “trajectory” tracking between agents. Handoffs between tasks are manual. This is workable in small systems, but may require structure in more complex workflows.                                 |

### Prompt Chaining

This workflow breaks a task into smaller steps, where the output of one agent becomes the input to another. It’s useful when a single prompt can’t reliably handle the full complexity or when you want clarity in intermediate reasoning.

**Notebook**: [_Prompt Chaining with Keyword Extraction + Summarization_](https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/smolagents/smolagents_prompt_chaining.ipynb)\
The agent first extracts keywords from a resume, then summarizes what those keywords suggest.

**How to evaluate**: Check whether each step performs its function correctly and whether the final result meaningfully depends on the intermediate output\
(_e.g., do summaries reflect the extracted keywords?_)

* Check if the intermediate step (e.g. keyword extraction) is meaningful and accurate
* Ensure the final output reflects or builds on the intermediate output
* Compare chained vs. single-step prompting to see if chaining improves quality or structure

***

### Router&#x20;

Routing is used to send inputs to the appropriate downstream agent or workflow based on their content. The routing logic is handled by a dedicated agent, often using lightweight classification.

**Notebook**: [_Candidate Interview Router_](https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/smolagents/smolagents_router.ipynb)\
The agent classifies candidate profiles into Software, Product, or Design categories, then hands them off to the appropriate evaluation pipeline.

**How to evaluate**: Compare the routing decision to human judgment or labeled examples\
(_e.g., did the router choose the right department for a given candidate?_)

* Compare routing decisions to human-labeled ground truth or expectations
* Track precision/recall if framed as a classification task
* Monitor for edge cases and routing errors (e.g., ambiguous or mixed-signal profiles)

***

### Evaluator–Optimizer Loop

This pattern uses two agents in a loop: one generates a solution, the other critiques it. The generator revises until the evaluator accepts the result or a retry limit is reached. It’s useful when quality varies across generations.

**Notebook**: [_Rejection Email Generator with Evaluation Loop_](https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/smolagents/smolagents_evaluator_optimizer.ipynb)\
An agent writes a candidate rejection email. If the evaluator agent finds the tone or feedback lacking, it asks for a revision.

**How to evaluate**: Track how many iterations are needed to converge and whether final outputs meet predefined criteria\
(_e.g., is the message respectful, clear, and specific?_)

* Measure how many iterations are needed to reach an acceptable result
* Evaluate final output quality against criteria like tone, clarity, and specificity
* Compare the evaluator’s judgment to human reviewers to calibrate reliability

***

### Orchestrator + Worker Pattern

In this approach, a central agent coordinates multiple agents, each with a specialized role. It’s helpful when tasks can be broken down and assigned to domain-specific workers.

**Notebook**: [_Recruiting Evaluator Orchestrator_](https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/smolagents/smolagents_orchestrator.ipynb)\
The orchestrator delegates resume review, culture fit assessment, and decision-making to different agents, then composes a final recommendation.

**How to evaluate**: Assess consistency between subtasks and whether the final output reflects the combined evaluations\
(_e.g., does the final recommendation align with the inputs from each worker agent?_)

* Ensure each worker agent completes its role accurately and in isolation
* Check if the orchestrator integrates worker outputs into a consistent final result
* Look for agreement or contradictions between components (e.g., technical fit vs. recommendation)

***

### Parallel Agent Execution

When you need to process many inputs using the same logic, parallel execution improves speed and resource efficiency. Agents can be launched concurrently without changing their individual behavior.

**Notebook**: [_Reviewing Candidate Profiles in Parallel_](https://app.gitbook.com/s/yYiH3D9rUbrh3jUtdpK4/)\
Candidate reviews are distributed using `asyncio`, enabling faster batch processing without compromising output quality.

**How to evaluate**: Ensure results remain consistent with sequential runs and monitor for improvements in latency and throughput\
(_e.g., are profiles processed correctly and faster when run in parallel?_)

* Confirm that outputs are consistent with those from a sequential execution
* Track total latency and per-task runtime to assess parallel speedup
* Watch for race conditions, dropped inputs, or silent failures in concurrency

***







####

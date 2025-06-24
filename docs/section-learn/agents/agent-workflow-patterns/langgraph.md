---
description: Use Phoenix to trace and evaluate agent frameworks built using Langgraph
---

# LangGraph

This guide explains key LangGraph concepts, discusses design considerations, and walks through common architectural patterns like orchestrator-worker, evaluators, and routing. Each pattern includes a brief explanation and links to runnable Python notebooks.

### Core LangGraph Concepts

LangGraph allows you to build LLM-powered applications using a graph of steps (called "nodes") and data (called "state"). Here's what you need to know to understand and customize LangGraph workflows:

#### State

A `TypedDict` that stores all information passed between nodes. Think of it as the memory of your workflow. Each node can read from and write to the state.

#### Nodes

Nodes are units of computation. Most often these are functions that accept a `State` input and return a partial update to it. Nodes can do anything: call LLMs, trigger tools, perform calculations, or prompt users.

#### Edges

Directed connections that define the order in which nodes are called. LangGraph supports linear, conditional, and cyclical edges, which allows for building loops, branches, and recovery flows.

#### Conditional Routing

A Python function that examines the current state and returns the name of the next node to call. This allows your application to respond dynamically to LLM outputs, tool results, or even human input.

#### Send API

A way to dynamically launch multiple workers (nodes or subgraphs) in parallel, each with their own state. Often used in orchestrator-worker patterns where the orchestrator doesn't know how many tasks there will be ahead of time.

#### Agent Supervision

LangGraph enables complex multi-agent orchestration using a Supervisor node that decides how to delegate tasks among a team of agents. Each agent can have its own tools, prompt structure, and output format. The Supervisor coordinates routing, manages retries, and ensures loop control.

#### Checkpointing and Persistence

LangGraph supports built-in persistence using checkpointing. Each execution step saves state to a database (in-memory, SQLite, or Postgres). This allows for:

* Multi-turn conversations (memory)
* Rewinding to past checkpoints (time travel)
* Human-in-the-loop workflows (pause + resume)

### Design Considerations & Limitations

LangGraph improves on LangChain by supporting more flexible and complex workflows. Here’s what to keep in mind when designing:

| Benefits                                                                                                                | Limitations                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Cyclic workflows**: LangGraph supports loops, retries, and iterative workflows that would be cumbersome in LangChain. | **Debugging complexity**: Deep graphs and multi-agent networks can be difficult to trace. Use Arize AX or Phoenix!              |
| **Fine-grained control**: Customize prompts, tools, state updates, and edge logic for each node.                        | **Token bloat**: Cycles and retries can accumulate state and inflate token usage.                                               |
| **Visualize**: Graph visualization makes it easier to follow logic flows and complex routing.                           | **Requires upfront design**: Graphs must be statically defined before execution. No dynamic graph construction mid-run.         |
| **Supports multi-agent coordination**: Easily create agent networks with Supervisor and worker roles.                   | **Supervisor misrouting**: If not carefully designed, supervisors may loop unnecessarily or reroute outputs to the wrong agent. |

## Patterns

### Prompt Chaining

A linear sequence of prompt steps, where the output of one becomes the input to the next. This workflow is optimal when the task can be simply broken down into concrete subtasks.

**Use case:** Multistep reasoning, query rewriting, or building up answers gradually.

📓 [View notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/langgraph/langgraph_promptchaining.ipynb)

<figure><img src="../../.gitbook/assets/prompt_chaining.png" alt=""><figcaption></figcaption></figure>

### Parallelization

Runs multiple LLMs in parallel — either by splitting tasks (sectioning) or getting multiple opinions (voting).

**Use case:** Combining diverse outputs, evaluating models from different angles, or running safety checks.

With the `Send` API, LangGraph lets you:

* Launch multiple safety evaluators in parallel
* Compare multiple generated hypotheses side-by-side
* Run multi-agent voting workflows

This improves reliability and reduces bottlenecks in linear pipelines.

📓 [View notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/langgraph/langgraph_parallel.ipynb)

<figure><img src="../../.gitbook/assets/parallel.png" alt=""><figcaption></figcaption></figure>

### Router

Routes an input to the most appropriate follow-up node based on its type or intent.

**Use case:** Customer support bots, intent classification, or model selection.

LangGraph routers enable domain-specific delegation — e.g., classify an incoming query as "billing", "technical support", or "FAQ", and send it to a specialized sub-agent. Each route can have its own tools, memory, and context. Use structured output with a routing schema to make classification more reliable.

📓 [View notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/langgraph/langgraph_router.ipynb)

<figure><img src="../../.gitbook/assets/router.png" alt=""><figcaption></figcaption></figure>

### Evaluator–Optimizer Loop

One LLM generates content, another LLM evaluates it, and the loop repeats until the evaluation passes. LangGraph allows feedback to modify the state, making each round better than the last.

**Use case:** Improving code, jokes, summaries, or any generative output with measurable quality.

📓 [View notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/langgraph/langgraph_evaluator.ipynb)

<figure><img src="../../.gitbook/assets/evaluator.png" alt=""><figcaption></figcaption></figure>

### Orchestrator–Worker

An orchestrator node dynamically plans subtasks and delegates each to a worker LLM. Results are then combined into a final output.

**Use case:** Writing research papers, refactoring code, or composing modular documents.

LangGraph’s `Send` API lets the orchestrator fork off tasks (e.g., subsections of a paper) and gather them into `completed_sections`. This is especially useful when the number of subtasks isn’t known in advance.

You can also incorporate agents like `PDF_Reader` or a `WebSearcher`, and the orchestrator can choose when to route to these workers.

⚠️ **Caution:** Feedback loops or improper edge handling can cause workers to echo each other or create infinite loops. Use strict conditional routing to avoid this.

📓 [View notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/langgraph/langgraph_orchestrator.ipynb)

<figure><img src="../../.gitbook/assets/orchestrator.png" alt=""><figcaption></figcaption></figure>

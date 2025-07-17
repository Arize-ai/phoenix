---
description: Use Phoenix to trace and evaluate different CrewAI agent patterns
---

# CrewAI

[**CrewAI**](crewai.md) is an open-source framework for building and orchestrating collaborative AI agents that act like a team of specialized virtual employees. Built on LangChain, it enables users to define roles, goals, and workflows for each agent, allowing them to work together autonomously on complex tasks with minimal setup.

## Core Concepts of CrewAI <a href="#core-concepts-of-crewai" id="core-concepts-of-crewai"></a>

#### **Agents**

Agents are autonomous, role-driven entities designed to perform specific functions—like a Researcher, Writer, or Support Rep. They can be richly customized with goals, backstories, verbosity settings, delegation permissions, and access to tools. This flexibility makes agents expressive and task-aware, helping model real-world team dynamics.

#### Tasks

Tasks are the atomic units of work in CrewAI. Each task includes a description, expected output, responsible agent, and optional tools. Tasks can be executed solo or collaboratively, and they serve as the bridge between high-level goals and actionable steps.

#### Tools

Tools give agents capabilities beyond language generation—such as browsing the web, fetching documents, or performing calculations. Tools can be native or developer-defined using the `BaseTool` class, and each must have a clear name and purpose so agents can invoke them appropriately.Tools must include clear descriptions to help agents use them effectively.

#### Processes

CrewAI supports multiple orchestration strategies:

* **Sequential**: Tasks run in a fixed order—simple and predictable.
* **Hierarchical**: A manager agent or LLM delegates tasks dynamically, enabling top-down workflows.
* **Consensual** _(planned)_: Future support for democratic, collaborative task routing.\
  Each process type shapes how coordination and delegation unfold within a crew.

#### Crews

A crew is a collection of agents and tasks governed by a defined process. It represents a fully operational unit with an execution strategy, internal collaboration logic, and control settings for verbosity and output formatting. Think of it as the operating system for multi-agent workflows.

#### Pipelines

Pipelines chain multiple crews together, enabling multi-phase workflows where the output of one crew becomes the input to the next. This allows developers to modularize complex applications into reusable, composable segments of logic.

#### Planning

With planning enabled, CrewAI generates a task-by-task strategy before execution using an AgentPlanner. This enriches each task with context and sequencing logic, improving coordination—especially in multi-step or loosely defined workflows.

***

## Design Considerations and Limitations

<table><thead><tr><th width="216.4521484375" align="right" valign="top">Design Considerations</th><th>Features &#x26; Limitations</th></tr></thead><tbody><tr><td align="right" valign="top">Agent Roles</td><td>Explicit role configuration gives flexibility, but poor design can cause overlap or miscommunication</td></tr><tr><td align="right" valign="top">State Management</td><td>Stateless by default. Developers must implement external state or context passing for continuity across tasks</td></tr><tr><td align="right" valign="top">Task Planning</td><td>Supports sequential and branching workflows, but all logic must be manually defined—no built-in planning</td></tr><tr><td align="right" valign="top">Tool Usage</td><td>Agents support tools via config. No automatic selection; all tool-to-agent mappings are manual</td></tr><tr><td align="right" valign="top">Termination Logic</td><td>No auto-termination handling. Developers must define explicit conditions to break recursive or looping behavior</td></tr><tr><td align="right" valign="top">Memory</td><td>No built-in memory layer. Integration with vector stores or databases must be handled externally</td></tr></tbody></table>

***

## Agent Design Patterns

### Prompt Chaining

Prompt chaining decomposes a complex task into a sequence of smaller steps, where each LLM call operates on the output of the previous one. This workflow introduces the ability to add programmatic checks (such as “gates”) between steps, validating intermediate outputs before continuing. The result is higher control, accuracy, and debuggability—at the cost of increased latency.

CrewAI makes it straightforward to build prompt chaining workflows using a sequential process. Each step is modeled as a `Task`, assigned to a specialized `Agent`, and executed in order using `Process.sequential`. You can insert validation logic between tasks or configure agents to flag issues before passing outputs forward.

**Notebook**: _Research-to-Content Prompt Chaining Workflow_

{% embed url="https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/crewai/crewai_prompt_chaining_tutorial.ipynb" %}

### Routing

Routing is a pattern designed to classify incoming requests and dispatch them to the single most appropriate specialist agent or workflow, ensuring each input is handled by a focused, expert-driven routine.

In CrewAI, you implement routing by defining a Router Agent that inspects each input, emits a category label, and then dynamically delegates to downstream agents (or crews) tailored for that category—each equipped with its own tools and prompts. This separation of concerns delivers more accurate, maintainable pipelines.

**Notebook:** _Research-Content Routing Workflow_

{% embed url="https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/crewai/crewai_routing_tutorial.ipynb" %}

### Parallelization

Parallelization is a powerful agent workflow where multiple tasks are executed simultaneously, enabling faster and more scalable LLM pipelines. This pattern is particularly effective when tasks are independent and don’t depend on each other’s outputs.

While CrewAI does not enforce true multithreaded execution, it provides a clean and intuitive structure for defining parallel logic through multiple agents and tasks. These can be executed concurrently in terms of logic, and then gathered or synthesized by a downstream agent.

**Notebook:** _Parallel Research Agent_

{% embed url="https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/crewai/crewai_%20parallelization_tutorial.ipynb" %}

### Orchestrator-Workers

The **Orchestrator-Workers** workflow centers around a primary agent—the orchestrator—that dynamically decomposes a complex task into smaller, more manageable subtasks. Rather than relying on a fixed structure or pre-defined subtasks, the orchestrator decides what needs to be done based on the input itself. It then delegates each piece to the most relevant worker agent, often specialized in a particular domain like research, content synthesis, or evaluation.

CrewAI supports this pattern using the `Process.hierarchical` setup, where the orchestrator (as the manager agent) generates follow-up task specifications at runtime. This enables dynamic delegation and coordination without requiring the workflow to be rigidly structured up front. It's especially useful for use cases like multi-step research, document generation, or problem-solving workflows where the best structure only emerges after understanding the initial query.

**Notebook:** _Research & Writing Delegation Agents_

{% embed url="https://github.com/Arize-ai/phoenix/blob/main/tutorials/agents/crewai/crewai_orchestrator_workers_tutorial.ipynb" %}

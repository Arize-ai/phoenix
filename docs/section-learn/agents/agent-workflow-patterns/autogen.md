---
description: Use Phoenix to trace and evaluate AutoGen agents
---

# AutoGen

[**AutoGen**](https://microsoft.github.io/autogen/stable/index.html) is an open-source framework by Microsoft for building multi-agent workflows. The AutoGen agent framework provides tools to define, manage, and orchestrate agents, including customizable behaviors, roles, and communication protocols.

Phoenix can be used to trace AutoGen agents by instrumenting their workflows, allowing you to visualize agent interactions, message flows, and performance metrics across multi-agent chains.

***

### AutoGen Core Concepts

* `UserProxyAgent`: Acts on behalf of the user to initiate tasks, guide the conversation, and relay feedback between agents. It can operate in auto or human-in-the-loop mode and control the flow of multi-agent interactions.
* `AssisstantAgent`: Performs specialized tasks such as code generation, review, or analysis. It supports role-specific prompts, memory of prior turns, and can be equipped with tools to enhance its capabilities.
* `GroupChat`: Coordinates structured, turn-based conversations among multiple agents. It maintains shared context, controls agent turn-taking, and stops the chat when completion criteria are met.
* `GroupChatManager`: Manages the flow and logic of the GroupChat, including termination rules, turn assignment, and optional message routing customization.
* **Tool Integration**: Agents can use external tools (e.g. Python, web search, RAG retrievers) to perform actions beyond text generation, enabling more grounded or executable outputs.
* **Memory and Context Tracking**: Agents retain and access conversation history, enabling coherent and stateful dialogue over multiple turns.

***

### Design Considerations and Limitations

| Design Consideration   | Limitations                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent Roles            | Poorly defined responsibilities can cause overlap or miscommunication, especially between multi-agent workflows.                                                 |
| Termination Conditions | `GroupChat` may continue even after a logical end, as `UserProxyAgent` can exhaust all allowed turns before stopping unless termination is explicitly triggered. |
| Human-in-the-Loop      | Fully autonomous mode may miss important judgment calls without user oversight.                                                                                  |
| State Management       | Excessive context can exceed token limits, while insufficient context breaks coherence.                                                                          |

***

### Prompt Chaining

<figure><img src="../../.gitbook/assets/autogen-prompt-chaining.png" alt=""><figcaption><p>Prompt Chaining Flow</p></figcaption></figure>

**Prompt chaining** is a method where a complex task is broken into smaller, linked subtasks, with the output of one step feeding into the next. This workflow is ideal when a task can be cleanly decomposed into fixed subtasks, making each LLM call simpler and more accurate — trading off latency for better overall performance.

AutoGen makes it easy to build these chains by coordinating multiple agents. Each `AssistantAgent` focuses on a specialized task, while a `UserProxyAgent` manages the conversation flow and passes key outputs between steps. With Phoenix tracing, we can visualize the entire sequence, monitor individual agent calls, and debug the chain easily.

**Notebook**: _Market Analysis Prompt Chaining Agent_\
The agent conducts a multi-step market analysis workflow, starting with identifying general trends and culminating in an evaluation of company strengths.

**How to evaluate**: Ensure outputs are moved into inputs for the next step and logically build across steps\
&#xNAN;_(e.g., do identified trends inform the company evaluation?)_

* Confirm that each prompt step produces relevant and distinct outputs that contribute to the final analysis
* Track total latency and token counts to see which steps cause inefficiencies&#x20;
* Ensure there are no redundant outputs or hallucinations in multi-step reasoning

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/agents/autogen/autogen_agents_prompt_chaining.ipynb#scrollTo=se3M7GECJfpZ" %}

***

### Routing

<figure><img src="../../.gitbook/assets/autogen-routing.png" alt=""><figcaption><p>Routing Flow</p></figcaption></figure>

**Routing** is a pattern designed to handle incoming requests by classifying them and directing them to the single most appropriate specialized agent or workflow.&#x20;

AutoGen simplifies implementing this pattern by enabling a dedicated 'Router Agent' to analyze incoming messages and signal its classification decision. Based on this classification, the workflow explicitly directs the query to the appropriate specialist agent for a focused, separate interaction. The specialist agent is equipped with tools to carry out the request.&#x20;

**Notebook**: _Customer Service Routing Agent_\
We will build an intelligent customer service system, designed to efficiently handle diverse user queries directing them to a specialized `AssistantAgent` .

**How to evaluate**: Ensure the Router Agent consistently classifies incoming queries into the correct category \
&#xNAN;_(e.g., billing, technical support, product info)_

* Confirm that each query is routed to the appropriate specialized `AssistantAgent` without ambiguity or misdirection
* Test with edge cases and overlapping intents to assess the router’s ability to disambiguate accurately
* Watch for routing failures, incorrect classifications, or dropped queries during handoff between agents

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/agents/autogen/autogen_agents_routing.ipynb#scrollTo=kTVRWf0NJfpc" %}

***

### Evaluator–Optimizer Loop

<figure><img src="../../.gitbook/assets/autogen-eval-optimizer.png" alt=""><figcaption><p>Eval-Optimizer Loop</p></figcaption></figure>

The **Evaluator-Optimizer** pattern employs a loop where one agent acts as a generator, creating an initial output (like text or code), while a second agent serves as an evaluator, providing critical feedback against criteria. This feedback guides the generator through successive revisions, enabling iterative refinement. This approach trades increased interactions for a more polished & accurate final result.

AutoGen's `GroupChat` architecture is good for implementing this pattern because it can manage the conversational turns between the generator and evaluator agents. The `GroupChatManager` facilitates the dialogue, allowing the agents to exchange the evolving outputs and feedback.

**Notebook**:  _Code Generator with Evaluation Loop_ \
We'll use a `Code_Generator` agent to write Python code from requirements, and a `Code_Reviewer` agent to assess it for correctness, style, and documentation. This iterative `GroupChat` process improves code quality through a generation and review loop.

**How to evaluate:** Ensure the evaluator provides specific, actionable feedback aligned with criteria \
&#xNAN;_(e.g., correctness, style, documentation)_

* Confirm that the generator incorporates feedback into meaningful revisions with each iteration
* Track the number of iterations required to reach an acceptable or final version to assess efficiency
* Watch for repetitive feedback loops, regressions, or ignored suggestions that signal breakdowns in the refinement process

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/agents/autogen/autogen_agents_evaluator_optimizer.ipynb#scrollTo=se3M7GECJfpZ" %}

***

### Orchestrator Pattern

<figure><img src="../../.gitbook/assets/autogen-orchestrator.png" alt=""><figcaption><p>Orchestrator Flow</p></figcaption></figure>

**Orchestration** enables collaboration among multiple specialized agents, activating only the most relevant one based on the current subtask context. Instead of relying on a fixed sequence, agents dynamically participate depending on the state of the conversation.&#x20;

Agent orchestrator workflows simplifies this routing pattern through a central orchestrator (`GroupChatManager`) that selectively delegates tasks to the appropriate agents. Each agent monitors the conversation but only contributes when their specific expertise is required.&#x20;

**Notebook**: _Trip Planner Orchestrator Agent_\
We will build a dynamic travel planning assistant. A `GroupChatManager` coordinates specialized agents to adapt to the user's evolving travel needs.\
\
**How to evaluate:** Ensure the orchestrator activates only relevant agents based on the current context or user need.\
&#xNAN;_(e.g., flights, hotels, local activities)_

* Confirm that agents contribute meaningfully and only when their domain expertise is required
* Track the conversation flow to verify smooth handoffs and minimal overlap or redundancy among agents
* Test with evolving and multi-intent queries to assess the orchestrator’s ability to adapt and reassign tasks dynamically

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/agents/autogen/autogen_agents_orchestrator.ipynb#scrollTo=kTVRWf0NJfpc" %}

***

### Parallel Agent Execution

<figure><img src="../../.gitbook/assets/autogen-parallelization.png" alt="" width="563"><figcaption><p>Parallelization Flow</p></figcaption></figure>

**Parallelization** is a powerful agent pattern where multiple tasks are run concurrently, significantly speeding up the overall process. Unlike purely sequential workflows, this approach is suitable when tasks are independent and can be processed simultaneously.&#x20;

AutoGen doesn't have a built-in parallel execution manager, but its core agent capabilities integrate seamlessly with standard Python concurrency libraries. We can use these libraries to launch multiple agent interactions concurrently.

**Notebook**: _Product Description Parallelization Agent_\
We'll generate different components of a product description for a smartwatch (features, value proposition, target customer, tagline) by calling a marketing agent. At the end, results are synthesized together.

**How to evaluate:** Ensure each parallel agent call produces a distinct and relevant component \
&#xNAN;_(e.g., features, value proposition, target customer, tagline)_

* Confirm that all outputs are successfully collected and synthesized into a cohesive final product description
* Track per-task runtime and total execution time to measure parallel speedup vs. sequential execution
* Test with varying product types to assess generality and stability of the parallel workflow

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/agents/autogen/autogen_agents_parallelization.ipynb" %}

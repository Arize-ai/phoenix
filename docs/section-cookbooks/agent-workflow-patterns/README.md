# Agent Workflow Patterns

Workflows are the backbone of many successful LLM applications. They define how language models interact with tools, data, and users—often through a sequence of clearly orchestrated steps. Unlike fully autonomous agents, workflows offer structure and predictability, making them a practical choice for many real-world tasks.

In this guide, we share practical workflows using a variety of agent frameworks, including:

* [**AutoGen**](autogen.md)
* [**CrewAI**](crewai.md)
* [**Google GenAI SDK**](google-genai-sdk-manual-orchestration.md)
* [**OpenAI Agents**](openai-agents.md)
* [**LangGraph**](langgraph.md)
* [**Smolagents**](smolagents.md)

Each section highlights how to use these tools effectively—showing what’s possible, where they shine, and where a simpler solution might serve you better. Whether you're orchestrating deterministic workflows or building dynamic agent systems, the goal is to help you choose the right tool for your context and build with confidence.

For a deeper dive into the principles behind agentic systems and when to use them, see [Anthropic’s “Building Effective Agents”](https://www.anthropic.com/engineering/building-effective-agents).

### Routing

**Agent Routing** is the process of directing a task, query, or request to the most appropriate agent based on context or capabilities. In multi-agent systems, it helps determine which agent is best suited to handle a specific input based on skills, domain expertise, or available tools. This enables more efficient, accurate, and specialized handling of complex tasks.

### Prompt Chaining

**Prompt Chaining** is the technique of breaking a complex task into multiple steps, where the output of one prompt becomes the input for the next. This allows a system to reason more effectively, maintain context across steps, and handle tasks that would be too difficult to solve in a single prompt. It's often used to simulate multi-step thinking or workflows.

### Parallelization

**Parallelization** is the process of dividing a task into smaller, independent parts that can be executed simultaneously to speed up processing. It’s used to handle multiple inputs, computations, or agent responses at the same time rather than sequentially. This improves efficiency and speed, especially for large-scale or time-sensitive tasks.

### Orchestrator-workers <a href="#workflow-orchestrator-workers" id="workflow-orchestrator-workers"></a>

An **orchestrator** is a central controller that manages and coordinates multiple components, agents, or processes to ensure they work together smoothly.

It decides what tasks need to be done, who or what should do them, and in what order. An orchestrator can handle things like scheduling, routing, error handling, and result aggregation. It might also manage prompt chains, route tasks to agents, and oversee parallel execution.

### Evaluator-Optimizer

An **evaluator** assesses the quality or correctness of outputs, such as ranking responses, checking for factual accuracy, or scoring performance against a metric. An **optimizer** uses that evaluation to improve future outputs, either by fine-tuning models, adjusting parameters, or selecting better strategies. Together, they form a feedback loop that helps a system learn what works and refine itself over time.

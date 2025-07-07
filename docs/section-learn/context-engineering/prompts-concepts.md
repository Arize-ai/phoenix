---
description: >-
  An independent deep‑dive into the science of giving language‑model agents the
  “right mind at the right moment.”
---

# Context Engineering Basics

##  What Is Context Engineering?

**Context engineering** is the practice of deciding exactly what information a large language model (LLM)—or a group of LLM agents—should see when doing a task. This includes what data is shown, how it’s organized, and how it’s framed.

We break context into four main parts:

* **Information (`I`)**: Facts, documents, or intermediate results passed into the model.
* **State (`S`)**: What the model needs to know about the current session—like the conversation so far or the structure of a task.
* **Tools (`T`)**: External systems the model can access, like APIs or data sources.
* **Format (`F`)**: How everything is wrapped—prompt templates, instructions, or response formats.

By treating these pieces like we treat code—versioning, testing, measuring, and improving them—we can make LLM outputs more predictable and reliable across use cases.

## Scaling Agents Means Scaling Context&#x20;

Large models perform well in single-shot tasks, but real-world systems often use agents that delegate, call APIs, and persist across time. In these long-running setups, common failure modes include:&#x20;

* **Context drift**: Agents develop conflicting views of the truth.
* **Bandwidth overload**: Passing full histories strains context limits and slows responses.
* **Tool blindness**: Agents get raw data but lack guidance on how to use it.

In practice, stale or inconsistent context is the leading cause of coordination failures. Even basic memory update strategies can significantly alter agent behavior over time—highlighting the need for deliberate memory management.&#x20;

## Prompt Engineering ≠ Context Engineering

Prompt engineering and context engineering are related but distinct disciplines. Both shape how language models behave—but they operate at different levels of abstraction.

**Prompt engineering** focuses on the _how_: crafting the right wording, tone, and examples to guide the model’s behavior in a single interaction. It’s about writing the best possible "function call" to the model.

**Context engineering**, by contrast, governs the _what_, _when_, and _how_ of the information the model observes. It spans entire workflows, manages memory across turns, and ensures the model has access to relevant tools and schemas. If prompt engineering is writing a clean function call, context engineering is architecting the full service contract—including interfaces, dependencies, and state management.

| Dimension | Prompt Engineering	                      | Context Engineering                                   |
| --------- | ---------------------------------------- | ----------------------------------------------------- |
| Optimises | Wording, tone, in‑context examples       | Selection, compression, memory, tool schemas          |
| Timescale | Single request/response                  | Full session or workflow                              |
| Metrics   | BLEU, factuality, helpfulness (per turn) | Task success vs. token cost, long-horizon consistency |

Context engineering becomes essential when systems move from isolated prompts to persistent agents and long-running applications. It enables scalable coordination, memory, and interaction across tasks—turning a language model from a tool into part of a system.

## Six Principles for Optimizing Context

As systems grow beyond one-off prompts and into long-running workflows, context becomes a key engineering surface. These principles guide how to design and manage context for LLMs and agent-based systems.

| Principle                     | Why It Matters	                                                                    | Example Technique                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Salience over size            | More tokens don’t mean more value—signal matters more than volume.                 | Salience scoring + reservoir sampling to retain only statistically “interesting” chunks |
| Structure first               | Models and tools handle structured inputs more reliably than unstructured text.    | Use canonical world-state objects; track changes with diff logs                         |
| Hierarchies beat flat buffers | Effective recall happens at multiple levels of detail—not in a flat sequence.      | Multi-resolution memory via Hierarchical Memory Transformers                            |
| Lazy Recall                   | Don’t pay the context cost until the information is actually needed.               | Use pointer IDs and on-demand retrieval (RAG)                                           |
| Deterministic provenance      | You can’t debug what you can’t trace—source tracking is critical.                  | Apply “git-for-thoughts” commit hashes to memory updates                                |
| Context–tool co-design        | Information should be shaped for use, not just stored—tools need actionable input. | Embed tool signatures alongside payloads so the model knows how to act                  |

Each principle pushes context design toward systems that are leaner, more interpretable, and better aligned with both model behavior and downstream actions.

## **Applying Context at System Scale**

Systems that rely on long or complex context need well-designed memory. The patterns below offer practical ways to manage context, depending on how much information your system handles and how long it needs to remember it.

**Three-tier memory** breaks context into three layers: short-term (exact text), mid-term (summaries), and long-term (titles or embeddings). This makes it easier to keep recent details while still remembering important older information. It’s a good fit for chats or agents that run over many turns. Hierarchical Memory Transformers (HMT) follow this design.

**Recurrent compression buffers** take earlier parts of a stream—like a transcript or log—and compress them into smaller representations that can be brought back later if needed. This saves space while keeping the option to recall details when relevant.

**State-space backbones** store memory outside the prompt using a hidden state that carries over between turns. This lets the model handle much longer sequences efficiently. It’s especially useful in devices with tight memory or speed limits, like mobile or edge systems. Mamba is one example of this pattern.

**Context cache and KV-sharing** spread memory across different servers by saving reusable attention patterns. This avoids repeating work and keeps prompts small, making it a strong choice for systems running many requests in parallel. MemServe uses this technique.

**Hybrid retrieval** combines two steps: first, it filters data using keywords or metadata; then it uses vector search for meaning. This cuts down on irrelevant results, especially in datasets with lots of similar content.

**Graph-of-thought memory** turns ideas into a graph, where entities and their relationships are nodes and edges. Instead of sending the whole graph to the model, only the relevant part is used. This works well for complex tasks like analysis or knowledge reasoning and is often built with tools like Neo4j or TigerGraph.

Each of these patterns offers a different way to scale memory and context depending on the problem. They help systems stay efficient, accurate, and responsive as context grows.

## How to Optimize Context Like Code

1. **Log every prompt and context segment.**\
   Track exactly what the model sees at each step.
2. **Label each span.**\
   Mark whether it was used, ignored, hallucinated, or contributed to the final output.
3. **Measure return on input (ROI).**\
   For each span, calculate: `ROI = token cost ÷ impact on accuracy`.
4. **Trim low-value spans.**\
   Drop spans with low ROI. Keep references (pointers) in case retrieval is needed later.
5. **Train a salience model.**\
   Predict which spans should be included in context automatically, based on past usefulness.
6. **Test with adversarial context.**\
   Shuffle inputs or omit key details to probe model robustness and dependency on context structure.
7. **Run regression evaluations.**\
   Repeatedly test the system across agent roles and tasks to catch context-related drift or failures.
8. **Version and diff context bundles.**\
   Treat context like code—snapshot, compare, and review changes before release.

## From Prompts to Protocols - Takeaways&#x20;

Multi-agent systems are powerful because they divide knowledge and responsibility across roles. But that same structure becomes fragile when context is outdated, overloaded, or misaligned.

Context engineering turns prompting from trial-and-error into system design. It ensures each agent sees the right information, in the right form, at the right time.

To build reliable systems, treat context as a core artifact—not just an input. Observe it. Version it. Optimize it. With that foundation, agents stop behaving like chat interfaces and start acting like collaborators.

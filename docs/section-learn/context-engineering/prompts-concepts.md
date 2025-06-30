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


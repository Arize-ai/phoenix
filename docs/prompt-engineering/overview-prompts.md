# Overview: Prompts

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/playground_3_prompt.gif" alt=""><figcaption></figcaption></figure>

Prompt management you to create, store, and modify prompts for interacting with LLMs. By managing prompts systematically, you can improve reuse, consistency, and experiment with variations across different models and inputs.

Unlike traditional software, AI applications are non-deterministic and depend on natural language to provide context and guide model output. The pieces of natural language and associated model parameters embedded in your program are known as “prompts.”

Optimizing your prompts is typically the highest-leverage way to improve the behavior of your application, but “prompt engineering” comes with its own set of challenges. You want to be confident that changes to your prompts have the intended effect and don’t introduce regressions.

To gain this confidence, Phoenix helps you:

* curate and label datasets
* run and evaluate experiments
* save a history of your prompt so you can analyze performance over time and rollback changes as needed
* ensure that your application is always using the latest version of a prompt

To get started, jump to [quickstart-prompts.md](quickstart-prompts.md "mention").

## Features

Phoenix offers a comprehensive suite of features to streamline your prompt engineering workflow.

* [Prompt Management](overview-prompts/prompt-management.md) - Create, store, modify, and deploy prompts for interacting with LLMs
* [Prompt Playground](overview-prompts/prompt-playground.md) - Play with prompts, models, invocation parameters and track your progress via tracing and [experiments](broken-reference).
* [Span Replay](overview-prompts.md#span-replay) - Replay the invocation of an LLM. Whether it's an LLM step in an LLM workflow or a router query, you can step into the LLM invocation and see if any modifications to the invocation would have yielded a better outcome.


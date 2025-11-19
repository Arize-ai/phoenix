# Overview: Prompts

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/playground_3.gif" alt=""><figcaption><p>Use the playground to engineer the optimal prompt for your task</p></figcaption></figure>

Prompt management allows you to create, store, and modify prompts for interacting with LLMs. By managing prompts systematically, you can improve reuse, consistency, and experiment with variations across different models and inputs.

Unlike traditional software, AI applications are non-deterministic and depend on natural language to provide context and guide model output. The pieces of natural language and associated model parameters embedded in your program are known as “prompts.”

Optimizing your prompts is typically the highest-leverage way to improve the behavior of your application, but “prompt engineering” comes with its own set of challenges. You want to be confident that changes to your prompts have the intended effect and don’t introduce regressions.

To get started, jump to [Broken link](broken-reference "mention").

## Prompt Engineering Features

Phoenix offers a comprehensive suite of features to streamline your prompt engineering workflow.

* [Prompt Management](overview-prompts/prompt-management.md) - Create, store, modify, and deploy prompts for interacting with LLMs
* [Prompt Playground](overview-prompts/prompt-playground.md) - Play with prompts, models, invocation parameters and track your progress via tracing and experiments
* [Span Replay](overview-prompts/span-replay.md) - Replay the invocation of an LLM. Whether it's an LLM step in an LLM workflow or a router query, you can step into the LLM invocation and see if any modifications to the invocation would have yielded a better outcome.
* [Prompts in Code](overview-prompts/prompts-in-code.md) - Phoenix offers client SDKs to keep your prompts in sync across different applications and environments.

## Explore Demo Prompts

{% embed url="https://phoenix-demo.arize.com/prompts" %}

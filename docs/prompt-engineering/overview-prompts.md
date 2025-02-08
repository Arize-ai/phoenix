# Overview: Prompts

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/playground_3_prompt.gif" alt=""><figcaption></figcaption></figure>

Prompt engineering is a core pillar of AI engineering.  Unlike with traditional software engineering which is mostly dependent on code, AI applications depend heavily on writing and iterating on prompts. Phoenix aims to make this process easy by providing tools to facilitate prompt engineering.

Prompts are important for AI systems because they set the context and guide the model's behavior. Just like telling a performer to "act excited", a prompt provides instructions, examples, and context that direct the model's response.

Prompt engineering is important because it changes how a model behaves. While there are other methods such as fine-tuning to change behavior, prompt engineering is the simplest way to get started and often times has the best ROI.

## Prompt Management

Prompt management you to create, store, and modify prompts for interacting with LLMs. By managing prompts systematically, you can improve reuse, consistency, and experiment with variations across different models and inputs.

Key benefits of prompt management include:

* **Reusability**: Store and load prompts across different use cases.
* **Versioning**: Track changes over time and revert to previous versions when needed.
* **Collaboration**: Share prompts with others to maintain consistency and facilitate iteration.
* **Tagging:** Systematically release new versions of prompts using release tags. See [tag-a-prompt.md](how-to-prompts/tag-a-prompt.md "mention")

To learn how to get started with prompt management, see [create-a-prompt.md](how-to-prompts/create-a-prompt.md "mention")

## Prompt Playground

Phoenix's Prompt Playground makes the process of iterating and testing prompts quick and easy.\
\
In the playground you can:

* Change the model
* Change the template
* Change the output schema
* Change the tools available
* Enter the input variables to run through the prompt template
* Run the prompt through the model
* Run multiple prompts and compare
* Run prompts over datasets
* Observe the outputs

## Span Replay

LLM spans that are stored within Phoenix can be loaded into the Prompt Playground and replayed. Replaying spans inside of Playground enables you to debug and improve the performance of your LLM systems by comparing LLM provider outputs, tweaking model parameters, changing prompt text, and more.&#x20;

Chat completions generated inside of Playground are automatically instrumented, and the recorded spans are immediately available to be replayed inside of Playground.






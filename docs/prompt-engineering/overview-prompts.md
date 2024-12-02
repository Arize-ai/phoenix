# Overview: Prompts

{% hint style="info" %}
Prompt Playground is available on Phoenix 6.0 and above
{% endhint %}

Prompt engineering is a core pillar of AI engineering.  Unlike with traditional software engineering which is mostly dependent on code, AI applications depend heavily on writing and iterating on prompts. Phoenix aims to make this process easy by providing tools to facilitate prompt engineering.

Prompts are important for AI systems because they set the context and guide the model's behavior. Just like telling a performer to "act excited", a prompt provides instructions, examples, and context that direct the model's response.

Prompt engineering is important because it changes how a model behaves. While there are other methods such as fine-tuning to change behavior, prompt engineering is the simplest way to get started and often times has the best ROI.

## Prompt Templates

Although the terms prompt and prompt template get used interchangeably, it's important to know the difference.

Prompts refer to the message(s) that are passed into the language model.

Prompt Templates refer a way of formatting information to get the prompt to hold the information you want (such as context and examples) Prompt templates can include placeholders (variables) for things such as examples (e.x. few-shot), outside context (RAG), or any other external data that is needed.

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

## Datasets and Experiments

Playground integrates with [datasets and experiments](overview-prompts.md#datasets-and-experiments) to help you iterate and incrementally improve your prompts. This lets you test up to four prompts across an entire dataset at once. Experiment runs are automatically recorded and available for subsequent evaluation to help you understand how changes to your prompts, LLM model, or invocation parameters affect performance.

## Supported Models

The Prompt Playground supports a wide variety of models across different model providers, we will regularly update the models that Phoenix supports over time.

<table><thead><tr><th width="196">Provider</th><th>Supported Models</th></tr></thead><tbody><tr><td>OpenAI</td><td><ul><li>o1 class reasoning models</li><li>GPT-4 class models</li><li>GPT-3.5 class models</li></ul></td></tr><tr><td>Azure OpenAI</td><td><ul><li>user-specified</li></ul></td></tr><tr><td>Anthropic</td><td><ul><li>Claude 3.5 (Sonnet, Haiku)</li><li>Claude 3.0 (Opus, Sonnet, Haiku)</li></ul></td></tr><tr><td>Gemini</td><td><ul><li>Gemini 1.5 class models</li><li>Gemini 1.0 class models</li></ul></td></tr></tbody></table>


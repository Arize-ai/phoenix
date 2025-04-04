---
description: The latest releases from the Phoenix team.
---

# Release Notes

## 04.02.2025 Improved Span Annotation Editor ✍️

**Available in Phoenix 8.21+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/annotations_span_aside.gif" %}

The new span aside moves the Span Annotation editor into a dedicated panel, providing a clearer view for adding annotations and enhancing customization of your setup. Read [this documentation ](../tracing/features-tracing/how-to-annotate-traces.md)to learn how annotations can be used.&#x20;

<details>

<summary>Improvements and Bug Fixes 🐛</summary>

* **Enhancement**: Allow the option to have no configured working directory when using Postgres
* **Performance**: Cache project table results when toggling the details slide-over for improved performance
* **UI**: Add chat and message components for note-taking

</details>

***

## 04.01.2025: Support for MCP Span Tool Info in OpenAI Agents SDK 🔨

**Available in Phoenix 8.20+**&#x20;

Newly added to the OpenAI Agent SDK is support for MCP Span Info, allowing for the tracing and extraction of useful information about MCP tool listings. Use the Phoenix [OpenAI Agents SDK](../tracing/integrations-tracing/openai-agents-sdk.md) for powerful agent tracing.&#x20;

***

## 03.27.2025 Span View Improvements 👀&#x20;

**Available in Phoenix 8.19+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/span_orphan_toggle.gif" %}

You can now toggle the option to treat orphan spans as root when viewing your spans. Additionally, we've enhanced the UI with an icon view in span details for better visibility in smaller displays. Learn more [here](broken-reference).&#x20;

<details>

<summary>Improvements and Bug Fixes 🐛</summary>

* **Performance**: Disable streaming when a dialog is open
* **Playground**: Removed unpredictable playground transformations

</details>

***

## 03.24.2025: Tracing Configuration Tab 🖌️

**Available in Phoenix 8.19+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/tracing_config.gif" %}

Within each project, there is now a **Config** tab to enhance customization. The default tab can now be set per project, ensuring the preferred view is displayed.

Learn more in [projects docs](../tracing/features-tracing/projects.md).

<details>

<summary>Improvements and Bug Fixes 🐛</summary>

* **Experiments**: Included delete experiment option to action menu
* **Feature:** Added support for specifying admin users via an environment variable at startup
* **Annotation:** Now displays metadata
* **Settings Page:** Now split across tabs for improved navigation and easier access
* **Feedback:** Added full metadata&#x20;
* **Projects:** Improved performance
* **UI:** Added date format descriptions to explanations

</details>

***

## 03.19.2025: Access to New Integrations in Projects 🔌

**Available in Phoenix 8.15+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/new_integrations.gif" %}

In the New Project tab, we've added quick setup to instrument your application for [**BeeAI**](../tracing/integrations-tracing/beeai.md), [**SmolAgents**](../tracing/integrations-tracing/hfsmolagents.md), and the [**OpenAI Agents SDK**](../tracing/integrations-tracing/openai-agents-sdk.md). Easily configure these integrations with streamlined instructions.

Check out all Phoenix tracing integrations [here](../tracing/integrations-tracing/).

***

## 03.18.2025: Resize Span, Trace, and Session Tables 🔀

**Available in Phoenix 8.14+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/resizeabletables.gif" %}

We've added the ability to resize Span, Trace, and Session tables. Resizing preferences are now persisted in the tracing store, ensuring settings are maintained per-project and per-table.

***

## 03.14.2025: OpenAI Agents Instrumentation 📡

**Available in Phoenix 8.13+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/openai_sdk_rn.gif" %}

We've introduced the **OpenAI Agents SDK** for Python which provides enhanced visibility into agent behavior and performance.&#x20;

**Installation**

```bash
pip install openinference-instrumentation-openai-agents openai-agents
```

* Includes an OpenTelemetry Instrumentor that traces agents, LLM calls, tool usage, and handoffs.&#x20;
* With minimal setup, use the `register` function to connect your app to Phoenix and view real-time traces of agent workflows.

For more details on a quick setup, check out our [docs](../tracing/integrations-tracing/openai-agents-sdk.md).&#x20;

<details>

<summary>Improvements and Bug Fixes 🐛</summary>

* **Prompt Playground**: Azure API key made optional, included specialized UI for thinking budget parameter

- **Experiments**: Added annotations to experiment JSON downloads

* **Traces**: Trace tree is more readable on smaller sizes

- **Components**: Added react-aria Tabs components

* **Python Client**: Included Anthropic thinking configuration parameter

</details>

***

## 03.07.2025: New Prompt Playground, Evals, and Integration Support 🦾

**Available in Phoenix 8.9+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/added_support_release_notes.gif" %}

* **Prompt Playground**: Now supports GPT-4.5 & Anthropic Sonnet 3.7 and Thinking Budgets
* **Instrumentation**: [SmolagentsInstrumentor](../tracing/integrations-tracing/hfsmolagents.md) to trace smolagents by Hugging Face
* **Evals**: o3 support, Audio &[ Multi-Modal Evaluations](../evaluation/how-to-evals/multimodal-evals.md)
* **Integrations**: Phoenix now supports LiteLLM Proxy & Cleanlabs evals

***

## 03.06.2025: Project Improvements 📽️

**Available in Phoenix 8.8+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/projects.gif" %}

We’ve introduced several enhancements to **Projects**, providing greater flexibility and control over how you interact with data. These updates include:

* **Persistent Column Selection on Tables**: Your selected columns will now remain consistent across sessions, ensuring a more seamless workflow.
* **Metadata Filters from the Table:** Easily filter data directly from the table view using metadata attributes.&#x20;
* **Custom Time Ranges:** You can now specify custom time ranges to filter traces and spans.
* **Root Span Filter for Spans:** Improved filtering options allow you to filter by root spans, helping to isolate and debug issues more effectively.
* **Metadata Quick Filters:** Quickly apply common metadata filters for faster navigation.&#x20;
* **Performance**: Major speed improvements in project tracing views & visibility into database usage in settings

Check out [projects docs](../tracing/features-tracing/projects.md) for more!

<details>

<summary>Improvements and Bug Fixes 🐛</summary>

* **OTEL**: Auto-instrument tag & decorators for streamlined observability
* **Instrumentation**: Tool call IDs in Llama-Index & deprecation of Langchain v0.1
* **Experiments**: Enhanced experiment filtering for better analysis

</details>

***

## 02.19.2025: Prompts 📃

**Available in Phoenix 8.0+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/prompts_release_notes.gif" %}

Phoenix prompt management will now let you create, modify, tag, and version control prompts for your applications. Some key highlights from this release:

* **Versioning & Iteration**: Seamlessly manage prompt versions in both Phoenix and your codebase.
* **New TypeScript Clien**t: Sync prompts with your JavaScript runtime, now with native support for OpenAI, Anthropic, and the Vercel AI SDK.
* **New Python Clien**t: Sync templates and apply them to AI SDKs like OpenAI, Anthropic, and more.
* **Standardized Prompt Handling**: Native normalization for OpenAI, Anthropic, Azure OpenAI, and Google AI Studio.
* **Enhanced Metadata Propagation**: Track prompt metadata on Playground spans and experiment metadata in dataset runs.

Check out the [docs](../prompt-engineering/overview-prompts.md) and this [walkthrough](https://youtu.be/qbeohWaRlsM?feature=shared) for more on prompts!📝 &#x20;

***

## 02.18.2025: One-Line Instrumentation⚡️

**Available in Phoenix 8.0+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/trace_details_view.png" %}

Phoenix has made it even simpler to get started with tracing by introducing one-line auto-instrumentation. By using `register(auto_instrument=True)`, you can enable automatic instrumentation in your application, which will set up instrumentors based on your installed packages.

```
from phoenix.otel import register

register(auto_instrument=True)
```

For more details, you can check the [docs](../tracing/llm-traces-1/) and explore further tracing options.&#x20;

***

## 01.18.2025: Automatic & Manual Span Tracing ⚙️

**Available in Phoenix 7.9+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/tracing.gif" %}

In addition to using our [automatic instrumentors](../tracing/integrations-tracing/) and [tracing directly using OTEL](../tracing/how-to-tracing/setup-tracing/custom-spans.md), we've now added our  own layer to let you have the granularity of manual instrumentation without as much boilerplate code.

You can now access a tracer object with streamlined options to trace functions and code blocks. The main two options are:

* Using the **decorator** `@tracer.chain` traces the entire function automatically as a Span in Phoenix. The input, output, and status attributes are set based on the function's parameters and return value.
* Using the tracer in a `with` clause allows you to trace specific code blocks within a function. You manually define the Span name, input, output, and status.

Check out the [docs](https://docs.arize.com/phoenix/tracing/how-to-tracing/instrument-python#using-your-tracer) for more on how to use tracer objects.&#x20;

***

## 12.09.2024: **Sessions** 💬

**Available in Phoenix 7.0+**

![](https://storage.googleapis.com/arize-phoenix-assets/assets/images/s-sessions.png)

Sessions allow you to group multiple responses into a single thread. Each response is still captured as a single trace, but each trace is linked together and presented in a combined view.&#x20;

Sessions make it easier to visual multi-turn exchanges with your chatbot or agent Sessions launches with Python and TS/JS support. For more on sessions, check out[ a walkthrough video](https://www.youtube.com/watch?v=dzS6x0BE-EU) and the [docs](https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-sessions?utm_campaign=Phoenix%20Newsletter\&utm_source=hs_email\&utm_medium=email&_hsenc=p2ANqtz--aSHse9NA8I5ncZzavHCp6LBXibZCgbWcRrxbh2RwugL6IQdTOSu8cz-Wqh6EO9xJLGX2E).&#x20;

<details>

<summary>Improvements &#x26; Bug Fixes</summary>

## **Improvements & Bug Fixes 🐛**&#x20;

**Prompt Playground**: Added support for arbitrary string model names Added support for Gemini 2.0 Flash Improved template editor ergonomics&#x20;

**Evals**: Added multimodal message template support&#x20;

**Tracing**: Added JSON pretty printing for structured data outputs (thank you sraibagiwith100x!) Added a breakdown of token types in project summary&#x20;

**Bug Fixes**: Changed trace latency to be computed every time, rather than relying on root span latency Added additional type checking to handle non-string values when manually instrumenting (thank you Manuel del Verme!)&#x20;

</details>

***

## 11.18.2024: Prompt Playground 🛝

**Available in Phoenix 6.0+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/playground_3.gif" %}

Prompt Playground is now available in the Phoenix platform! This new release allows you to test the effects of different prompts, tools, and structured output formats to see which performs best.&#x20;

* Replay individual spans with modified prompts, or run full Datasets through your variations.&#x20;
* Easily test different models, prompts, tools, and output formats side-by-side, directly in the platform.&#x20;
* Automatically capture traces as Experiment runs for later debugging. See [here](https://docs.arize.com/phoenix/prompt-engineering/overview-prompts/prompt-playground) for more information on Prompt Playground, or jump into the platform to try it out for yourself.&#x20;

<details>

<summary>Improvements &#x26; Bug Fixes</summary>

## Improvements & Bug Fixes 🐛&#x20;

* Fixed a confusing situation where eval models could be instantiated with the wrong parameters, and wouldn't fail until called&#x20;
* Added support for FastAPI and GraphQL extensions&#x20;
* Fixed a bug where Anthropic LLM as a Judge responses would be labeled as unparseable&#x20;
* Fixed a bug causing 500 errors on client.get\_traces\_dataset() and client.get\_spans\_dataframe()&#x20;
* Added the ability for authentication to work from behind a proxy&#x20;
* Added an environment variable to set default admin passwords in auth

</details>

***

## 10.01.2024: Improvements & Bug Fixes 🐛

We've made several performance enhancements, added new features, and fixed key issues to improve stability, usability, and efficiency across Phoenix.

* Numerous stability improvements to our hosted Phoenix instances accessed on app.phoenix.arize.com&#x20;
* Added a new command to easily launch a Phoenix client from the cli: `phoenix serve`&#x20;
* Implemented simple email sender to simplify dependencies&#x20;
* Improved error handling for imported spans&#x20;
* Replaced hdbscan with fast-hdbscan Added PHOENIX\_CSRF\_TRUSTED\_ORIGINS environment variable to set trusted origins&#x20;
* Added support for Mistral 1.0&#x20;
* Fixed an issue that caused px.Client().get\_spans\_dataframe() requests to time out

***

## 09.26.2024: Authentication & RBAC 🔐

**Available in Phoenix 5.0+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/Screenshot%202025-03-27%20at%204.19.39%E2%80%AFPM.png" %}

We've added Authentication and Rules-based Access Controls to Phoenix. This was a long-requested feature set, and we're excited for the new uses of Phoenix this will unlock!&#x20;

The auth feature set includes:&#x20;

* **Secure Access**: All of Phoenix’s UI & APIs (REST, GraphQL, gRPC) now require access tokens or API keys. Keep your data safe!&#x20;
* **RBAC (Role-Based Access Control)**: Admins can manage users; members can update their profiles—simple & secure.
* **API Keys**: Now available for seamless, secure data ingestion & querying.&#x20;
* **OAuth2 Support**: Easily integrate with Google, AWS Cognito, or Auth0. ✉ Password Resets via SMTP to make security a breeze.&#x20;

For all the details on authentication, view our [docs](https://docs.arize.com/phoenix/deployment/authentication).

***

## 07.18.2024: Guardrails AI Integrations💂&#x20;

**Available in Phoenix 4.11.0+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/guardrails.png" %}

Our integration with Guardrails AI allows you to capture traces on guard usage and create datasets based on these traces. This integration is designed to enhance the safety and reliability of your LLM applications, ensuring they adhere to predefined rules and guidelines.

Check out the [Cookbook ](https://colab.research.google.com/drive/1NDn5jzsW5k0UrwaBjZenRX29l6ocrZ-_?usp=sharing\&utm_campaign=Phoenix%20Newsletter\&utm_source=hs_email\&utm_medium=email&_hsenc=p2ANqtz-9Tx_lYbuasbD3Mzdwl0VNPcvy_YcbPudxu1qwBZ3T7Mh---A4PO-OJfhas-RR4Ys_IEb0F)here.&#x20;

***

## 07.11.2024: Hosted Phoenix 💻

**Phoenix is now available for deployment as a fully hosted service.**&#x20;

![](https://storage.googleapis.com/arize-phoenix-assets/assets/images/s-llamatrace.png)

In addition to our existing notebook, CLI, and self-hosted deployment options, we’re excited to announce that Phoenix is now available as a [fully hosted service](https://arize.com/resource/introducing-hosted-phoenix-llamatrace/).

With hosted instances, your data is stored between sessions, and you can easily share your work with team members.

We are partnering with LlamaIndex to power a new observability platform in LlamaCloud: LlamaTrace. LlamaTrace will automatically capture traces emitted from your LlamaIndex applications, and store them in a persistent, cloud- accessible Phoenix instance.

Hosted Phoenix is 100% free-to-use, [check it out today](https://app.phoenix.arize.com/login)!

***

## 07.03.2024: Datasets & Experiments 🧪

**Available in Phoenix 4.6+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/experiments.gif" %}

**Datasets**: Datasets are a new core feature in Phoenix that live alongside your projects. They can be imported, exported, created, curated, manipulated, and viewed within the platform, and should make a few flows much easier:

* Fine-tuning: You can now create a dataset based on conditions in the UI, or by manually choosing examples, then export these into csv or jsonl formats readymade for fine-tuning APIs.
* Experimentation: External datasets can be uploaded into Phoenix to serve as the test cases for experiments run in the platform.

For more details on using datasets see our [documentation](https://docs.arize.com/phoenix/datasets-and-experiments/overview-datasets?utm_campaign=Phoenix%20Newsletter\&utm_source=hs_email\&utm_medium=email&_hsenc=p2ANqtz-9Tx_lYbuasbD3Mzdwl0VNPcvy_YcbPudxu1qwBZ3T7Mh---A4PO-OJfhas-RR4Ys_IEb0F) or [example notebook](https://colab.research.google.com/drive/1e4vZR5VPelXXYGtWfvM3CErPhItHAIp2?usp=sharing\&utm_campaign=Phoenix%20Newsletter\&utm_source=hs_email\&utm_medium=email&_hsenc=p2ANqtz-9Tx_lYbuasbD3Mzdwl0VNPcvy_YcbPudxu1qwBZ3T7Mh---A4PO-OJfhas-RR4Ys_IEb0F).

**Experiments:** Our new Datasets and Experiments feature enables you to create and manage datasets for rigorous testing and evaluation of your models. You can now run comprehensive experiments to measure and analyze the performance of your LLMs in various scenarios.&#x20;

For more details, check out our full [walkthrough](https://www.youtube.com/watch?v=rzxN-YV_DbE\&t=25s).&#x20;

***

## 07.02.2024: Function Call Evaluations ⚒️

**Available in Phoenix 4.6+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/evals-docs.gif" %}

We are introducing a new built-in function call evaluator that scores the function/tool-calling capabilities of your LLMs. This off-the-shelf evaluator will help you ensure that your models are not just generating text but also effectively interacting with tools and functions as intended.

This evaluator checks for issues arising from function routing, parameter extraction, and function generation.

Check out a [full walkthrough of the evaluator](https://www.youtube.com/watch?v=Rsu-UZ1ZVZU).

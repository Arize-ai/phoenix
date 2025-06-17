---
description: The latest from the Phoenix team.
layout:
  title:
    visible: true
  description:
    visible: true
  tableOfContents:
    visible: true
  outline:
    visible: false
  pagination:
    visible: true
---

# Release Notes

{% embed url="https://github.com/Arize-ai/phoenix/releases" %}

## [05.30.2025: xAI and Deepseek Support in Playground](05.30.2025-xai-and-deepseek-support-in-playground.md) 🛝

**Available in Phoenix 10.5+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/videos/deepseek.mp4" %}

Deepseek and xAI models are now available in Prompt Playground!

***

## [05.20.2025: Datasets and Experiment Evaluations in the JS Client](05.20.2025-datasets-and-experiment-evaluations-in-the-js-client.md) 🧪

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/TS-experiments.png" %}

We've added a host of new methods to the JS client:

* [getExperiment](https://arize-ai.github.io/phoenix/functions/experiments.getExperiment.html) - allows you to retrieve an Experiment to view its results, and run evaluations on it
* [evaluateExperiment](https://arize-ai.github.io/phoenix/functions/experiments.evaluateExperiment.html) - allows you to evaluate previously run Experiments using LLM as a Judge or Code-based evaluators
* [createDataset](https://arize-ai.github.io/phoenix/functions/datasets.createDataset.html) - allows you to create Datasets in Phoenix using the client
* [appendDatasetExamples](https://arize-ai.github.io/phoenix/functions/datasets.appendDatasetExamples.html) - allows you to append additional examples to a Dataset

***

## [05.14.2025: Experiments in the JS Client](./#id-05.14.2025-experiments-in-the-js-client) **🔬**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/ts-experiments-results.png" %}
Experiments CLI output
{% endembed %}

You can now run Experiments using the Phoenix JS client! Use Experiments to test different iterations of your applications over a set of test cases, then evaluate the results. This release includes:

* Native tracing of tasks and evaluators
* Async concurrency queues
* Support for any evaluator (including bring your own evals)

***

## [05.09.2025: Annotations, Data Retention Policies, Hotkeys](./#id-05.09.2025-annotations-data-retention-policies-hotkeys) 📓

**Available in Phoenix 9.0+**

{% hint style="success" %}
**Major Release:** Phoenix v9.0.0
{% endhint %}

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/videos/annotations_api.mp4" %}
Annotation Improvements
{% endembed %}

Phoenix's v9.0.0 release brings with it:

* A host of improvements to [Annotations](https://arize.com/docs/phoenix/tracing/features-tracing/how-to-annotate-traces), including one-to-many support, API access, annotation configs, and custom metadata
* Customizable data retention policies
* Hotkeys! :fire:

***

## [05.05.2025: OpenInference Google GenAI Instrumentation](./#id-05.05.2025-openinference-google-genai-instrumentation) 🧩

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/videos/genai.mp4" %}

We’ve added a Python auto-instrumentation library for the Google GenAI SDK. This enables seamless tracing of GenAI workflows with full OpenTelemetry compatibility. Additionally, the Google GenAI instrumentor is now supported and works seamlessly with Span Replay in Phoenix.

***

## [04.30.2025: Span Querying & Data Extraction for PX Client 📊](04.30.2025-span-querying-and-data-extraction-for-phoenix-client.md)

**Available in Phoenix 8.30+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/spans_df.gif" %}

The Phoenix client now includes the `SpanQuery` DSL for more advanced span querying. Additionally, a `get_spans_dataframe` method has been added to facilitate easier data extraction for span-related information.

***

## [04.28.2025: TLS Support for Phoenix Server 🔐](04.28.2025-tls-support-for-phoenix-server.md)

**Available in Phoenix 8.29+**

Phoenix now supports Transport Layer Security (TLS) for both HTTP and gRPC connections, enabling encrypted communication and optional mutual TLS (mTLS) authentication. This enhancement provides a more secure foundation for production deployments.

***

## [04.28.2025: **Improved Shutdown Handling** 🛑](04.28.2025-improved-shutdown-handling.md)

**Available in Phoenix 8.28+**

When stopping the Phoenix server via `Ctrl+C`, the shutdown process now exits cleanly with code 0 to reflect intentional termination. Previously, this would trigger a traceback with `KeyboardInterrupt`, misleadingly indicating a failure.

***

## [04.25.2025: Scroll Selected Span Into View 🖱️](04.25.2025-scroll-selected-span-into-view.md)

**Available in Phoenix 8.27+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/span_scroll.gif" %}

Improved trace navigation by automatically scrolling the selected span into view when a user navigates to a specific trace. This enhances usability by making it easier to locate and focus on the relevant span without manual scrolling.

***

## [04.18.2025: Tracing for MCP Client-Server Applications](04.18.2025-tracing-for-mcp-client-server-applications.md) 🔌

**Available in Phoenix 8.26+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/MCP%20tracing.png" %}

We’ve released `openinference-instrumentation-mcp`, a new package in the OpenInference OSS library that enables seamless OpenTelemetry context propagation across MCP clients and servers. It automatically creates spans, injects and extracts context, and connects the full trace across services to give you complete visibility into your MCP-based AI systems.

Big thanks to Adrian Cole and Anuraag Agrawal for their contributions to this feature.

***

## [04.16.2025: API Key Generation via API 🔐](04.16.2025-api-key-generation-via-api.md)

**Available in Phoenix 8.26+**

Phoenix now supports programmatic API key creation through a new endpoint, making it easier to automate project setup and trace logging. To enable this, set the `PHOENIX_ADMIN_SECRET` environment variable in your deployment.

***

## [04.15.2025: Display Tool Call and Result IDs in Span Details 🫆](04.15.2025-display-tool-call-and-result-ids-in-span-details.md)

**Available in Phoenix 8.25+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/tool_calling_ids2.gif" %}

Tool call and result IDs are now shown in the span details view. Each ID is placed within a collapsible header and can be easily copied. This update also supports spans with multiple tool calls. Get started with tracing your tool calls [here](https://arize.com/docs/phoenix/tracing/llm-traces-1).

***

## [04.09.2025: Project Management API Enhancements ✨](04.09.2025-project-management-api-enhancements.md)

**Available in Phoenix 8.24+**

This update enhances the Project Management API with more flexible project identification We've added support for identifying projects by both ID and hex-encoded name and introduced a new `_get_project_by_identifier` helper function.

***

## [04.09.2025: New REST API for Projects with RBAC 📽️](04.09.2025-new-rest-api-for-projects-with-rbac.md)

**Available in Phoenix 8.23+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/project_management_REST_API.mp4" %}

This release introduces a REST API for managing projects, complete with full CRUD functionality and access control. Key features include CRUD Operations and Role-Based Access Control. Check out our [new documentation ](https://arize.com/docs/phoenix/sdk-api-reference/projects)to test these features.

***

## [04.03.2025: Phoenix Client Prompt Tagging 🏷️](04.03.2025-phoenix-client-prompt-tagging.md)

**Available in Phoenix 8.22+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/prompt_tagging.gif" %}

We’ve added support for Prompt Tagging in the Phoenix client. This new feature gives you more control and visibility over your prompts throughout the development lifecycle. Tag prompts directly in code, label prompt versions, and add tag descriptions. Check out documentation on [prompt tags](https://arize.com/docs/phoenix/prompt-engineering/how-to-prompts/tag-a-prompt).

***

## [04.02.2025 Improved Span Annotation Editor ✍️](04.02.2025-improved-span-annotation-editor.md)

**Available in Phoenix 8.21+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/annotations_span_aside.gif" %}

The new span aside moves the Span Annotation editor into a dedicated panel, providing a clearer view for adding annotations and enhancing customization of your setup. Read this documentation to learn how annotations can be used.

***

## [04.01.2025: Support for MCP Span Tool Info in OpenAI Agents SDK 🔨](04.01.2025-support-for-mcp-span-tool-info-in-openai-agents-sdk.md)

**Available in Phoenix 8.20+**

Newly added to the OpenAI Agent SDK is support for MCP Span Info, allowing for the tracing and extraction of useful information about MCP tool listings. Use the Phoenix OpenAI Agents SDK for powerful agent tracing.

***

## [03.27.2025 Span View Improvements 👀](03.27.2025-span-view-improvements.md)

**Available in Phoenix 8.20+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/span_orphan_toggle.gif" %}

You can now toggle the option to treat orphan spans as root when viewing your spans. Additionally, we've enhanced the UI with an icon view in span details for better visibility in smaller displays. Learn more [here](https://app.gitbook.com/s/ShR775Rt7OzHRfy5j2Ks/tracing/how-to-tracing/setup-tracing).

***

## [03.24.2025: Tracing Configuration Tab 🖌️](03.24.2025-tracing-configuration-tab.md)

**Available in Phoenix 8.19+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/tracing_config.gif" %}

Within each project, there is now a **Config** tab to enhance customization. The default tab can now be set per project, ensuring the preferred view is displayed. Learn more in [projects docs](https://app.gitbook.com/s/ShR775Rt7OzHRfy5j2Ks/tracing/features-tracing/projects).

***

## [03.21.2025: Environmental Variable Based Admin User Configuration 🗝️](03.21.2025-environment-variable-based-admin-user-configuration.md)

**Available in Phoenix 8.17+**

You can now preconfigure admin users at startup using an environment variable, making it easier to manage access during deployment. Admins defined this way are automatically seeded into the database and ready to log in.

***

## 03.20.2025: Delete Experiment from Action Menu 🗑️

**Available in Phoenix 8.16+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/delete_experiments2.gif" %}

You can now delete experiments directly from the action menu, making it quicker to manage and clean up your workspace.

***

## [03.19.2025: Access to New Integrations in Projects 🔌](03.19.2025-access-to-new-integrations-in-projects.md)

**Available in Phoenix 8.15+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/new_integrations.gif" %}

In the New Project tab, we've added quick setup to instrument your application for **BeeAI**, **SmolAgents**, and the **OpenAI Agents SDK**. Easily configure these integrations with streamlined instructions. Check out all Phoenix[ tracing integrations](https://app.gitbook.com/s/ShR775Rt7OzHRfy5j2Ks/tracing/integrations-tracing) here.

***

## [03.18.2025: Resize Span, Trace, and Session Tables 🔀](03.18.2025-resize-span-trace-and-session-tables.md)

**Available in Phoenix 8.14+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/resizeabletables.gif" %}

We've added the ability to resize Span, Trace, and Session tables. Resizing preferences are now persisted in the tracing store, ensuring settings are maintained per-project and per-table.

***

## [03.14.2025: OpenAI Agents Instrumentation 📡](03.14.2025-openai-agents-instrumentation.md)

**Available in Phoenix 8.13+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/openai_sdk_rn.gif" %}

We've introduced the **OpenAI Agents SDK** for Python which provides enhanced visibility into agent behavior and performance. For more details on a quick setup, check out our [docs](https://app.gitbook.com/s/ShR775Rt7OzHRfy5j2Ks/tracing/integrations-tracing/openai-agents-sdk).

```bash
pip install openinference-instrumentation-openai-agents openai-agents
```

***

## [03.07.2025: Model Config Enhancements for Prompts](03.07.2025-model-config-enhancements-for-prompts.md) 💡

**Available in Phoenix 8.11+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/thinking_budget.gif" %}

You can now save and load configurations directly from prompts or default model settings. Additionally, you can adjust the budget token value and enable/disable the "thinking" feature, giving you more control over model behavior and resource allocation.

***

## [03.07.2025: New Prompt Playground, Evals, and Integration Support 🦾](03.07.2025-new-prompt-playground-evals-and-integration-support.md)

**Available in Phoenix 8.9+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/added_support_release_notes.gif" %}

Prompt Playground now supports new GPT and Anthropic models new models with enhanced configuration options. Instrumentation options have been improved for better traceability, and evaluation capabilities have expanded to cover Audio & Multi-Modal Evaluations. Phoenix also introduces new integration support for LiteLLM Proxy & Cleanlabs evals.

***

## [03.06.2025: Project Improvements 📽️](03.06.2025-project-improvements.md)

**Available in Phoenix 8.8+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/projects.gif" %}

We’ve rolled out several enhancements to Projects, offering more flexibility and control over your data. Key updates include persistent column selection, advanced filtering options for metadata and spans, custom time ranges, and improved performance for tracing views. These changes streamline workflows, making data navigation and debugging more efficient.

Check out [projects](https://app.gitbook.com/s/ShR775Rt7OzHRfy5j2Ks/tracing/features-tracing/projects) docs for more.

***

## [02.19.2025: Prompts 📃](02.19.2025-prompts.md)

**Available in Phoenix 8.0+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/prompts_release_notes.gif" %}

Phoenix prompt management will now let you create, modify, tag, and version control prompts for your applications. Some key highlights from this release:

* **Versioning & Iteration**: Seamlessly manage prompt versions in both Phoenix and your codebase.
* **New TypeScript Clien**t: Sync prompts with your JavaScript runtime, now with native support for OpenAI, Anthropic, and the Vercel AI SDK.
* **New Python Clien**t: Sync templates and apply them to AI SDKs like OpenAI, Anthropic, and more.
* **Standardized Prompt Handling**: Native normalization for OpenAI, Anthropic, Azure OpenAI, and Google AI Studio.
* **Enhanced Metadata Propagation**: Track prompt metadata on Playground spans and experiment metadata in dataset runs.

Check out the docs and this [walkthrough](https://youtu.be/qbeohWaRlsM?feature=shared) for more on prompts!📝

***

## [02.18.2025: One-Line Instrumentation⚡️](02.18.2025-one-line-instrumentation.md)

**Available in Phoenix 8.0+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/trace_details_view.png" %}

Phoenix has made it even simpler to get started with tracing by introducing one-line auto-instrumentation. By using `register(auto_instrument=True)`, you can enable automatic instrumentation in your application, which will set up instrumentors based on your installed packages.

```
from phoenix.otel import register

register(auto_instrument=True)
```

***

## [01.18.2025: Automatic & Manual Span Tracing ⚙️](01.18.2025-automatic-and-manual-span-tracing.md)

**Available in Phoenix 7.9+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/tracing.gif" %}

In addition to using our automatic instrumentors and tracing directly using OTEL, we've now added our own layer to let you have the granularity of manual instrumentation without as much boilerplate code.

You can now access a tracer object with streamlined options to trace functions and code blocks. The main two options are using the **decorator** `@tracer.chain` and using the tracer in a `with` clause.

Check out the [docs](https://arize.com/docs/phoenix/tracing/how-to-tracing/instrument-python#using-your-tracer) for more on how to use tracer objects.

***

## [12.09.2024: **Sessions** 💬](12.09.2024-sessions.md)

**Available in Phoenix 7.0+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/sessions_rn.png" %}

Sessions allow you to group multiple responses into a single thread. Each response is still captured as a single trace, but each trace is linked together and presented in a combined view.

Sessions make it easier to visual multi-turn exchanges with your chatbot or agent Sessions launches with Python and TS/JS support. For more on sessions, check out[ a walkthrough video](https://www.youtube.com/watch?v=dzS6x0BE-EU) and the [docs](https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-sessions?utm_campaign=Phoenix%20Newsletter\&utm_source=hs_email\&utm_medium=email&_hsenc=p2ANqtz--aSHse9NA8I5ncZzavHCp6LBXibZCgbWcRrxbh2RwugL6IQdTOSu8cz-Wqh6EO9xJLGX2E).

***

## [11.18.2024: Prompt Playground 🛝](11.18.2024-prompt-playground.md)

**Available in Phoenix 6.0+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/playground_3.gif" %}

Prompt Playground is now available in the Phoenix platform! This new release allows you to test the effects of different prompts, tools, and structured output formats to see which performs best.

* Replay individual spans with modified prompts, or run full Datasets through your variations.
* Easily test different models, prompts, tools, and output formats side-by-side, directly in the platform.
* Automatically capture traces as Experiment runs for later debugging. See [here](https://arize.com/docs/phoenix/prompt-engineering/overview-prompts/prompt-playground) for more information on Prompt Playground, or jump into the platform to try it out for yourself.

***

## [09.26.2024: Authentication & RBAC 🔐](09.26.2024-authentication-and-rbac.md)

**Available in Phoenix 5.0+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/Screenshot%202025-03-27%20at%204.19.39%E2%80%AFPM.png" %}

We've added Authentication and Rules-based Access Controls to Phoenix. This was a long-requested feature set, and we're excited for the new uses of Phoenix this will unlock!

The auth feature set includes secure access, RBAC, API keys, and OAuth2 Support. For all the details on authentication, view our [docs](https://arize.com/docs/phoenix/deployment/authentication).

***

## [07.18.2024: Guardrails AI Integrations💂](07.18.2024-guardrails-ai-integrations.md)

**Available in Phoenix 4.11.0+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/guardrails.png" %}

Our integration with Guardrails AI allows you to capture traces on guard usage and create datasets based on these traces. This integration is designed to enhance the safety and reliability of your LLM applications, ensuring they adhere to predefined rules and guidelines.

Check out the [Cookbook ](https://colab.research.google.com/drive/1NDn5jzsW5k0UrwaBjZenRX29l6ocrZ-_?usp=sharing\&utm_campaign=Phoenix%20Newsletter\&utm_source=hs_email\&utm_medium=email&_hsenc=p2ANqtz-9Tx_lYbuasbD3Mzdwl0VNPcvy_YcbPudxu1qwBZ3T7Mh---A4PO-OJfhas-RR4Ys_IEb0F)here.

***

## [07.11.2024: Hosted Phoenix and LlamaTrace 💻](07.11.2024-hosted-phoenix-and-llamatrace.md)

**Phoenix is now available for deployment as a fully hosted service.**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/hosted%20phoenix.avif" %}

In addition to our existing notebook, CLI, and self-hosted deployment options, we’re excited to announce that Phoenix is now available as a [fully hosted service](https://arize.com/resource/introducing-hosted-phoenix-llamatrace/). With hosted instances, your data is stored between sessions, and you can easily share your work with team members.

We are partnering with LlamaIndex to power a new observability platform in LlamaCloud: LlamaTrace. LlamaTrace will automatically capture traces emitted from your LlamaIndex application.

Hosted Phoenix is 100% free-to-use, [check it out today](https://app.phoenix.arize.com/login)!

***

## [07.03.2024: Datasets & Experiments 🧪](07.03.2024-datasets-and-experiments.md)

**Available in Phoenix 4.6+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/experiments.gif" %}

**Datasets**: Datasets are a new core feature in Phoenix that live alongside your projects. They can be imported, exported, created, curated, manipulated, and viewed within the platform, and make fine-turning and experimentation easier.n

For more details on using datasets see our [documentation](https://arize.com/docs/phoenix/datasets-and-experiments/overview-datasets?utm_campaign=Phoenix%20Newsletter\&utm_source=hs_email\&utm_medium=email&_hsenc=p2ANqtz-9Tx_lYbuasbD3Mzdwl0VNPcvy_YcbPudxu1qwBZ3T7Mh---A4PO-OJfhas-RR4Ys_IEb0F) or [example notebook](https://colab.research.google.com/drive/1e4vZR5VPelXXYGtWfvM3CErPhItHAIp2?usp=sharing\&utm_campaign=Phoenix%20Newsletter\&utm_source=hs_email\&utm_medium=email&_hsenc=p2ANqtz-9Tx_lYbuasbD3Mzdwl0VNPcvy_YcbPudxu1qwBZ3T7Mh---A4PO-OJfhas-RR4Ys_IEb0F).

**Experiments:** Our new Datasets and Experiments feature enables you to create and manage datasets for rigorous testing and evaluation of your models. Check out our full [walkthrough](https://www.youtube.com/watch?v=rzxN-YV_DbE\&t=25s).

***

## [07.02.2024: Function Call Evaluations ⚒️](07.02.2024-function-call-evaluations.md)

**Available in Phoenix 4.6+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/evals-docs.gif" %}

We are introducing a new built-in function call evaluator that scores the function/tool-calling capabilities of your LLMs. This off-the-shelf evaluator will help you ensure that your models are not just generating text but also effectively interacting with tools and functions as intended. Check out a [full walkthrough of the evaluator](https://www.youtube.com/watch?v=Rsu-UZ1ZVZU).

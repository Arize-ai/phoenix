---
description: The latest releases from the Phoenix team.
---

# Release Notes

## 02.19.2025: Prompts 📃

**Available in Phoenix 8.0+**

![](https://storage.googleapis.com/arize-phoenix-assets/assets/images/s-prompts.png)

Phoenix prompt management will now let you create, modify, tag, and version control prompts for your applications!  These are some more highlights from this release:&#x20;

* Native prompt, tool, parameter, and response format normalization for OpenAI, Anthropic, Azure Open AI, Google AI Studio.
* Prompt metadata propagation on Playground spans and experiment metadata on Playground dataset runs.
* Playground Hotkeys and major performance optimizations in the template editors.
* A new TypeScript client for syncing prompts with your JavaScript runtime, including native support for OpenAI, Anthropic, and the Vercel AI SDK.
* A new Python client for syncing templates and applying them to AI SDKs like OpenAI, Anthropic, and others.

Check out the [docs](../prompt-engineering/overview-prompts.md) for more on prompts and other new features! &#x20;

## 02.18.2025: One-Line Instrumentation

**Available in Phoenix 8.0+**

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/trace_details_view.png" %}

Phoenix has made it even simpler to get started with tracing by introducing one-line auto-instrumentation. By using `register(auto_instrument=True)`, you can enable automatic instrumentation in your application, which will set up instrumentors based on your installed packages.

```
from phoenix.otel import register

register(auto_instrument=True)
```

For more details, you can check the [docs](../tracing/llm-traces-1.md) and explore further tracing options.&#x20;

## 01.18.2025: Automatic & Manual Span Tracing ⚙️

**Available in Phoenix 7.9+**

![](https://storage.googleapis.com/arize-phoenix-assets/assets/images/s-tracing.png)

In addition to using our [automatic instrumentors](../tracing/integrations-tracing/) and [tracing directly using OTEL](../tracing/how-to-tracing/custom-spans.md), we've now added our  own layer to let you have the granularity of manual instrumentation without as much boilerplate code.

You can now access a tracer object with streamlined options to trace functions and code blocks. The main two options are:

* Using the **decorator** `@tracer.chain` traces the entire function automatically as a Span in Phoenix. The input, output, and status attributes are set based on the function's parameters and return value.
* Using the tracer in a `with` clause allows you to trace specific code blocks within a function. You manually define the Span name, input, output, and status.

Check out the [docs](https://docs.arize.com/phoenix/tracing/how-to-tracing/instrument-python#using-your-tracer) for more on how to use tracer objects.&#x20;

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

## 11.18.2024: Prompt Playground 🛝

**Available in Phoenix 6.0+**

![](https://storage.googleapis.com/arize-phoenix-assets/assets/images/s-playground.png)

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

## 10.01.2024: Improvements & Bug Fixes 🐛

<details>

<summary>Improvements &#x26; Bug Fixes</summary>

## **Improvements & Bug Fixes 🐛**

* Numerous stability improvements to our hosted Phoenix instances accessed on app.phoenix.arize.com&#x20;
* Added a new command to easily launch a Phoenix client from the cli: `phoenix serve`&#x20;
* Implemented simple email sender to simplify dependencies&#x20;
* Improved error handling for imported spans&#x20;
* Replaced hdbscan with fast-hdbscan Added PHOENIX\_CSRF\_TRUSTED\_ORIGINS environment variable to set trusted origins&#x20;
* Added support for Mistral 1.0&#x20;
* Fixed an issue that caused px.Client().get\_spans\_dataframe() requests to time out

</details>

## 09.26.2024: Authentication & RBAC 🔐

**Available in Phoenix 5.0+**

![](https://storage.googleapis.com/arize-phoenix-assets/assets/images/s-login-page.png)

We've added Authentication and Rules-based Access Controls to Phoenix. This was a long-requested feature set, and we're excited for the new uses of Phoenix this will unlock!&#x20;

The auth feature set includes:&#x20;

* 🔒 Secure Access: All of Phoenix’s UI & APIs (REST, GraphQL, gRPC) now require access tokens or API keys. Keep your data safe!&#x20;
* 👥 RBAC (Role-Based Access Control): Admins can manage users; members can update their profiles—simple & secure.
* 🔑 API Keys: Now available for seamless, secure data ingestion & querying.&#x20;
* 🌐 OAuth2 Support: Easily integrate with Google, AWS Cognito, or Auth0. ✉ Password Resets via SMTP to make security a breeze.&#x20;

For all the details on authentication, view our [docs](https://docs.arize.com/phoenix/deployment/authentication).

## 07.18.2024: Guardrails AI Integrations💂&#x20;

**Available in Phoenix 4.11.0+**

![](https://storage.googleapis.com/arize-phoenix-assets/assets/images/s-guardrails.png)

Our integration with Guardrails AI allows you to capture traces on guard usage and create datasets based on these traces. This integration is designed to enhance the safety and reliability of your LLM applications, ensuring they adhere to predefined rules and guidelines.

Check out the [Cookbook ](https://colab.research.google.com/drive/1NDn5jzsW5k0UrwaBjZenRX29l6ocrZ-_?usp=sharing\&utm_campaign=Phoenix%20Newsletter\&utm_source=hs_email\&utm_medium=email&_hsenc=p2ANqtz-9Tx_lYbuasbD3Mzdwl0VNPcvy_YcbPudxu1qwBZ3T7Mh---A4PO-OJfhas-RR4Ys_IEb0F)here.&#x20;

## 07.11.2024: Hosted Phoenix 💻

**Phoenix is now available for deployment as a fully hosted service.**&#x20;

![](https://storage.googleapis.com/arize-phoenix-assets/assets/images/s-llamatrace.png)

In addition to our existing notebook, CLI, and self-hosted deployment options, we’re excited to announce that Phoenix is now available as a [fully hosted service](https://arize.com/resource/introducing-hosted-phoenix-llamatrace/).

With hosted instances, your data is stored between sessions, and you can easily share your work with team members.

We are partnering with LlamaIndex to power a new observability platform in LlamaCloud: LlamaTrace. LlamaTrace will automatically capture traces emitted from your LlamaIndex applications, and store them in a persistent, cloud- accessible Phoenix instance.

Hosted Phoenix is 100% free-to-use, [check it out today](https://app.phoenix.arize.com/login)!

## 07.03.2024: Datasets & Experiments 🧪

**Available in Phoenix 4.6+**

<figure><img src="../.gitbook/assets/Screenshot 2025-02-18 at 2.34.07 PM.png" alt=""><figcaption></figcaption></figure>

**Datasets** 📊: Datasets are a new core feature in Phoenix that live alongside your projects. They can be imported, exported, created, curated, manipulated, and viewed within the platform, and should make a few flows much easier:

* Fine-tuning: You can now create a dataset based on conditions in the UI, or by manually choosing examples, then export these into csv or jsonl formats readymade for fine-tuning APIs.
* Experimentation: External datasets can be uploaded into Phoenix to serve as the test cases for experiments run in the platform.

For more details on using datasets see our [documentation](https://docs.arize.com/phoenix/datasets-and-experiments/overview-datasets?utm_campaign=Phoenix%20Newsletter\&utm_source=hs_email\&utm_medium=email&_hsenc=p2ANqtz-9Tx_lYbuasbD3Mzdwl0VNPcvy_YcbPudxu1qwBZ3T7Mh---A4PO-OJfhas-RR4Ys_IEb0F) or [example notebook](https://colab.research.google.com/drive/1e4vZR5VPelXXYGtWfvM3CErPhItHAIp2?usp=sharing\&utm_campaign=Phoenix%20Newsletter\&utm_source=hs_email\&utm_medium=email&_hsenc=p2ANqtz-9Tx_lYbuasbD3Mzdwl0VNPcvy_YcbPudxu1qwBZ3T7Mh---A4PO-OJfhas-RR4Ys_IEb0F).

**Experiments 🧪:** Our new Datasets and Experiments feature enables you to create and manage datasets for rigorous testing and evaluation of your models. You can now run comprehensive experiments to measure and analyze the performance of your LLMs in various scenarios.&#x20;

For more details, check out our full [walkthrough](https://www.youtube.com/watch?v=rzxN-YV_DbE\&t=25s).&#x20;

## 07.02.2024: Function Call Evaluations ⚒️

**Available in Phoenix 4.6+**

<figure><img src="../.gitbook/assets/Screenshot 2025-02-18 at 2.45.33 PM.png" alt=""><figcaption></figcaption></figure>

We are introducing a new built-in function call evaluator that scores the function/tool-calling capabilities of your LLMs. This off-the-shelf evaluator will help you ensure that your models are not just generating text but also effectively interacting with tools and functions as intended.

This evaluator checks for issues arising from function routing, parameter extraction, and function generation.

Check out a [full walkthrough of the evaluator](https://www.youtube.com/watch?v=Rsu-UZ1ZVZU).

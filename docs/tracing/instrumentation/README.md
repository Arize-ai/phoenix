---
description: >-
  How OpenInference facilitates automatic and manual instrumentation of
  applications.
---

# Instrumentation

<figure><img src="../../.gitbook/assets/integrations (1).png" alt=""><figcaption><p>Instrumentations available via OpenInference</p></figcaption></figure>

In order to make a system observable, it must be **instrumented**: That is, code from the system’s components must emit traces.

Without being required to modify the source code you can collect telemetry from an application using automatic instrumentation. If you previously used an APM agent to extract telemetry from your application, Automatic Instrumentation will give you a similar out of the box experience.

To facilitate the instrumentation of applications even more, you can manually instrument your applications by coding against the OpenTelemetry APIs.

For that you don’t need to instrument all the dependencies used in your application:

* some of your libraries will be observable out of the box by calling the OpenTelemetry API themselves directly. Those libraries are sometimes called **natively instrumented**.
* for libraries without such an integration the OpenTelemetry projects provide language specific [Instrumentation Libraries](https://github.com/Arize-ai/openinference)

Note, that for most languages it is possible to use both manual and automatic instrumentation at the same time: Automatic Instrumentation will allow you to gain insights into your application quickly and manual instrumentation will enable you to embed granular observability into your code.

Phoenix natively supports collecting traces generated via OpenInference automatic instrumentation. The supported instrumentations are:

OpenInference provides a set of instrumentations for popular machine learning SDKs and frameworks in a variety of languages.

### Python

| Package                                                                                                                                                                       | Description                                    | Version                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`openinference-semantic-conventions`](https://github.com/Arize-ai/openinference/blob/main/python/openinference-semantic-conventions/README.md)                               | Semantic conventions for tracing of LLM Apps.  | [![PyPI Version](https://camo.githubusercontent.com/9a08bbaf1640e94354c1a85146fdd40afd89b2f8aeb6574baa7c1b846ac7792d/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d73656d616e7469632d636f6e76656e74696f6e732e737667)](https://pypi.python.org/pypi/openinference-semantic-conventions)                      |
| [`openinference-instrumentation-openai`](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-openai/README.md)           | OpenInference Instrumentation for OpenAI SDK.  | [![PyPI Version](https://camo.githubusercontent.com/bb515c29aa0ef45bff47e0510f59ed6701c43457a90d574f537e43c24de9d80f/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6f70656e61692e737667)](https://pypi.python.org/pypi/openinference-instrumentation-openai)                |
| [`openinference-instrumentation-llama-index`](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-llama-index/README.md) | OpenInference Instrumentation for LlamaIndex.  | [![PyPI Version](https://camo.githubusercontent.com/f9b5663c14435cd2e280675aee8a86f23b1802679514ddbd9cd6d7b5e5d51a06/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6c6c616d612d696e6465782e737667)](https://pypi.python.org/pypi/openinference-instrumentation-llama-index) |
| [`openinference-instrumentation-dspy`](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-dspy/README.md)               | OpenInference Instrumentation for DSPy.        | [![PyPI Version](https://camo.githubusercontent.com/414d13608ed7dd45f47e813034d6934993bcb49394a51910fa2f037efb4cd891/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d647370792e737667)](https://pypi.python.org/pypi/openinference-instrumentation-dspy)                      |
| [`openinference-instrumentation-bedrock`](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-bedrock/README.md)         | OpenInference Instrumentation for AWS Bedrock. | [![PyPI Version](https://camo.githubusercontent.com/98735a9c821fdb27bf3c29ccf513af8de1fba8878bd6e424ee42f8c971df1afe/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d626564726f636b2e737667)](https://pypi.python.org/pypi/openinference-instrumentation-bedrock)             |
| [`openinference-instrumentation-langchain`](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-langchain/README.md)     | OpenInference Instrumentation for LangChain.   | [![PyPI Version](https://camo.githubusercontent.com/17d2c9f2d42d6dd80a5e0defeed3d7d346444231761194d328e9f21b57c18eae/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6c616e67636861696e2e737667)](https://pypi.python.org/pypi/openinference-instrumentation-langchain)       |

### JavaScript

| Package                                                                                                                                                           | Description                                   | Version                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@arizeai/openinference-semantic-conventions`](https://github.com/Arize-ai/openinference/blob/main/js/packages/openinference-semantic-conventions/README.md)     | Semantic conventions for tracing of LLM Apps. | [![NPM Version](https://camo.githubusercontent.com/43381a7078fce4f511768ea1941bb98a035955f0d79d02f4a3de58f9b7edf727/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f406172697a6561692f6f70656e696e666572656e63652d73656d616e7469632d636f6e76656e74696f6e732e737667)](https://www.npmjs.com/package/@arizeai/openinference-semantic-conventions) |
| [`@arizeai/openinference-instrumentation-openai`](https://github.com/Arize-ai/openinference/blob/main/js/packages/openinference-instrumentation-openai/README.md) | OpenInference Instrumentation for OpenAI SDK. | [![NPM Version](https://camo.githubusercontent.com/e8d7d683994696e16d7620368f72a71929485bbfaad93848edfa813f631d53e2/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f406172697a6561692f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6f70656e6169)](https://www.npmjs.com/package/@arizeai/openinference-instrumentation-openai)   |

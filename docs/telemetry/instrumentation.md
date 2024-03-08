---
description: How OpenInference facilitates automatic instrumentation of applications.
---

# Auto Instrumentation

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/Ways-to-collect-data-for-Arize-and-Phoenix.png" alt=""><figcaption></figcaption></figure>

In order to make a system observable, it must be **instrumented**: That is, code from the system’s components must emit traces.

Phoenix natively supports collecting traces generated via OpenInference automatic instrumentation. The supported instrumentations are:

### Python

The following auto-instrumentation packages can be installed via `pip` or `conda`.

| Name                                                   | Package                                     | Version                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [LlamaIndex](../tracing/instrumentation/llamaindex.md) | `openinference-instrumentation-llama-index` | [![PyPI Version](https://camo.githubusercontent.com/f9b5663c14435cd2e280675aee8a86f23b1802679514ddbd9cd6d7b5e5d51a06/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6c6c616d612d696e6465782e737667)](https://pypi.python.org/pypi/openinference-instrumentation-llama-index) |
| [LangChain](../tracing/instrumentation/langchain.md)   | `openinference-instrumentation-langchain`   | [![PyPI Version](https://camo.githubusercontent.com/17d2c9f2d42d6dd80a5e0defeed3d7d346444231761194d328e9f21b57c18eae/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6c616e67636861696e2e737667)](https://pypi.python.org/pypi/openinference-instrumentation-langchain)       |
| [OpenAI](../tracing/instrumentation/openai.md)         | `openinference-instrumentation-openai`      | [![PyPI Version](https://camo.githubusercontent.com/bb515c29aa0ef45bff47e0510f59ed6701c43457a90d574f537e43c24de9d80f/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6f70656e61692e737667)](https://pypi.python.org/pypi/openinference-instrumentation-openai)                |
| [DSPy](../tracing/instrumentation/dspy.md)             | `openinference-instrumentation-dspy`        | [![PyPI Version](https://camo.githubusercontent.com/414d13608ed7dd45f47e813034d6934993bcb49394a51910fa2f037efb4cd891/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d647370792e737667)](https://pypi.python.org/pypi/openinference-instrumentation-dspy)                      |
| [AWS Bedrock](../tracing/instrumentation/bedrock.md)   | `openinference-instrumentation-bedrock`     | [![PyPI Version](https://camo.githubusercontent.com/98735a9c821fdb27bf3c29ccf513af8de1fba8878bd6e424ee42f8c971df1afe/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d626564726f636b2e737667)](https://pypi.python.org/pypi/openinference-instrumentation-bedrock)             |

### JavaScript

The following auto-instrumentation packages can be installed via `npm`.

| Name   | Package                                         | Version                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI | `@arizeai/openinference-instrumentation-openai` | [![NPM Version](https://camo.githubusercontent.com/e8d7d683994696e16d7620368f72a71929485bbfaad93848edfa813f631d53e2/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f406172697a6561692f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6f70656e6169)](https://www.npmjs.com/package/@arizeai/openinference-instrumentation-openai) |

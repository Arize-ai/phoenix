# Evaluation Models

{% embed url="https://www.youtube.com/watch?v=Y_tKS7WIcyY" %}

**`arize-phoenix-evals`** supports a large set of foundation models for Evals such as:

* OpenAI
* Vertex AI
* Azure Open AI
* Anthropic
* Mixtral/Mistral
* AWS Bedrock
* Falcon
* Code Llama
* Llama3
* Deepseek
* Deberta
* DBRX
* Qwen

And many more.

There are direct model integrations in Phoenix and indirect model integrations (e.x. local modals) through [LiteLLM](../api/evaluation-models.md#litellmmodel).

**Direct Integrations:**

These integrations are native to the Phoenix Evals package and have better throughput, rate limit and error management.

[Vertex AI](../api/evaluation-models.md#phoenix.evals.vertexai)

[OpenAI](../api/evaluation-models.md#phoenix.evals.openaimodel)

[Azure OpenAI](../api/evaluation-models.md#azure-openai)

[Anthropic](../api/evaluation-models.md#phoenix.evals.anthropic)

[Mistral](../api/evaluation-models.md#mistralaimodel)

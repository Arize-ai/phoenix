# Configure AI Providers



Phoenix natively integrates with OpenAI, Azure OpenAI, Anthropic, and Google AI Studio (gemini) to make it easy to test changes to your prompts. In addition to the above, since many AI providers (deepseek, ollama) can be used directly with the OpenAI client, you can talk to any OpenAI compatible LLM provider.

## Credentials

To securely provide your API keys, you have two options. One is to store them in your browser in local storage. Alternatively, you can set them as environment variables on the server side. If both are set at the same time, the credential set in the browser will take precedence.

### Option 1: Store API Keys in the Browser

API keys can be entered in the playground application via the API Keys dropdown menu. This option stores API keys in the browser.  Simply navigate to to settings and set your API keys.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/ai_providers.png" alt=""><figcaption></figcaption></figure>

### Option 2: Set Environment Variables on Server Side

_Available on self-hosted Phoenix_

If the following variables are set in the server environment, they'll be used at API invocation time.

<table><thead><tr><th width="196">Provider</th><th>Environment Variable</th><th>Platform Link</th></tr></thead><tbody><tr><td>OpenAI</td><td><ul><li>OPENAI_API_KEY</li></ul></td><td><a href="https://platform.openai.com/">https://platform.openai.com/</a></td></tr><tr><td>Azure OpenAI</td><td><ul><li>AZURE_OPENAI_API_KEY</li><li>AZURE_OPENAI_ENDPOINT</li><li>OPENAI_API_VERSION</li></ul></td><td><a href="https://azure.microsoft.com/en-us/products/ai-services/openai-service/">https://azure.microsoft.com/en-us/products/ai-services/openai-service/</a></td></tr><tr><td>Anthropic</td><td><ul><li>ANTHROPIC_API_KEY</li></ul></td><td><a href="https://console.anthropic.com/">https://console.anthropic.com/</a></td></tr><tr><td>Gemini</td><td><ul><li>GEMINI_API_KEY or GOOGLE_API_KEY</li></ul></td><td><a href="https://aistudio.google.com/">https://aistudio.google.com/</a></td></tr></tbody></table>



## Using OpenAI Compatible LLMs

### Option 1: Configure the base URL in the prompt playground

Since you can configure the base URL for the OpenAI client, you can use the prompt playground with a variety of OpenAI Client compatible LLMs such as **Ollama**, **DeepSeek**, and more.\


<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/cutom_openai_llm.png" alt=""><figcaption><p>Simply insert the URL for the OpenAI client compatible LLM provider</p></figcaption></figure>

{% hint style="info" %}
If you are using an LLM provider, you will have to set the OpenAI api key to that provider's api key for it to work.
{% endhint %}

OpenAI Client compatible providers Include

| Provider | Base URL                                                                   | Docs                                                                                                                   |
| -------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| DeepSeek | <p><a href="https://api.deepseek.com">https://api.deepseek.com<br></a></p> | [https://api-docs.deepseek.com/](https://api-docs.deepseek.com/)                                                       |
| Ollama   | [http://localhost:11434/v1/](http://localhost:11434/v1/)                   | [https://github.com/ollama/ollama/blob/main/docs/openai.md](https://github.com/ollama/ollama/blob/main/docs/openai.md) |

### Option 2: Server side configuration of the OpenAI base URL

Optionally, the server can be configured with the `OPENAI_BASE_URL` environment variable to change target any OpenAI compatible REST API.

{% hint style="warning" %}
For app.phoenix.arize.com, this may fail due to security reasons. In that case, you'd see a Connection Error appear.



If there is a LLM endpoint you would like to use, reach out to [mailto://phoenix-support@arize.com](mailto://phoenix-support@arize.com)
{% endhint %}

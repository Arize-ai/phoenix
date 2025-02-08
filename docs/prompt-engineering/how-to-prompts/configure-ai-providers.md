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

<table><thead><tr><th width="196">Provider</th><th>Environment Variable</th></tr></thead><tbody><tr><td>OpenAI</td><td><ul><li>OPENAI_API_KEY</li></ul></td></tr><tr><td>Azure OpenAI</td><td><ul><li>AZURE_OPENAI_API_KEY</li><li>AZURE_OPENAI_ENDPOINT</li><li>OPENAI_API_VERSION</li></ul></td></tr><tr><td>Anthropic</td><td><ul><li>ANTHROPIC_API_KEY</li></ul></td></tr><tr><td>Gemini</td><td><ul><li>GEMINI_API_KEY or GOOGLE_API_KEY</li></ul></td></tr></tbody></table>

##

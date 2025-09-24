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

{% hint style="info" %}
For Azure, you can also set the following server-side environment variables: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_FEDERATED_TOKEN_FILE` to use [WorkloadIdentityCredential](https://learn.microsoft.com/en-us/python/api/azure-identity/azure.identity.workloadidentitycredential?view=azure-python).
{% endhint %}


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

## Custom Headers

Phoenix supports adding custom HTTP headers to requests sent to AI providers. This feature is particularly useful when working with custom LLM proxies or when you need additional functionality beyond standard authentication.

### When to Use Custom Headers

Custom headers are helpful in several scenarios:

- **Additional Credentials**: When your LLM proxy requires extra authentication tokens or API keys beyond the standard authorization header
- **Request Routing**: When using load balancers or proxies that route requests based on custom header values
- **Cost Tracking**: When you need to include tracking identifiers for billing or usage analytics
- **Custom Metadata**: When your infrastructure requires additional metadata to be passed with each request

### Configuring Custom Headers in the Playground

To add custom headers to your AI provider configuration:

1. **Open Model Configuration**: In the playground, click on the model configuration button (showing your current model name) next to the provider selection
2. **Navigate to Custom Headers**: Scroll down to the "Custom Headers" section in the configuration dialog
3. **Add Headers**: Enter your headers in JSON format in the provided editor

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/custom_headers_config.png" alt="Custom Headers Configuration"><figcaption><p>Configure custom headers in the model configuration dialog</p></figcaption></figure>

### Header Format

Custom headers should be provided as a JSON object with string keys and values:

```json
{
  "X-Custom-Auth": "your-token-here",
  "X-Request-ID": "unique-request-identifier",
  "X-Cost-Center": "team-alpha"
}
```

### Examples

#### Example 1: Additional Authentication
```json
{
  "X-API-Token": "secondary-auth-token",
  "X-Client-ID": "your-client-identifier"
}
```

#### Example 2: Request Routing
```json
{
  "X-Route-To": "us-west-2",
  "X-Load-Balancer-Pool": "premium-tier"
}
```

#### Example 3: Cost and Usage Tracking
```json
{
  "X-Cost-Center": "engineering-team",
  "X-Project-ID": "phoenix-evaluation",
  "X-User-ID": "user-123"
}
```

### How Custom Headers Work

- Custom headers are sent **in addition to** the standard authentication headers (like `Authorization` for API keys)
- Headers are passed through as-is to the LLM provider without modification
- The headers are included with every request made during prompt iteration in the playground
- Headers are validated to ensure they follow proper HTTP header format

### Provider Compatibility

Custom headers are supported for most AI providers in Phoenix, including:
- OpenAI and OpenAI-compatible providers
- Azure OpenAI
- Anthropic
- DeepSeek
- Custom LLM proxies

{% hint style="info" %}
Custom headers are not available for Google AI Studio (Gemini) models due to API limitations.
{% endhint %}

### Best Practices

- **Security**: Never include sensitive credentials directly in header values. Use environment variables or secure credential management systems when possible
- **Naming**: Use descriptive header names with appropriate prefixes (e.g., `X-` for custom headers)
- **Documentation**: Document the purpose of each custom header for your team
- **Testing**: Test your configuration with a simple prompt to ensure headers are being sent correctly

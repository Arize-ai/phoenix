# Quickstart: Prompts

## Dependencies

if you are using Phoenix as a container, there is no additional steps required.\
\
If runnining Phoenix via Python, you must install optional dependencies on the machine that is running the Phoenix server.

Phoenix needs to be restarted before new providers will be available.

If you try to select a model provider and the corresponding dependencies have not been installed, we will show you which dependencies need to be installed for that provider.

<table><thead><tr><th width="196">Provider</th><th>Required Dependency</th></tr></thead><tbody><tr><td>OpenAI</td><td><ul><li><code>pip install openai</code></li></ul></td></tr><tr><td>Azure OpenAI</td><td><ul><li><code>pip install openai</code></li></ul></td></tr><tr><td>Anthropic</td><td><ul><li><code>pip install anthropic</code></li></ul></td></tr><tr><td>Gemini</td><td><ul><li><code>pip install google-generativeai</code></li></ul></td></tr></tbody></table>

## Credentials

To securely provide your API keys, you have two options. One is to store them in your browser in local storage. Alternatively, you can set them as environment variables on the server side. If both are set at the same time, the credential set in the browser will take precedence.

### Optional 1: Store API Keys in the Browser

API keys can be entered in the playground application via the API Keys dropdown menu. This option stores API keys in the browser. Which API key is displayed in the menu depends on which provider is set in the model config. For example, to enter the API key for Anthropic, first select Anthropic as the provider in the model config.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/store_playground_api_keys_in_browser.png" alt=""><figcaption></figcaption></figure>

### Option 2: Set Environment Variables on Server Side

If the following variables are set in the server environment, they'll be used at API invocation time.

<table><thead><tr><th width="196">Provider</th><th>Environment Variable</th></tr></thead><tbody><tr><td>OpenAI</td><td><ul><li>OPENAI_API_KEY</li></ul></td></tr><tr><td>Azure OpenAI</td><td><ul><li>AZURE_OPENAI_API_KEY</li><li>AZURE_OPENAI_ENDPOINT</li><li>OPENAI_API_VERSION</li></ul></td></tr><tr><td>Anthropic</td><td><ul><li>ANTHROPIC_API_KEY</li></ul></td></tr><tr><td>Gemini</td><td><ul><li>GEMINI_API_KEY or GOOGLE_API_KEY</li></ul></td></tr></tbody></table>


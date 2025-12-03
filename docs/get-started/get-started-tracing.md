# Get Started: Tracing

Now that you have Phoenix up and running, the next step is to start sending **traces** from your Python application. Traces let you see what’s happening inside your system, including function calls, LLM requests, tool calls, and other operations.

{% stepper %}
{% step %}
**Launch Phoenix**

Before sending traces, make sure Phoenix is running. For more step by step instructions, check out this [Get Started guide](./).

{% tabs %}
{% tab title="Phoenix Cloud" %}
Log in, create a space, navigate to the settings page in your space, and create your API keys.

In your code, set your environment variables.

```bash
export PHOENIX_API_KEY = "ADD YOUR PHOENIX API KEY"
export PHOENIX_COLLECTOR_ENDPOINT = "ADD YOUR PHOENIX COLLECTOR ENDPOINT"
```

You can find your collector endpoint here:

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/phoenix_hostname_settings.png" alt="After launching your space, go to settings."><figcaption><p>Launch your space, navigate to settings &#x26; copy your hostname for your collector endpoint</p></figcaption></figure>

Your Collector Endpoint is: [https://app.phoenix.arize.com/s/](https://app.phoenix.arize.com/s/) + your space name.
{% endtab %}

{% tab title="Local (Self-hosted)" %}
If you installed Phoenix locally, you have a variety of options for deployment methods including: Terminal, Docker, Kubernetes, Railway, & AWS CloudFormation. ([Learn more: Self-Hosting](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/0gWR4qoGzdz04iSgPlsU/))

To host on your local machine, run `phoenix serve` in your terminal.

Navigate to your localhost in your browser. (example localhost:6006)
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
**Install the Phoenix OTEL Package**

To collect traces from your application, you must configure an OpenTelemetry TracerProvider to send traces to Phoenix.

{% tabs %}
{% tab title="Python" %}
```bash
pip install arize-phoenix-otel
```
{% endtab %}

{% tab title="TS" %}
```bash
# npm, pnpm, yarn, etc
npm install @arizeai/phoenix-otel
```
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
**Set-Up Tracing**

There are two ways to trace your application: manually, or automatically with an auto-instrumentor. OpenInference provides the auto-instrumenter option through ready-to-use integrations with popular frameworks, so you can capture traces without adding manual logging code.

{% tabs %}
{% tab title="OpenAI (Python)" %}
Phoenix can capture all calls made to supported libraries automatically. Just install the [associated library](https://github.com/Arize-ai/openinference?tab=readme-ov-file#instrumentation).

```
pip install openinference-instrumentation-openai
```
{% endtab %}

{% tab title="OpenAI (TS)" %}
Phoenix can capture all calls made to supported libraries automatically. Just install the [associated library](https://github.com/Arize-ai/openinference?tab=readme-ov-file#instrumentation).

```bash
# npm, pnpm, yarn, etc
npm install openai @arizeai/openinference-instrumentation-openai
```

Update your `instrumentation.ts`file, registering the instrumentation. Steps will vary depending on if your project is configured for CommonJS or ESM style module resolution.

{% tabs %}
{% tab title="ESM Project" %}
<pre class="language-typescript"><code class="lang-typescript"><strong>// instrumentation.ts
</strong>
// ... rest of imports
import OpenAI from "openai"
import { registerInstrumentations } from "@arizeai/phoenix-otel";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

// ... previous code

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({
  instrumentations: [instrumentation],
});
</code></pre>
{% endtab %}

{% tab title="CommonJS Project" %}
<pre class="language-typescript"><code class="lang-typescript"><strong>// instrumentation.ts
</strong>
// ... rest of imports
import { registerInstrumentations } from "@arizeai/phoenix-otel";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

// ... previous code

registerInstrumentations({
  instrumentations: [new OpenAIInstrumentation()],
});
</code></pre>
{% endtab %}
{% endtabs %}

{% hint style="info" %}
Your project can be configured for CommonJS or ESM via many methods. It can depend on your installed runtime (Node, Deno, etc), as well as configuration within your \`package.json\`. Consult your runtime documentation for more details.
{% endhint %}
{% endtab %}

{% tab title="Other Integrations" %}
Phoenix supports a variety of frameworks, model providers, and other integrations. For Example:

<table data-view="cards"><thead><tr><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td>Anthropic</td><td><a href="https://arize.com/docs/phoenix/integrations/llm-providers/anthropic">https://arize.com/docs/phoenix/integrations/llm-providers/anthropic</a></td></tr><tr><td>Google</td><td><a href="https://arize.com/docs/phoenix/integrations/llm-providers/google-gen-ai">https://arize.com/docs/phoenix/integrations/llm-providers/google-gen-ai</a></td></tr><tr><td>LiteLLM</td><td><a href="https://arize.com/docs/phoenix/integrations/llm-providers/litellm">https://arize.com/docs/phoenix/integrations/llm-providers/litellm</a></td></tr><tr><td>CrewAI</td><td><a href="https://arize.com/docs/phoenix/integrations/python/crewai">https://arize.com/docs/phoenix/integrations/python/crewai</a></td></tr><tr><td>DSPy</td><td><a href="https://arize.com/docs/phoenix/integrations/python/dspy">https://arize.com/docs/phoenix/integrations/python/dspy</a></td></tr><tr><td>Mastra</td><td><a href="https://arize.com/docs/phoenix/integrations/typescript/mastra">https://arize.com/docs/phoenix/integrations/typescript/mastra</a></td></tr></tbody></table>

{% hint style="success" %}
Check out our [Integrations page](https://arize.com/docs/phoenix/integrations) for all Integrations
{% endhint %}
{% endtab %}

{% tab title="Manual " %}
Trace your own functions using OpenInference/OpenTelemetry.

Functions can be traced using decorators:

```python
@tracer.chain
def my_func(input: str) -> str:
    return "output"
```

Input and output attributes are set automatically based on `my_func`'s parameters and return.

For Manually tracing your whole application, check out [our guide on manual tracing](https://arize.com/docs/phoenix/tracing/how-to-tracing#manual-instrumentation) using OpenInference/OpenTelemetry.
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
**Register a Tracer**

In your Python code, register Phoenix as the trace provider. This connects your application to Phoenix, making a project in the UI after you send a trace, and optionally enables auto-instrumentation (automatic tracing for supported libraries like OpenAI).

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.otel import register

tracer_provider = register(
    project_name="my-llm-app",
    auto_instrument=True,
)

tracer = tracer_provider.get_tracer(__name__)
```
{% endtab %}

{% tab title="TS" %}
In a new file called `instrumentation.ts` (or .js if applicable)

```typescript
// instrumentation.ts
import { register } from "@arizeai/phoenix-otel";

const provider = register({
  projectName: "my-llm-app", // Sets the project name in Phoenix UI
});
```

The `register` function automatically:

* Reads `PHOENIX_COLLECTOR_ENDPOINT` and `PHOENIX_API_KEY` from environment variables
* Configures the collector endpoint (defaults to `http://localhost:6006`)
* Sets up batch span processing for production use
* Registers the provider globally

{% hint style="info" %}
**Environment Variables:**

* `PHOENIX_COLLECTOR_ENDPOINT` - The URL to your Phoenix instance (e.g., `https://app.phoenix.arize.com`)
* `PHOENIX_API_KEY` - Your Phoenix API key for authentication
{% endhint %}

Now, import this file at the top of your main program entrypoint, or invoke it with the node cli's `--require` flag:

* Import Method:
  * In main.ts or similar: `import "./instrumentation.ts"`
  * In your CLI, script, Dockerfile, etc: `node main.ts`
* \--require Method:
  * In your CLI, script, Dockerfile, etc: `node --require ./instrumentation.ts main.ts`
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
**Start Your Application**

Now that you have set up tracing & your project in Phoenix, it's time to actually invoke your llm, agent, or application.

{% tabs %}
{% tab title="OpenAI (Python)" %}
First add your OpenAI API Key & then invoke the model.

```python
import os
from getpass import getpass

if not (openai_api_key := os.getenv("OPENAI_API_KEY")):
    openai_api_key = getpass("🔑 Enter your OpenAI API key: ")

os.environ["OPENAI_API_KEY"] = openai_api_key
```

```python
# Add OpenAI API Key
import openai

client = openai.OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Why is the sky blue?"}],
)
print(response.choices[0].message.content)
```
{% endtab %}

{% tab title="OpenAI (TS)" %}
In your app code, invoke OpenAI:

```typescript
// main.ts
import OpenAI from "openai";

// set OPENAI_API_KEY in environment, or pass it in arguments
const openai = new OpenAI();

openai.chat.completions
  .create({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Write a haiku." }],
  })
  .then((response) => {
    console.log(response.choices[0].message.content);
  })
  // for demonstration purposes, keep the node process alive long
  // enough for BatchSpanProcessor to flush Trace to Phoenix
  // with its default flush time of 5 seconds
  .then(() => new Promise((resolve) => setTimeout(resolve, 6000)));

```
{% endtab %}

{% tab title="Other Integrations" %}
Phoenix supports a variety of frameworks, model providers, and other integrations. After downloading any of these auto-instrumenters, the next step is to invoke them & see your traces populate in the Phoenix UI.

<table data-view="cards"><thead><tr><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td>Anthropic</td><td><a href="https://arize.com/docs/phoenix/integrations/llm-providers/anthropic">https://arize.com/docs/phoenix/integrations/llm-providers/anthropic</a></td></tr><tr><td>Google</td><td><a href="https://arize.com/docs/phoenix/integrations/llm-providers/google-gen-ai">https://arize.com/docs/phoenix/integrations/llm-providers/google-gen-ai</a></td></tr><tr><td>LiteLLM</td><td><a href="https://arize.com/docs/phoenix/integrations/llm-providers/litellm">https://arize.com/docs/phoenix/integrations/llm-providers/litellm</a></td></tr><tr><td>CrewAI</td><td><a href="https://arize.com/docs/phoenix/integrations/python/crewai">https://arize.com/docs/phoenix/integrations/python/crewai</a></td></tr><tr><td>DSPy</td><td><a href="https://arize.com/docs/phoenix/integrations/python/dspy">https://arize.com/docs/phoenix/integrations/python/dspy</a></td></tr><tr><td>Mastra</td><td><a href="https://arize.com/docs/phoenix/integrations/typescript/mastra">https://arize.com/docs/phoenix/integrations/typescript/mastra</a></td></tr></tbody></table>

{% hint style="success" %}
Check out our [Integrations page](https://arize.com/docs/phoenix/integrations) for all Integrations
{% endhint %}
{% endtab %}

{% tab title="Manual " %}
After setting up all your functions to be traced using OpenInference/OpenTelemetry, now just call your application to start & you should be able to see your traces populate in the Phoenix UI.
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
**View your Traces in Phoenix**

You should now see traces in Phoenix!

<figure><img src="../.gitbook/assets/Screenshot 2024-10-29 at 2.51.24 PM.png" alt=""><figcaption></figcaption></figure>
{% endstep %}
{% endstepper %}

### Learn More:

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td>Tracing Concepts</td><td><a href="../tracing/concepts-tracing/">concepts-tracing</a></td></tr><tr><td>Tracing in Phoenix</td><td><a href="../tracing/llm-traces/">llm-traces</a></td></tr></tbody></table>

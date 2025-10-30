# Get Started: Tracing

Now that you have Phoenix up and running, the next step is to start sending **traces** from your Python application. Traces let you see what’s happening inside your system, including function calls, LLM requests, tool calls, and other operations.&#x20;

{% stepper %}
{% step %}
### Launch Phoenix&#x20;

Before sending traces, make sure Phoenix is running. For more step by step instructions, check out this [Get Started guide](./).&#x20;

{% tabs %}
{% tab title="Phoenix Cloud" %}
Log in, create a space, navigate to the settings page in your space, and create your API keys.&#x20;

In your code, set your environment variables.&#x20;

```python
import os
os.environ["PHOENIX_API_KEY"] = "ADD YOUR PHOENIX API KEY"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "ADD YOUR PHOENIX Collector endpoint"
```

You can find your collector endpoint here:&#x20;

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/phoenix_hostname_settings.png" alt="After launching your space, go to settings. "><figcaption><p>Launch your space, navigate to settings &#x26; copy your hostname for your collector endpoint </p></figcaption></figure>

Your Collector Endpoint is: [https://app.phoenix.arize.com/s/](https://app.phoenix.arize.com/s/) + your space name.&#x20;
{% endtab %}

{% tab title="Local (Self-hosted)" %}
If you installed Phoenix locally, you have a variety of options for deployment methods including: Terminal, Docker, Kubernetes, Railway, & AWS CloudFormation.  ([Learn more: Self-Hosting](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/0gWR4qoGzdz04iSgPlsU/))

To host on your local machine, run `phoenix serve` in your terminal.&#x20;

Navigate to your localhost in your browser. (example localhost:6006)&#x20;
{% endtab %}
{% endtabs %}


{% endstep %}

{% step %}
### Install the Phoenix OTEL Package&#x20;

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
npm install @arizeai/openinference-semantic-conventions @opentelemetry/semantic-conventions @opentelemetry/api @opentelemetry/instrumentation @opentelemetry/resources @opentelemetry/sdk-trace-base @opentelemetry/sdk-trace-node @opentelemetry/exporter-trace-otlp-proto
```
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
### Set-Up Tracing&#x20;

There are two ways to trace your application: manually, or automatically with an auto-instrumentor. OpenInference provides the auto-instrumenter option through ready-to-use integrations with popular frameworks, so you can capture traces without adding manual logging code.&#x20;

{% tabs %}
{% tab title="OpenAI (Python)" %}
Phoenix can capture all calls made to supported libraries automatically. Just install the [associated library](https://github.com/Arize-ai/openinference?tab=readme-ov-file#instrumentation).&#x20;

```
pip install openinference-instrumentation-openai
```
{% endtab %}

{% tab title="OpenAI (TS)" %}
Phoenix can capture all calls made to supported libraries automatically. Just install the [associated library](https://github.com/Arize-ai/openinference?tab=readme-ov-file#instrumentation).&#x20;

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
import { registerInstrumentations } from "@opentelemetry/instrumentation";
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
import { registerInstrumentations } from "@opentelemetry/instrumentation";
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
Phoenix supports a variety of frameworks, model providers, and other integrations. For Example:&#x20;

<table data-view="cards"><thead><tr><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td>Anthropic </td><td><a href="https://arize.com/docs/phoenix/integrations/llm-providers/anthropic">https://arize.com/docs/phoenix/integrations/llm-providers/anthropic</a></td></tr><tr><td>Google</td><td><a href="https://arize.com/docs/phoenix/integrations/llm-providers/google-gen-ai">https://arize.com/docs/phoenix/integrations/llm-providers/google-gen-ai</a></td></tr><tr><td>LiteLLM</td><td><a href="https://arize.com/docs/phoenix/integrations/llm-providers/litellm">https://arize.com/docs/phoenix/integrations/llm-providers/litellm</a></td></tr><tr><td>CrewAI</td><td><a href="https://arize.com/docs/phoenix/integrations/python/crewai">https://arize.com/docs/phoenix/integrations/python/crewai</a></td></tr><tr><td>DSPy</td><td><a href="https://arize.com/docs/phoenix/integrations/python/dspy">https://arize.com/docs/phoenix/integrations/python/dspy</a></td></tr><tr><td>Mastra</td><td><a href="https://arize.com/docs/phoenix/integrations/typescript/mastra">https://arize.com/docs/phoenix/integrations/typescript/mastra</a></td></tr></tbody></table>

{% hint style="success" %}
Check out our [Integrations page](https://arize.com/docs/phoenix/integrations) for all Integrations&#x20;
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

For Manually tracing your whole application, check out [our guide on manual tracing](https://arize.com/docs/phoenix/tracing/how-to-tracing#manual-instrumentation) using OpenInference/OpenTelemetry.&#x20;
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
### Register a Tracer

In your Python code, register Phoenix as the trace provider. This connects your application to Phoenix, making a project in the UI after you send a trace, and optionally enables auto-instrumentation (automatic tracing for supported libraries like OpenAI).&#x20;

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
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

const COLLECTOR_ENDPOINT = process.env.PHOENIX_COLLECTOR_ENDPOINT;
const SERVICE_NAME = "my-llm-app";

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    // defaults to "default" in the Phoenix UI
    [SEMRESATTRS_PROJECT_NAME]: SERVICE_NAME,
  }),
  spanProcessors: [
    // BatchSpanProcessor will flush spans in batches after some time,
    // this is recommended in production. For development or testing purposes
    // you may try SimpleSpanProcessor for instant span flushing to the Phoenix UI.
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: `${COLLECTOR_ENDPOINT}/v1/traces`,
        // (optional) if connecting to Phoenix Cloud
        // headers: { "api_key": process.env.PHOENIX_API_KEY },
        // (optional) if connecting to self-hosted Phoenix with Authentication enabled
        // headers: { "Authorization": `Bearer ${process.env.PHOENIX_API_KEY}` }
      })
    ),
  ],
});

provider.register();
```

Now, import this file at the top of your main program entrypoint, or invoke it with the node cli's `require`flag:

* Import Method:
  * In main.ts or similar: `import "./instrumentation.ts"`
  * In your CLI, script, Dockerfile, etc: `node main.ts`
* \--require Method:
  * In your CLI, script, Dockerfile, etc: `node --require ./instrumentation.ts main.ts`
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
### Start Your Application

Now that you have set up tracing & your project in Phoenix, it's time to actually invoke your llm, agent, or application.&#x20;

{% tabs %}
{% tab title="OpenAI (Python)" %}
First add your OpenAI API Key & then invoke the model.&#x20;

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
Phoenix supports a variety of frameworks, model providers, and other integrations. After downloading any of these auto-instrumenters, the next step is to invoke them & see your traces populate in the Phoenix UI.&#x20;

<table data-view="cards"><thead><tr><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td>Anthropic </td><td><a href="https://arize.com/docs/phoenix/integrations/llm-providers/anthropic">https://arize.com/docs/phoenix/integrations/llm-providers/anthropic</a></td></tr><tr><td>Google</td><td><a href="https://arize.com/docs/phoenix/integrations/llm-providers/google-gen-ai">https://arize.com/docs/phoenix/integrations/llm-providers/google-gen-ai</a></td></tr><tr><td>LiteLLM</td><td><a href="https://arize.com/docs/phoenix/integrations/llm-providers/litellm">https://arize.com/docs/phoenix/integrations/llm-providers/litellm</a></td></tr><tr><td>CrewAI</td><td><a href="https://arize.com/docs/phoenix/integrations/python/crewai">https://arize.com/docs/phoenix/integrations/python/crewai</a></td></tr><tr><td>DSPy</td><td><a href="https://arize.com/docs/phoenix/integrations/python/dspy">https://arize.com/docs/phoenix/integrations/python/dspy</a></td></tr><tr><td>Mastra</td><td><a href="https://arize.com/docs/phoenix/integrations/typescript/mastra">https://arize.com/docs/phoenix/integrations/typescript/mastra</a></td></tr></tbody></table>

{% hint style="success" %}
Check out our [Integrations page](https://arize.com/docs/phoenix/integrations) for all Integrations&#x20;
{% endhint %}
{% endtab %}

{% tab title="Manual " %}
After setting up all your functions to be traced using OpenInference/OpenTelemetry, now just call your application to start & you should be able to see your traces populate in the Phoenix UI.&#x20;
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
### View your Traces in Phoenix

You should now see traces in Phoenix!

<figure><img src="../.gitbook/assets/Screenshot 2024-10-29 at 2.51.24 PM.png" alt=""><figcaption></figcaption></figure>
{% endstep %}
{% endstepper %}

### Learn More:

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td>Tracing Concepts </td><td><a href="../tracing/concepts-tracing/">concepts-tracing</a></td></tr><tr><td>Tracing in Phoenix </td><td><a href="../tracing/llm-traces/">llm-traces</a></td></tr></tbody></table>

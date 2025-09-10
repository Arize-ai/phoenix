# Quickstart: Tracing (TS)

## Overview

Phoenix supports two main options to collect traces:

1. Use [automatic instrumentation](https://arize.com/docs/phoenix/integrations) to capture all calls made to supported frameworks.
2. Use [base OpenTelemetry ](../how-to-tracing/setup-tracing/custom-spans.md)instrumentation. Supported in [Python](../how-to-tracing/setup-tracing/custom-spans.md) and [TS / JS](../how-to-tracing/setup-tracing/javascript.md), among many other languages.

## Launch Phoenix

{% include "../../.gitbook/includes/launch-phoenix-ts.md" %}

## Connect to Phoenix <a href="#connect-your-app" id="connect-your-app"></a>

To collect traces from your application, you must configure an OpenTelemetry TracerProvider to send traces to Phoenix.

```bash
# npm, pnpm, yarn, etc
npm install @arizeai/openinference-semantic-conventions @opentelemetry/semantic-conventions @opentelemetry/api @opentelemetry/instrumentation @opentelemetry/resources @opentelemetry/sdk-trace-base @opentelemetry/sdk-trace-node @opentelemetry/exporter-trace-otlp-proto
```

In a new file called `instrumentation.ts` (or .js if applicable)

<pre class="language-typescript"><code class="lang-typescript"><strong>// instrumentation.ts
</strong><strong>import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
</strong>import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
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
</code></pre>

{% hint style="warning" %}
Remember to add your environment variables to your shell environment before running this sample! Uncomment one of the authorization headers above if you plan to connect to an authenticated Phoenix instance.
{% endhint %}

Now, import this file at the top of your main program entrypoint, or invoke it with the node cli's `require`flag:

{% tabs %}
{% tab title="Import Method" %}
<pre class="language-typescript"><code class="lang-typescript"><strong>// main.ts or similar
</strong>import "./instrumentation.ts"
</code></pre>

```sh
# in your cli, script, Dockerfile, etc
node main.ts
```
{% endtab %}

{% tab title="--require Method" %}
<pre class="language-sh"><code class="lang-sh"><strong># in your cli, script, Dockerfile, etc
</strong>node --require ./instrumentation.ts main.ts
</code></pre>
{% endtab %}
{% endtabs %}

{% hint style="info" %}
Starting with Node v22, Node can [natively execute TypeScript files](https://nodejs.org/en/learn/typescript/run-natively#running-typescript-natively). If this is not supported in your runtime, ensure that you can compile your TypeScript files to JavaScript, or use JavaScript instead.
{% endhint %}

Our program is now ready to trace calls made by an llm library, but it will not do anything just yet. Let's choose an instrumentation library to collect our traces, and register it with our Provider.

## Trace all calls made to a library

Phoenix can capture all calls made to supported libraries automatically. Just install the [respective OpenInference library](broken-reference):

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

Finally, in your app code, invoke OpenAI:

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

## View your Traces in Phoenix

You should now see traces in Phoenix!

<figure><img src="../../.gitbook/assets/Screenshot 2024-10-29 at 2.51.24 PM.png" alt=""><figcaption></figcaption></figure>

## Next Steps

* Explore tracing [integrations](https://arize.com/docs/phoenix/integrations)
* [Customize tracing](../how-to-tracing/)
* View use cases to see [end-to-end examples](https://arize.com/docs/phoenix/cookbook/guide)

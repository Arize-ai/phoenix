# Vercel AI SDK Tracing (JS)

## OpenInference Vercel

[![npm version](https://badge.fury.io/js/@arizeai%2Fopeninference-vercel.svg)](https://badge.fury.io/js/@arizeai%2Fopeninference-vercel)

This package provides a set of utilities to ingest [Vercel AI SDK](https://github.com/vercel/ai)(>= 3.3) spans into platforms like [Arize](https://arize.com/) and [Phoenix](https://phoenix.arize.com/).

> Note: This package requires you to be using the Vercel AI SDK version 3.3 or higher.

### Installation

```shell
npm i --save @arizeai/openinference-vercel
```

You will also need to install OpenTelemetry packages into your project.

```shell
npm i --save @arizeai/openinference-semantic-conventions @opentelemetry/api @opentelemetry/exporter-trace-otlp-proto @opentelemetry/resources @opentelemetry/sdk-trace-node @opentelemetry/semantic-conventions
```

### Usage

`@arizeai/openinference-vercel` provides a set of utilities to help you ingest Vercel AI SDK spans into OpenTelemetry compatible platforms and works in conjunction with Vercel's AI SDK OpenTelemetry support. `@arizeai/openinference-vercel` works with typical node projects, as well as Next.js projects. This page will describe usage within a node project, for detailed usage instructions in Next.js follow Vercel's [guide on instrumenting Next.js](https://nextjs.org/docs/app/guides/open-telemetry#manual-opentelemetry-configuration).

To process your Vercel AI SDK Spans, setup a typical OpenTelemetry instrumentation boilerplate file, add a `OpenInferenceSimpleSpanProcessor` or `OpenInferenceBatchSpanProcessor` to your OpenTelemetry configuration.

> Note: The `OpenInferenceSpanProcessor` alone does not handle the exporting of spans so you will need to pass it an [exporter](https://opentelemetry.io/docs/languages/js/exporters/) as a parameter.

Here are two example instrumentation configurations:

1. Manual instrumentation config for a Node v23+ application.
2. Next.js register function utilizing `@vercel/otel` .

{% tabs %}
{% tab title="Manual Instrumentation" %}
```typescript
// instrumentation.ts
// Node environment instrumentation
// Boilerplate imports
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
// OpenInference Vercel imports
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { OpenInferenceSimpleSpanProcessor } from "@arizeai/openinference-vercel";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

// e.g. http://localhost:6006
// e.g. https://app.phoenix.arize.com/s/<your-space>
const COLLECTOR_ENDPOINT = process.env.PHOENIX_COLLECTOR_ENDPOINT;
// The project name that may appear in your collector's interface
const SERVICE_NAME = "phoenix-vercel-ai-sdk-app";

export const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [SEMRESATTRS_PROJECT_NAME]: SERVICE_NAME,
  }),
  spanProcessors: [
    // In production-like environments it is recommended to use 
    // OpenInferenceBatchSpanProcessor instead
    new OpenInferenceSimpleSpanProcessor({
      exporter: new OTLPTraceExporter({
        url: `${COLLECTOR_ENDPOINT}/v1/traces`,
        // (optional) if connecting to a collector with Authentication enabled
        headers: { Authorization: `Bearer ${process.env.PHOENIX_API_KEY}` },
      }),
    }),
  ],
});

provider.register();

console.log("Provider registered");

// Run this file before the rest of program execution
// e.g node --import ./instrumentation.ts index.ts
// or at the top of your application's entrypoint
// e.g. import "instrumentation.ts"; 
```
{% endtab %}

{% tab title="@vercel/otel" %}
```typescript
// instrumentation.ts
// Vercel / Next.js environment instrumentation
import { registerOTel, OTLPHttpProtoTraceExporter } from "@vercel/otel";
import {
  isOpenInferenceSpan,
  OpenInferenceSimpleSpanProcessor,
} from "@arizeai/openinference-vercel";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

// e.g. http://localhost:6006
// e.g. https://app.phoenix.arize.com/s/<your-space>
const COLLECTOR_ENDPOINT = process.env.PHOENIX_COLLECTOR_ENDPOINT;
// The project name that may appear in your collector's interface
const SERVICE_NAME = "phoenix-vercel-ai-sdk-app";

/**
 * Register function used by Next.js to instantiate instrumentation
 * correctly in all environments that Next.js can be deployed to
 */
export function register() {
  registerOTel({
    serviceName: SERVICE_NAME,
    attributes: {
      [SEMRESATTRS_PROJECT_NAME]: SERVICE_NAME,
    },
    spanProcessors: [
      new OpenInferenceSimpleSpanProcessor({
        exporter: new OTLPHttpProtoTraceExporter({
          url: `${COLLECTOR_ENDPOINT}/v1/traces`,
        }),
        spanFilter: isOpenInferenceSpan,
      }),
    ],
  });
  console.log("Provider registered");
}
```

See Vercel's [instrumentation guide](https://nextjs.org/docs/app/guides/open-telemetry#using-vercelotel) for more details on configuring your instrumentation file and `@vercel/otel` within a Next.js project
{% endtab %}
{% endtabs %}

{% hint style="info" %}
When instrumenting a Next.js application, traced spans will not be "root spans" when the OpenInference span filter is configured. This is because Next.js parents spans underneath http requests, which do not meet the requirements to be an OpenInference span.
{% endhint %}

Now enable telemetry in your AI SDK calls by setting the `experimental_telemetry` parameter to `true`.

```typescript
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "Write a short story about a cat.",
  experimental_telemetry: { isEnabled: true },
});
```

{% hint style="warning" %}
Ensure your installed version of `@opentelemetry/api` matches the version installed by `ai` otherwise the ai sdk will not emit traces to the TracerProvider that you configure. If you install `ai` before other the packages, then dependency resolution in your package manager should install the correct version.
{% endhint %}

For details on Vercel AI SDK telemetry see the [Vercel AI SDK Telemetry documentation](https://sdk.vercel.ai/docs/ai-sdk-core/telemetry).

{% embed url="https://www.youtube.com/watch?v=0y45dYpNNw0" %}

### Examples

To see an example go to the [Next.js OpenAI Telemetry Example](https://github.com/Arize-ai/openinference/tree/main/js/examples/next-openai-telemetry-app) in the [OpenInference repo](https://github.com/Arize-ai/openinference/tree/main/js).

For more information on Vercel OpenTelemetry support see the [Vercel AI SDK Telemetry documentation](https://sdk.vercel.ai/docs/ai-sdk-core/telemetry).

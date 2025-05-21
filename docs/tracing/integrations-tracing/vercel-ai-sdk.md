---
hidden: true
---

# Vercel AI SDK

## OpenInference Vercel

[![npm version](https://badge.fury.io/js/@arizeai%2Fopeninference-vercel.svg)](https://badge.fury.io/js/@arizeai%2Fopeninference-vercel)

This package provides a set of utilities to ingest [Vercel AI SDK](https://github.com/vercel/ai)(>= 3.3) spans into platforms like [Arize](https://arize.com/) and [Phoenix](https://phoenix.arize.com/).

> Note: This package requires you to be using the Vercel AI SDK version 3.3 or higher.

### Installation

```shell
npm install --save @arizeai/openinference-vercel
```

You will also need to install OpenTelemetry and Vercel packages to your project.

```shell
npm i @opentelemetry/api @vercel/otel @opentelemetry/exporter-trace-otlp-proto @arizeai/openinference-semantic-conventions
```

### Usage

`@arizeai/openinference-vercel` provides a set of utilities to help you ingest Vercel AI SDK spans into platforms and works in conjunction with Vercel's OpenTelemetry support. To get started, you will need to add OpenTelemetry support to your Vercel project according to their [guide](https://vercel.com/docs/observability/otel-overview).

To process your Vercel AI SDK Spans add a `OpenInferenceSimpleSpanProcessor` or `OpenInferenceBatchSpanProcessor` to your OpenTelemetry configuration.

> Note: The `OpenInferenceSpanProcessor` does not handle the exporting of spans so you will need to pass it an [exporter](https://opentelemetry.io/docs/languages/js/exporters/) as a parameter.

```typescript
import { registerOTel } from "@vercel/otel";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import {
  isOpenInferenceSpan,
  OpenInferenceSimpleSpanProcessor,
} from "@arizeai/openinference-vercel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
// This is not required and should not be added in a production setting
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

export function register() {
  registerOTel({
    serviceName: "phoenix-next-app",
    attributes: {
      // This is not required but it will allow you to send traces to a specific 
      // project in phoenix
      [SEMRESATTRS_PROJECT_NAME]: "your-next-app",
    },
    spanProcessors: [
      new OpenInferenceSimpleSpanProcessor({
        exporter: new OTLPTraceExporter({
          headers: {
            // API key if you're sending it to Phoenix
            api_key: process.env["PHOENIX_API_KEY"],
          },
          url:
            process.env["PHOENIX_COLLECTOR_ENDPOINT"] ||
            "https://app.phoenix.arize.com/v1/traces",
        }),
        spanFilter: (span) => {
          // Only export spans that are OpenInference to remove non-generative spans
          // This should be removed if you want to export all spans
          return isOpenInferenceSpan(span);
        },
      }),
    ],
  });
}
```

Now enable telemetry in your AI SDK calls by setting the `experimental_telemetry` parameter to `true`.

```typescript
const result = await generateText({
  model: openai("gpt-4-turbo"),
  prompt: "Write a short story about a cat.",
  experimental_telemetry: { isEnabled: true },
});
```

For details on Vercel AI SDK telemetry see the [Vercel AI SDK Telemetry documentation](https://sdk.vercel.ai/docs/ai-sdk-core/telemetry).

{% embed url="https://www.youtube.com/watch?v=0y45dYpNNw0" %}

### Examples

To see an example go to the [Next.js OpenAI Telemetry Example](https://github.com/Arize-ai/openinference/tree/main/js/examples/next-openai-telemetry-app) in the [OpenInference repo](https://github.com/Arize-ai/openinference/tree/main/js).

For more information on Vercel OpenTelemetry support see the [Vercel AI SDK Telemetry documentation](https://sdk.vercel.ai/docs/ai-sdk-core/telemetry).

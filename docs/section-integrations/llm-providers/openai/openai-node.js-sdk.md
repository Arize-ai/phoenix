# OpenAI Node.js SDK&#x20;

This module provides automatic instrumentation for the [OpenAI Node.js SDK](https://github.com/openai/openai-node). which may be used in conjunction with [@opentelemetry/sdk-trace-node](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-node).

## Install

```bash
npm install --save @arizeai/openinference-instrumentation-openai
```

## Setup

To load the OpenAI instrumentation, specify it in the registerInstrumentations call along with any additional instrumentation you wish to enable.

```typescript
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
  OpenAIInstrumentation,
} from "@arizeai/openinference-instrumentation-openai";
import { registerInstrumentations } from "@opentelemetry/instrumentation";

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [new OpenAIInstrumentation()],
});
```

## Support

Instrumentation version >1.0.0 supports both attribute masking and context attribute propagation to spans.

## Resources

* [Example project](https://github.com/Arize-ai/openinference/tree/main/js/examples/openai)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/js/packages/openinference-instrumentation-openai)
* [Working examples](https://github.com/Arize-ai/openinference/blob/main/js/examples/openai)

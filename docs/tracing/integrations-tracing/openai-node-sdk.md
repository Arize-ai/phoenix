# OpenAI Node SDK

[![npm version](https://camo.githubusercontent.com/247eac665eb001f3f0acefb5f56b3e607c4143b633b553d452dac4aa3795a90a/68747470733a2f2f62616467652e667572792e696f2f6a732f406172697a6561692532466f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6f70656e61692e737667)](https://badge.fury.io/js/@arizeai%2Fopeninference-instrumentation-openai)

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

Instrumentation version >1.0.0 supports both [attribute masking](../how-to-tracing/customize-spans/masking-span-attributes.md) and [context attribute propagation](../how-to-tracing/customize-spans/) to spans.

## Resources

* [Example project](https://github.com/Arize-ai/openinference/tree/main/js/examples/openai)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/js/packages/openinference-instrumentation-openai)
* [Working examples](https://github.com/Arize-ai/openinference/blob/main/js/examples/openai)

# LangChain.js

[![](https://badge.fury.io/js/@arizeai%2Fopeninference-instrumentation-langchain.svg)](https://www.npmjs.com/package/@arizeai/openinference-instrumentation-langchain)

This module provides automatic instrumentation for LangChain.js, more specifically, the @langchain/core module. which may be used in conjunction with @opentelemetry/sdk-trace-node.

## Install

```bash
npm install --save @arizeai/openinference-instrumentation-langchain
```

## Setup

To load the LangChain instrumentation, manually instrument the `@langchain/core/callbacks/manager` module. The callbacks manager must be manually instrumented due to the non-traditional module structure in `@langchain/core`. Additional instrumentations can be registered as usual in the registerInstrumentations function.

```typescript
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { 
  LangChainInstrumentation 
} from "@arizeai/openinference-instrumentation-langchain";
import * as CallbackManagerModule from "@langchain/core/callbacks/manager";

const provider = new NodeTracerProvider();
provider.register();

const lcInstrumentation = new LangChainInstrumentation();
// LangChain must be manually instrumented as it doesn't have 
// a traditional module structure
lcInstrumentation.manuallyInstrument(CallbackManagerModule);

```

## Support

Instrumentation version >1.0.0 supports both attribute masking and context attribute propagation to spans.

<table data-full-width="false"><thead><tr><th width="226">Instrumentation Version</th><th width="177" align="center">LangChain ^0.3.0</th><th width="181" align="center">LangChain ^0.2.0</th><th align="center">LangChain ^0.1.0</th></tr></thead><tbody><tr><td>>1.0.0</td><td align="center">✅</td><td align="center">✅</td><td align="center">✅</td></tr><tr><td>>0.2.0</td><td align="center">❌</td><td align="center">✅</td><td align="center">✅</td></tr><tr><td>>0.1.0</td><td align="center">❌</td><td align="center">❌</td><td align="center">✅</td></tr></tbody></table>

## Custom Tracer Provider

You can specify a custom tracer provider for LangChain instrumentation in multiple ways:

### Method 1: Pass tracerProvider on instantiation

```typescript
const lcInstrumentation = new LangChainInstrumentation({
  tracerProvider: customTracerProvider,
});
lcInstrumentation.manuallyInstrument(CallbackManagerModule);
```

### Method 2: Set tracerProvider after instantiation

```typescript
const lcInstrumentation = new LangChainInstrumentation();
lcInstrumentation.setTracerProvider(customTracerProvider);
lcInstrumentation.manuallyInstrument(CallbackManagerModule);
```

### Method 3: Pass tracerProvider to registerInstrumentations

```typescript
const lcInstrumentation = new LangChainInstrumentation();
lcInstrumentation.manuallyInstrument(CallbackManagerModule);

registerInstrumentations({
  instrumentations: [lcInstrumentation],
  tracerProvider: customTracerProvider,
});
```

## Resources

* [Example project](https://github.com/Arize-ai/openinference/blob/main/js/packages/openinference-instrumentation-langchain/examples)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/js/packages/openinference-instrumentation-langchain)

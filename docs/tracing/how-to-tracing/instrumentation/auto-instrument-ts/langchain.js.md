# LangChain.js

[![](https://badge.fury.io/js/@arizeai%2Fopeninference-instrumentation-langchain.svg)](https://www.npmjs.com/package/@arizeai/openinference-instrumentation-langchain)

This module provides automatic instrumentation for LangChain.js, more specifically, the @langchain/core module. which may be used in conjunction with @opentelemetry/sdk-trace-node.

## Installation

```bash
npm install --save @arizeai/openinference-instrumentation-langchain
```

## Usage

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

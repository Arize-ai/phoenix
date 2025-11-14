# LangChain.js

[![](https://badge.fury.io/js/@arizeai%2Fopeninference-instrumentation-langchain.svg)](https://www.npmjs.com/package/@arizeai/openinference-instrumentation-langchain)

This module provides automatic instrumentation for LangChain.js, more specifically, the @langchain/core module. which may be used in conjunction with @opentelemetry/sdk-trace-node.

## Install

```bash
npm install --save @arizeai/openinference-instrumentation-langchain \
  @arizeai/phoenix-otel
```

## Setup

To load the LangChain instrumentation, manually instrument the `@langchain/core/callbacks/manager` module. The callbacks manager must be manually instrumented due to the non-traditional module structure in `@langchain/core`.

```typescript
import { register } from "@arizeai/phoenix-otel";
import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import * as CallbackManagerModule from "@langchain/core/callbacks/manager";

const provider = register({
  projectName: "langchain-app",
});

const lcInstrumentation = new LangChainInstrumentation();
// LangChain must be manually instrumented as it doesn't have 
// a traditional module structure
lcInstrumentation.manuallyInstrument(CallbackManagerModule);
```

Once instrumentation is setup, your agent will automatically export traces to Phoenix.

```typescript
import * as z from "zod";
// npm install @langchain/anthropic to call the model
import { createAgent, tool } from "langchain";

const getWeather = tool(
  ({ city }) => `It's always sunny in ${city}!`,
  {
    name: "get_weather",
    description: "Get the weather for a given city",
    schema: z.object({
      city: z.string(),
    }),
  },
);

const agent = createAgent({
  model: "claude-sonnet-4-5-20250929",
  tools: [getWeather],
});

console.log(
  await agent.invoke({
    messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
  })
);
```

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/langgraphjs.png" alt=""><figcaption></figcaption></figure>

## Support

Instrumentation version >=4.0.0 supports LangChain 1.0 and above.This package does support earlier versions of LangChain, however it is not tested.

If you are still using older versions, The [`@arizeai/openinference-instrumentation-langchain-v0`](https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-langchain-v0) package is used to maintain support for LangChain 0.X versions and will recieve patches for the older versions.

## Resources

* [Example project](https://github.com/Arize-ai/openinference/blob/main/js/packages/openinference-instrumentation-langchain/examples)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/js/packages/openinference-instrumentation-langchain)

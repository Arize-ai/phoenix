# Auto Instrument: TS

Phoenix natively supports collecting traces generated via OpenInference automatic instrumentation. The supported instrumentations are

<table><thead><tr><th>Library</th><th width="228">Instrumentation</th><th>Version</th></tr></thead><tbody><tr><td>OpenAI</td><td><code>@arizeai/openinference-instrumentation-openai</code></td><td><a href="https://www.npmjs.com/package/@arizeai/openinference-instrumentation-openai"><img src="https://camo.githubusercontent.com/e8d7d683994696e16d7620368f72a71929485bbfaad93848edfa813f631d53e2/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f406172697a6561692f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6f70656e6169" alt="NPM Version"></a></td></tr><tr><td>LangChainJS</td><td><code>@arizeai/openinference-instrumentation-langchain</code></td><td><a href="https://www.npmjs.com/package/@arizeai/openinference-instrumentation-langchain"><img src="../../../../.gitbook/assets/langchain-npm-version.png" alt=""></a></td></tr></tbody></table>

OpenInference JS is fully open-source and maintained on [GitHub](https://github.com/Arize-ai/openinference/tree/main/js)

## Installation



OpenInference uses OpenTelemetry Protocol (OTLP) to send traces Phoenix. To use OpenInference, you will need to install the OpenTelemetry SDK and the OpenInference instrumentation for the LLM framework you are using.

Install the OpenTelemetry SDK:

```bash
npm install --save @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-trace-otlp-proto @opentelemetry/resources @opentelemetry/sdk-trace-node
```

Install the OpenInference instrumentation you would like to use:

```bash
npm install --save @arizeai/openinference-instrumentation-openai
```

If you plan on manually instrumenting your application, you will also need to install the OpenInference Semantic Conventions:

```bash
npm install --save @arizeai/openinference-semantic-conventions
```

{% hint style="info" %}
This example instruments OpenAI but you can replace `@arizeai/openinference-instrumentation-openai` with the instrumentation(s) of your choosing.
{% endhint %}



## Usage

To load the OpenAI instrumentation, specify it in the registerInstrumentations call along with any additional instrumentation you wish to enable.

```typescript
const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
const {
  OpenAIInstrumentation,
} = require("@arizeai/openinference-instrumentation-openai");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [new OpenAIInstrumentation()],
});
```

For more information on OpenTelemetry Node.js SDK, see the [OpenTelemetry Node.js SDK documentation](https://opentelemetry.io/docs/instrumentation/js/getting-started/nodejs/).

{% hint style="warning" %}
Note the above instrumentation must run before any other code in your application. This is because the instrumentation will only capture spans for the code that runs after the instrumentation is loaded. Typically this is done by requiring the instrumentation when running your application. `node -r ./path/to/instrumentation.js ./path/to/your/app.js`
{% endhint %}



\

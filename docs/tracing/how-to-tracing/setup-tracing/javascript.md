# Setup Tracing (TS)

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/nodejs_deployment.png" alt=""><figcaption><p>You can trace your NodeJS application over OpenTelemetry</p></figcaption></figure>

Phoenix is written and maintained in Python to make it natively runnable in Python notebooks. However, it can be stood up as a trace collector so that your LLM traces from your NodeJS application (e.g., LlamaIndex.TS, Langchain.js) can be collected. The traces collected by Phoenix can then be downloaded to a Jupyter notebook and used to run evaluations (e.g., [LLM Evals](../feedback-and-annotations/llm-evaluations.md), Ragas).

## Getting Started

Instrumentation is the act of adding observability code to an app yourself.

If you’re instrumenting an app, you need to use the OpenTelemetry SDK for your language. You’ll then use the SDK to initialize OpenTelemetry and the API to instrument your code. This will emit telemetry from your app, and any library you installed that also comes with instrumentation.

Phoenix natively supports automatic instrumentation provided by OpenInference. For more details on OpenInference, checkout the [project](https://github.com/Arize-ai/openinference) on GitHub.

Now lets walk through instrumenting, and then tracing, a sample express application.

### instrumentation setup <a href="#example-app" id="example-app"></a>

#### Dependencies <a href="#dependencies" id="dependencies"></a>

Install OpenTelemetry API packages:

```shell
# npm, pnpm, yarn, etc
npm install @opentelemetry/semantic-conventions @opentelemetry/api @opentelemetry/instrumentation @opentelemetry/resources @opentelemetry/sdk-trace-base @opentelemetry/sdk-trace-node @opentelemetry/exporter-trace-otlp-proto
```

Install OpenInference instrumentation packages. Below is an example of adding instrumentation for OpenAI as well as the semantic conventions for OpenInference.

<pre class="language-bash"><code class="lang-bash"># npm, pnpm, yarn, etc
<strong>npm install openai @arizeai/openinference-instrumentation-openai @arizeai/openinference-semantic-conventions
</strong></code></pre>

### Traces <a href="#traces" id="traces"></a>

#### Initialize Tracing <a href="#initialize-tracing" id="initialize-tracing"></a>

To enable [tracing](https://opentelemetry.io/docs/concepts/signals/traces/) in your app, you’ll need to have an initialized [`TracerProvider`](https://opentelemetry.io/docs/concepts/signals/traces/#tracer-provider).

If a `TracerProvider` is not created, the OpenTelemetry APIs for tracing will use a no-op implementation and fail to generate data. As explained next, create an `instrumentation.ts` (or `instrumentation.js`) file to include all of the provider initialization code in Node.

**Node.js**

Create `instrumentation.ts` (or `instrumentation.js`) to contain all the provider initialization code:

```ts
// instrumentation.ts
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import OpenAI from "openai";

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const tracerProvider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "openai-service",
    // Project name in Phoenix, defaults to "default"
    [SEMRESATTRS_PROJECT_NAME]: "openai-service",
  }),
  spanProcessors: [
    // BatchSpanProcessor will flush spans in batches after some time,
    // this is recommended in production. For development or testing purposes
    // you may try SimpleSpanProcessor for instant span flushing to the Phoenix UI.
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: `http://localhost:6006/v1/traces`,
        // (optional) if connecting to Phoenix Cloud
        // headers: { "api_key": process.env.PHOENIX_API_KEY },
        // (optional) if connecting to self-hosted Phoenix with Authentication enabled
        // headers: { "Authorization": `Bearer ${process.env.PHOENIX_API_KEY}` }
      })
    ),
  ],
});
tracerProvider.register();

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({
  instrumentations: [instrumentation],
});

console.log("👀 OpenInference initialized");
```

This basic setup has will instrument chat completions via native calls to the OpenAI client.

As shown above with OpenAI, you can register additional instrumentation libraries with the OpenTelemetry provider in order to generate telemetry data for your dependencies. For more information, see [Integrations](broken-reference).

**Picking the right span processor**

In our `instrumentation.ts` file above, we use the `BatchSpanProcessor`. The `BatchSpanProcessor` processes spans in batches before they are exported. This is usually the right processor to use for an application.

In contrast, the `SimpleSpanProcessor` processes spans as they are created. This means that if you create 5 spans, each will be processed and exported before the next span is created in code. This can be helpful in scenarios where you do not want to risk losing a batch, or if you’re experimenting with OpenTelemetry in development. However, it also comes with potentially significant overhead, especially if spans are being exported over a network - each time a call to create a span is made, it would be processed and sent over a network before your app’s execution could continue.

In most cases, stick with `BatchSpanProcessor` over `SimpleSpanProcessor`.

**Tracing instrumented libraries**

Now that you have configured a tracer provider, and instrumented the `openai` package, lets see how we can generate traces for a sample application.

{% hint style="info" %}
The following code assumes you have Phoenix running locally, on its default port of 6006. See our [Quickstart: Tracing (TS)](../../llm-traces-1/quickstart-tracing-ts.md) documentation if you'd like to learn more about running Phoenix.
{% endhint %}

First, install the dependencies required for our sample app.

```sh
# npm, pnpm, yarn, etc
npm install express
```

Next, create an `app.ts` (or `app.js` ) file, that hosts a simple express server for executing OpenAI chat completions.

```typescript
// app.ts
import express from "express";
import OpenAI from "openai";

const PORT: number = parseInt(process.env.PORT || "8080");
const app = express();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/chat", async (req, res) => {
  const message = req.query.message;
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: "user", content: message }],
    model: "gpt-4o",
  });
  res.send(chatCompletion.choices[0].message.content);
});

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
```

Then, we will start our application, loading the `instrumentation.ts` file before `app.ts` so that our instrumentation code can instrument `openai` .&#x20;

<pre class="language-sh"><code class="lang-sh"># node v23
<strong>node --require ./instrumentation.ts app.ts
</strong></code></pre>

{% hint style="info" %}
We are using Node v23 above as this allows us to execute TypeScript code without a transpilation step. OpenTelemetry and OpenInference support Node versions from v18 onwards, and we are flexible with projects configured using CommonJS or ESM module syntaxes.

Learn more by visiting the Node.js documentation on [TypeScript](https://nodejs.org/en/learn/typescript/run-natively#running-typescript-natively) and [ESM](https://nodejs.org/api/esm.html) or see our [Quickstart: Tracing (TS)](../../llm-traces-1/quickstart-tracing-ts.md) documentation for an end to end example.
{% endhint %}

Finally, we can execute a request against our server

```sh
curl "http://localhost:8080/chat?message=write%20me%20a%20haiku"
```

After a few moments, a new project `openai-service`  will appear in the Phoenix UI, along with the trace generated by our OpenAI chat completion!

### Advanced: Manually Tracing

#### Acquiring a tracer <a href="#acquiring-a-tracer" id="acquiring-a-tracer"></a>

Anywhere in your application where you write manual tracing code should call `getTracer` to acquire a tracer. For example:

```ts
import opentelemetry from '@opentelemetry/api';
//...

const tracer = opentelemetry.trace.getTracer(
  'instrumentation-scope-name',
  'instrumentation-scope-version',
);

// You can now use a 'tracer' to do tracing!
```

The values of `instrumentation-scope-name` and `instrumentation-scope-version` should uniquely identify the [Instrumentation Scope](https://opentelemetry.io/docs/concepts/instrumentation-scope/), such as the package, module or class name. While the name is required, the version is still recommended despite being optional.

It’s generally recommended to call `getTracer` in your app when you need it rather than exporting the `tracer` instance to the rest of your app. This helps avoid trickier application load issues when other required dependencies are involved.

Below is an example of acquiring a tracer within application scope.

```ts
// app.ts
import { trace } from '@opentelemetry/api';
import express from 'express';
import OpenAI from "openai";

const tracer = trace.getTracer('llm-server', '0.1.0');

const PORT: number = parseInt(process.env.PORT || "8080");
const app = express();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/chat", async (req, res) => {
  const message = req.query.message;
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: "user", content: message }],
    model: "gpt-4o",
  });
  res.send(chatCompletion.choices[0].message.content);
});

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
```

#### Create spans <a href="#create-spans" id="create-spans"></a>

Now that you have [tracers](https://opentelemetry.io/docs/concepts/signals/traces/#tracer) initialized, you can create [spans](https://opentelemetry.io/docs/concepts/signals/traces/#spans).

The API of OpenTelemetry JavaScript exposes two methods that allow you to create spans:

* [`tracer.startSpan`](https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api.Tracer.html#startSpan): Starts a new span without setting it on context.
* [`tracer.startActiveSpan`](https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api.Tracer.html#startActiveSpan): Starts a new span and calls the given callback function passing it the created span as first argument. The new span gets set in context and this context is activated for the duration of the function call.

In most cases you want to use the latter (`tracer.startActiveSpan`), as it takes care of setting the span and its context active.

The code below illustrates how to create an active span.

```ts
import { trace, Span } from "@opentelemetry/api";
import { SpanKind } from "@opentelemetry/api";
import {
    SemanticConventions,
    OpenInferenceSpanKind,
} from "@arizeai/openinference-semantic-conventions";

export function chat(message: string) {
    // Create a span. A span must be closed.
    return tracer.startActiveSpan(
        "chat",
        (span: Span) => {
            span.setAttributes({
                [SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.chain,
                [SemanticConventions.INPUT_VALUE]: message,
            });
            let chatCompletion = await openai.chat.completions.create({
                messages: [{ role: "user", content: message }],
                model: "gpt-3.5-turbo",
            });
            span.setAttributes({
                attributes: {
                    [SemanticConventions.OUTPUT_VALUE]: chatCompletion.choices[0].message,
                },
            });
            // Be sure to end the span!
            span.end();
            return result;
        }
    );
}
```

The above instrumented code can now be pasted in the `/chat` handler. You should now be able to see spans emitted from your app.

Start your app as follows, and then send it requests by visiting `http://localhost:8080/chat?message="how long is a pencil"` with your browser or `curl`.

```sh
ts-node --require ./instrumentation.ts app.ts
```

After a while, you should see the spans printed in the console by the `ConsoleSpanExporter`, something like this:

```json
{
  "traceId": "6cc927a05e7f573e63f806a2e9bb7da8",
  "parentId": undefined,
  "name": "chat",
  "id": "117d98e8add5dc80",
  "kind": 0,
  "timestamp": 1688386291908349,
  "duration": 501,
  "attributes": {
    "openinference.span.kind": "chain"
    "input.value": "how long is a pencil"
  },
  "status": { "code": 0 },
  "events": [],
  "links": []
}
```

#### Get the current span <a href="#get-the-current-span" id="get-the-current-span"></a>

Sometimes it’s helpful to do something with the current/active [span](https://opentelemetry.io/docs/concepts/signals/traces/#spans) at a particular point in program execution.

```js
const activeSpan = opentelemetry.trace.getActiveSpan();

// do something with the active span, optionally ending it if that is appropriate for your use case.
```

#### Get a span from context <a href="#get-a-span-from-context" id="get-a-span-from-context"></a>

It can also be helpful to get the [span](https://opentelemetry.io/docs/concepts/signals/traces/#spans) from a given context that isn’t necessarily the active span.

```js
const ctx = getContextFromSomewhere();
const span = opentelemetry.trace.getSpan(ctx);

// do something with the acquired span, optionally ending it if that is appropriate for your use case.
```

#### Attributes <a href="#attributes" id="attributes"></a>

[Attributes](https://opentelemetry.io/docs/concepts/signals/traces/#attributes) let you attach key/value pairs to a [`Span`](https://opentelemetry.io/docs/concepts/signals/traces/#spans) so it carries more information about the current operation that it’s tracking. For OpenInference related attributes, use the `@arizeai/openinference-semantic-conventions` keys. However you are free to add any attributes you'd like!

```ts
function chat(message: string, user: User) {
  return tracer.startActiveSpan(`chat:${i}`, (span: Span) => {
    const result = Math.floor(Math.random() * (max - min) + min);

    // Add an attribute to the span
    span.setAttribute('mycompany.userid', user.id);

    span.end();
    return result;
  });
}
```

You can also add attributes to a span as it’s created:

```javascript
tracer.startActiveSpan(
  'app.new-span',
  { attributes: { attribute1: 'value1' } },
  (span) => {
    // do some work...

    span.end();
  },
);
```

```ts
function chat(session: Session) {
  return tracer.startActiveSpan(
    'chat',
    { attributes: { 'mycompany.sessionid': session.id } },
    (span: Span) => {
      /* ... */
    },
  );
}
```

**Semantic Attributes**

There are semantic conventions for spans representing operations in well-known protocols like HTTP or database calls. OpenInference also publishes it's own set of semantic conventions related to LLM applications. Semantic conventions for these spans are defined in the specification under [OpenInference](https://github.com/Arize-ai/openinference/tree/main/spec). In the simple example of this guide the source code attributes can be used.

First add both semantic conventions as a dependency to your application:

```shell
npm install --save @opentelemetry/semantic-conventions @arizeai/openinfernece-semantic-conventions
```

Add the following to the top of your application file:

```ts
import { SemanticAttributes } from 'arizeai/openinfernece-semantic-conventions';
```

Finally, you can update your file to include semantic attributes:

```javascript
const doWork = () => {
  tracer.startActiveSpan('app.doWork', (span) => {
    span.setAttribute(SemanticAttributes.INPUT_VALUE, 'work input');
    // Do some work...

    span.end();
  });
};
```

#### Span events <a href="#span-events" id="span-events"></a>

A [Span Event](https://opentelemetry.io/docs/concepts/signals/traces/#span-events) is a human-readable message on an [`Span`](https://opentelemetry.io/docs/concepts/signals/traces/#spans) that represents a discrete event with no duration that can be tracked by a single timestamp. You can think of it like a primitive log.

```js
span.addEvent('Doing something');

const result = doWork();
```

You can also create Span Events with additional [Attributes](https://opentelemetry.io/docs/concepts/signals/traces/#attributes)

{% hint style="danger" %}
While Phoenix captures these, they are currently not displayed in the UI. Contact us if you would like to support!
{% endhint %}

```js
span.addEvent('some log', {
  'log.severity': 'error',
  'log.message': 'Data not found',
  'request.id': requestId,
});
```

#### Span Status <a href="#span-status" id="span-status"></a>

A [Status](https://opentelemetry.io/docs/concepts/signals/traces/#span-status) can be set on a [Span](https://opentelemetry.io/docs/concepts/signals/traces/#spans), typically used to specify that a Span has not completed successfully - `Error`. By default, all spans are `Unset`, which means a span completed without error. The `Ok` status is reserved for when you need to explicitly mark a span as successful rather than stick with the default of `Unset` (i.e., “without error”).

The status can be set at any time before the span is finished.

```ts
import opentelemetry, { SpanStatusCode } from '@opentelemetry/api';

// ...

tracer.startActiveSpan('app.doWork', (span) => {
  for (let i = 0; i <= Math.floor(Math.random() * 40000000); i += 1) {
    if (i > 10000) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Error',
      });
    }
  }

  span.end();
});
```

#### Recording exceptions <a href="#recording-exceptions" id="recording-exceptions"></a>

It can be a good idea to record exceptions when they happen. It’s recommended to do this in conjunction with setting [span status](https://opentelemetry.io/docs/languages/js/instrumentation/#span-status).

```ts
import opentelemetry, { SpanStatusCode } from '@opentelemetry/api';

// ...

try {
  doWork();
} catch (ex) {
  span.recordException(ex);
  span.setStatus({ code: SpanStatusCode.ERROR });
}
```

#### Using `sdk-trace-base` and manually propagating span context <a href="#using-sdk-trace-base-and-manually-propagating-span-context" id="using-sdk-trace-base-and-manually-propagating-span-context"></a>

In some cases, you may not be able to use either the Node.js SDK nor the Web SDK. The biggest difference, aside from initialization code, is that you’ll have to manually set spans as active in the current context to be able to create nested spans.

**Initializing tracing with `sdk-trace-base`**

Initializing tracing is similar to how you’d do it with Node.js or the Web SDK.

```ts
import opentelemetry from '@opentelemetry/api';
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-base';

const provider = new BasicTracerProvider();

// Configure span processor to send spans to the exporter
provider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()));
provider.register();

// This is what we'll access in all instrumentation code
const tracer = opentelemetry.trace.getTracer('example-basic-tracer-node');
```

Like the other examples in this document, this exports a tracer you can use throughout the app.

**Creating nested spans with `sdk-trace-base`**

To create nested spans, you need to set whatever the currently-created span is as the active span in the current context. Don’t bother using `startActiveSpan` because it won’t do this for you.

```javascript
const mainWork = () => {
  const parentSpan = tracer.startSpan('main');

  for (let i = 0; i < 3; i += 1) {
    doWork(parentSpan, i);
  }

  // Be sure to end the parent span!
  parentSpan.end();
};

const doWork = (parent, i) => {
  // To create a child span, we need to mark the current (parent) span as the active span
  // in the context, then use the resulting context to create a child span.
  const ctx = opentelemetry.trace.setSpan(
    opentelemetry.context.active(),
    parent,
  );
  const span = tracer.startSpan(`doWork:${i}`, undefined, ctx);

  // simulate some random work.
  for (let i = 0; i <= Math.floor(Math.random() * 40000000); i += 1) {
    // empty
  }

  // Make sure to end this child span! If you don't,
  // it will continue to track work beyond 'doWork'!
  span.end();
};
```

All other APIs behave the same when you use `sdk-trace-base` compared with the Node.js SDKs.

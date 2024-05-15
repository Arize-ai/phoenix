---
description: >-
  While Phoenix is heavily a Python-based Observability and Evaluation
  framework, it supports other languages like TypeScript / JavaScript
---

# Instrument: TS

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/nodejs_deployment.png" alt=""><figcaption><p>You can trace your NodeJS application over OpenTelemetry</p></figcaption></figure>

Phoenix is written and maintained in Python to make it natively runnable in Python notebooks. However it can be stood up as as a trace collector so that your LLM traces from your NodeJS application (e.x. LlamaIndex.TS, Langchain.js). The traces collected by the phoenix can them be downloaded from the Phoenix can them be downloaded to a Jupyter notebook and them be used to run evaluations (e.x. [LLM Evals,](../llm-evaluations.md) Ragas)



## Getting Started

[Instrumentation](../instrumentation/) is the act of adding observability code to an app yourself.

If you’re instrumenting an app, you need to use the OpenTelemetry SDK for your language. You’ll then use the SDK to initialize OpenTelemetry and the API to instrument your code. This will emit telemetry from your app, and any library you installed that also comes with instrumentation.

Phoenix natively supports automatic instrumentation provided by OpenInference. For more details on OpenInfernce, checkout the [project](https://github.com/Arize-ai/openinference)

### instrumentation setup <a href="#example-app" id="example-app"></a>

#### Dependencies <a href="#dependencies" id="dependencies"></a>

Install OpenTelemetry API packages:

```shell
npm install @opentelemetry/api @opentelemetry/resources @opentelemetry/semantic-conventions
```

Install OpenInference instrumentation packages. Below is an example of adding instrumentation for OpenAI as well as the semantic conventions for OpenInference.

<pre class="language-bash"><code class="lang-bash"><strong>npm install @arizeai/openinference-instrumentation-openai @arizeai/openinference-semantic-conventions
</strong></code></pre>

#### Initialize the SDK <a href="#initialize-the-sdk" id="initialize-the-sdk"></a>

If you instrument a Node.js application install the [OpenTelemetry SDK for Node.js](https://www.npmjs.com/package/@opentelemetry/sdk-node):

```shell
npm install @opentelemetry/sdk-node
```

Before any other module in your application is loaded, you must initialize the SDK. If you fail to initialize the SDK or initialize it too late, no-op implementations will be provided to any library that acquires a tracer or meter from the API.

```ts
/*instrumentation.ts*/
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'yourServiceName',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0',
  }),
  traceExporter: new ConsoleSpanExporter(),
});

sdk.start();
```

For debugging and local development purposes, the following example exports telemetry to the console. After you have finished setting up manual instrumentation, you need to configure an appropriate exporter to [export the app’s telemetry data](https://opentelemetry.io/docs/languages/js/exporters/) to to Phoenix (e.g. .

The example also sets up the mandatory SDK default attribute `service.name`, which holds the logical name of the service, and the optional (but highly encouraged!) attribute `service.version`, which holds the version of the service API or implementation.

Alternative methods exist for setting up resource attributes. For more information, see [Resources](https://opentelemetry.io/docs/languages/js/resources/).

To verify your code, run the app by requiring the library:



```sh
npx ts-node --require ./instrumentation.ts app.ts
```

This basic setup has no effect on your app yet. You need to add code for [traces](https://opentelemetry.io/docs/languages/js/instrumentation/#traces), [metrics](https://opentelemetry.io/docs/languages/js/instrumentation/#metrics), and/or [logs](https://opentelemetry.io/docs/languages/js/instrumentation/#logs).

You can register instrumentation libraries with the OpenTelemetry SDK for Node.js in order to generate telemetry data for your dependencies. For more information, see [Libraries](https://opentelemetry.io/docs/languages/js/libraries/).

### Traces <a href="#traces" id="traces"></a>

#### Initialize Tracing <a href="#initialize-tracing" id="initialize-tracing"></a>

To enable [tracing](https://opentelemetry.io/docs/concepts/signals/traces/) in your app, you’ll need to have an initialized [`TracerProvider`](https://opentelemetry.io/docs/concepts/signals/traces/#tracer-provider) that will let you create a [`Tracer`](https://opentelemetry.io/docs/concepts/signals/traces/#tracer).

If a `TracerProvider` is not created, the OpenTelemetry APIs for tracing will use a no-op implementation and fail to generate data. As explained next, modify the `instrumentation.ts` (or `instrumentation.js`) file to include all the SDK initialization code in Node and the browser.

**Node.js**

If you followed the instructions to [initialize the SDK](https://opentelemetry.io/docs/languages/js/instrumentation/#initialize-the-sdk) above, you have a `TracerProvider` setup for you already. You can continue with [acquiring a tracer](https://opentelemetry.io/docs/languages/js/instrumentation/#acquiring-a-tracer).

First, ensure you’ve got the right packages:

```shell
npm install @opentelemetry/sdk-trace-web
```

Next, update `instrumentation.ts` (or `instrumentation.js`) to contain all the SDK initialization code in it:

```ts
/* eslint-disable no-console */
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { Resource } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "openai-service",
  }),
});

provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
provider.addSpanProcessor(
  new SimpleSpanProcessor(
    new OTLPTraceExporter({
      url: "http://localhost:6006/v1/traces",
    }),
  ),
);
provider.register();

registerInstrumentations({
  instrumentations: [new OpenAIInstrumentation({})],
});

console.log("👀 OpenInference initialized");
```

You’ll need to bundle this file with your web application to be able to use tracing throughout the rest of your web application.

This will have no effect on your app yet: you need to [create spans](https://opentelemetry.io/docs/languages/js/instrumentation/#create-spans) to have telemetry emitted by your app.

**Picking the right span processor**

By default, the Node SDK uses the `BatchSpanProcessor`, and this span processor is also chosen in the Web SDK example. The `BatchSpanProcessor` processes spans in batches before they are exported. This is usually the right processor to use for an application.

In contrast, the `SimpleSpanProcessor` processes spans as they are created. This means that if you create 5 spans, each will be processed and exported before the next span is created in code. This can be helpful in scenarios where you do not want to risk losing a batch, or if you’re experimenting with OpenTelemetry in development. However, it also comes with potentially significant overhead, especially if spans are being exported over a network - each time a call to create a span is made, it would be processed and sent over a network before your app’s execution could continue.

In most cases, stick with `BatchSpanProcessor` over `SimpleSpanProcessor`.

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

In the case of the [example app](https://opentelemetry.io/docs/languages/js/instrumentation/#example-app), there are two places where a tracer may be acquired with an appropriate Instrumentation Scope:

First, in the _application file_ `app.ts` (or `app.js`):

```ts
/*app.ts*/
import { trace } from '@opentelemetry/api';
import express, { Express } from 'express';
import { OpenAI } from "openai";

const tracer = trace.getTracer('llm-server', '0.1.0');

const PORT: number = parseInt(process.env.PORT || '8080');
const app: Express = express();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get('/chat', (req, res) => {
  const message = req.query.message
  let chatCompletion = await openai.chat.completions.create({
    messages: [{ role: "user", content: message }],
    model: "gpt-3.5-turbo",
  });
  res.send(chatCompletion.choices[0].message);
});

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
```

#### Create spans <a href="#create-spans" id="create-spans"></a>

Now that you have [tracers](https://opentelemetry.io/docs/concepts/signals/traces/#tracer) initialized, you can create [spans](https://opentelemetry.io/docs/concepts/signals/traces/#spans).

The API of OpenTelemetry JavaScript exposes two methods that allow you to create spans:

* [`tracer.startSpan`](https://open-telemetry.github.io/opentelemetry-js/interfaces/\_opentelemetry\_api.Tracer.html#startSpan): Starts a new span without setting it on context.
* [`tracer.startActiveSpan`](https://open-telemetry.github.io/opentelemetry-js/interfaces/\_opentelemetry\_api.Tracer.html#startActiveSpan): Starts a new span and calls the given callback function passing it the created span as first argument. The new span gets set in context and this context is activated for the duration of the function call.

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

All other APIs behave the same when you use `sdk-trace-base` compared with the Node.js  SDKs.

#### &#x20;<a href="#initialize-metrics" id="initialize-metrics"></a>


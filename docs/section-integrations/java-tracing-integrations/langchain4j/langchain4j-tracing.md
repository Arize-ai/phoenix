---
description: >-
  How to use OpenInference instrumentation with LangChain4j and export traces to
  Arize Phoenix.
---

# LangChain4j Tracing

## Prerequisites

* Java 11 or higher
* (Optional) Phoenix API key if using auth

### Add Dependencies

Add the dependencies to your `build.gradle`:

```groovy
dependencies {
    // OpenInference instrumentation
    implementation project(path: ':instrumentation:openinference-instrumentation-langchain4j')
    
    // LangChain4j
    implementation "dev.langchain4j:langchain4j:${langchain4jVersion}"
    implementation "dev.langchain4j:langchain4j-open-ai:${langchain4jVersion}"
    
    // OpenTelemetry
    implementation "io.opentelemetry:opentelemetry-sdk"
    implementation "io.opentelemetry:opentelemetry-exporter-otlp"
    implementation "io.opentelemetry:opentelemetry-exporter-logging"
}
```

## **Setup Phoenix**

{% tabs %}
{% tab title="Docker" %}
**Pull latest Phoenix image from** [**Docker Hub**](https://hub.docker.com/r/arizephoenix/phoenix)**:**

```bash
docker pull arizephoenix/phoenix:latest
```

**Run your containerized instance:**

```bash
docker run -p 6006:6006 -p 4317:4317 arizephoenix/phoenix:latest
```

This command:

* Exposes port 6006 for the Phoenix web UI
* Exposes port 4317 for the OTLP gRPC endpoint (where traces are sent)

For more info on using Phoenix with Docker, see [Docker](https://arize.com/docs/phoenix/self-hosting/deployment-options/docker).
{% endtab %}

{% tab title="Phoenix Cloud" %}
**Sign up for Phoenix:**

1. Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)
2. Click `Create Space`, then follow the prompts to create and launch your space.

**Set your Phoenix endpoint and API Key:**

From your new Phoenix Space

1. Create your API key from the Settings page
2. Copy your `Hostname` from the Settings page
3. Set your endpoint and API key:

```bash
export PHOENIX_API_KEY = "your-phoenix-api-key"
export PHOENIX_COLLECTOR_ENDPOINT = "your-phoenix-endpoint"
```

{% hint style="info" %}
Having trouble finding your endpoint? Check out [Finding your Phoenix Endpoint](https://arize.com/docs/phoenix/learn/faqs/what-is-my-phoenix-endpoint)
{% endhint %}
{% endtab %}
{% endtabs %}

{% hint style="warning" %}
If you are using Phoenix Cloud, adjust the endpoint in the code below as needed.
{% endhint %}

## **Configuration for Phoenix Tracing**

```java
private static void initializeOpenTelemetry() {
        // Create resource with service name
        Resource resource = Resource.getDefault()
                .merge(Resource.create(Attributes.of(
                        AttributeKey.stringKey("service.name"), "langchain4j",
                        AttributeKey.stringKey(SEMRESATTRS_PROJECT_NAME), "langchain4j-project",
                        AttributeKey.stringKey("service.version"), "0.1.0")));

        String apiKey = System.getenv("PHOENIX_API_KEY");
        OtlpGrpcSpanExporterBuilder otlpExporterBuilder = OtlpGrpcSpanExporter.builder()
                .setEndpoint("http://localhost:4317") # adjust as needed
                .setTimeout(Duration.ofSeconds(2));
        OtlpGrpcSpanExporter otlpExporter = null;
        if (apiKey != null && !apiKey.isEmpty()) {
            otlpExporter = otlpExporterBuilder
                    .setHeaders(() -> Map.of("Authorization", String.format("Bearer %s", apiKey)))
                    .build();
        } else {
            logger.log(Level.WARNING, "Please set PHOENIX_API_KEY environment variable if auth is enabled.");
            otlpExporter = otlpExporterBuilder.build();
        }

        // Create tracer provider with both OTLP (for Phoenix) and console exporters
        tracerProvider = SdkTracerProvider.builder()
                .addSpanProcessor(BatchSpanProcessor.builder(otlpExporter)
                        .setScheduleDelay(Duration.ofSeconds(1))
                        .build())
                .addSpanProcessor(SimpleSpanProcessor.create(LoggingSpanExporter.create()))
                .setResource(resource)
                .build();

        // Build OpenTelemetry SDK
        OpenTelemetrySdk.builder()
                .setTracerProvider(tracerProvider)
                .setPropagators(ContextPropagators.create(W3CTraceContextPropagator.getInstance()))
                .buildAndRegisterGlobal();

        System.out.println("OpenTelemetry initialized. Traces will be sent to Phoenix at http://localhost:6006");
    }
}
```

## Run LangChain4j

By instrumenting your application, spans will be created whenever it is run and will be sent to the Phoenix server for collection.

```java
import io.openinference.instrumentation.langchain4j.LangChain4jInstrumentor;
import dev.langchain4j.model.openai.OpenAiChatModel;

initializeOpenTelemetry();

// Auto-instrument LangChain4j
LangChain4jInstrumentor.instrument();

// Use LangChain4j as normal - traces will be automatically created
OpenAiChatModel model = OpenAiChatModel.builder()
    .apiKey("your-openai-api-key")
    .modelName("gpt-4")
    .build();

String response = model.generate("What is the capital of France?");
```

{% hint style="success" %}
Full example: [https://github.com/Arize-ai/openinference/tree/main/java/examples/langchain4j-example](https://github.com/Arize-ai/openinference/tree/main/java/examples/langchain4j-example)
{% endhint %}

## Observe

Once configured, your traces will be automatically sent to Phoenix where you can:

* **Monitor Performance**: Track latency, throughput, and error rates
* **Analyze Usage**: View token usage, model performance, and cost metrics
* **Debug Issues**: Trace request flows and identify bottlenecks
* **Evaluate Quality**: Run evaluations on your LLM outputs

## Resources

* [Full Example](https://github.com/Arize-ai/openinference/tree/main/java/examples/langchain4j-example)
* [OpenInference package](https://central.sonatype.com/artifact/com.arize/openinference-instrumentation-langchain4j)

# OpenInference Java

{% hint style="info" %}
Maven Central Repository: [https://central.sonatype.com/search?q=arize](https://central.sonatype.com/search?q=arize)
{% endhint %}

The **OpenInference Java SDK** provides tracing capabilities for AI applications using OpenTelemetry. It enables you to instrument and monitor different code executions across models, frameworks, and vendors. The SDK uses semantic conventions - standardized attribute names and values - to ensure consistent tracing across different LLM providers and frameworks.

{% embed url="https://github.com/Arize-ai/openinference/tree/main/java" %}

### Overview of Packages

**OpenInference Java** is part of the [OpenInference project](https://github.com/Arize-ai/openinference). The Java SDK consists of three main packages:

* [**openinference-semantic-conventions**](https://central.sonatype.com/artifact/com.arize/openinference-semantic-conventions)**:** Java constants for OpenInference semantic conventions
* [**openinference-instrumentation**](https://central.sonatype.com/artifact/com.arize/openinference-instrumentation)**:**
* [**openinference-instrumentation-langchain4j**](https://central.sonatype.com/artifact/com.arize/openinference-instrumentation-langchain4j): Auto-instrumentation for LangChain4j applications
* [**openinference-instrumentation-springAI**](https://central.sonatype.com/artifact/com.arize/openinference-instrumentation-springAI): Auto-instrumentation for Spring AI applications

#### openinference-semantic-conventions

This package provides Java constants for OpenInference semantic conventions. Semantic conventions are standardized attribute names and values that ensure consistent tracing across different LLM providers, models, and frameworks. They define a common vocabulary for describing LLM operations, making it easier to analyze and compare traces from different sources.

OpenInference semantic conventions include standardized attributes for:

* **Span Kinds**: LLM, Chain, Tool, Agent, Retriever, Embedding, Reranker, Guardrail, Evaluator
* **Attributes**: Model names, token counts, prompts, completions, embeddings, etc.

#### openinference-instrumentation

This package provides base instrumentation utilities for creating customized manual traces

```java
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.openinference.instrumentation.OITracer;

// Create an OITracer
Tracer otelTracer = GlobalOpenTelemetry.getTracer("my-app");
OITracer tracer = new OITracer(otelTracer);

// Create an LLM span
Span span = tracer.llmSpanBuilder("chat", "gpt-4")
    .setAttribute(SpanAttributes.LLM_MODEL_NAME, "gpt-4")
    .setAttribute(SpanAttributes.LLM_PROVIDER, "openai")
    .startSpan();
```

#### openinference-instrumentation-langchain4j

This package provides auto-instrumentation for LangChain4j applications, automatically capturing traces from LangChain4j components:

```java
import io.openinference.instrumentation.langchain4j.LangChain4jInstrumenter;

LangChain4jInstrumentor.instrument();
```

### Prerequisites

* Java 11 or higher
* OpenTelemetry Java 1.49.0 or higher
* (Optional) Phoenix API key if using auth

#### Gradle

Add the dependencies to your `build.gradle`:

```gradle
dependencies {
    // Core semantic conventions
    implementation 'io.openinference:openinference-semantic-conventions:1.0.0'
    
    // Base instrumentation utilities
    implementation 'io.openinference:openinference-instrumentation:1.0.0'
    
    // LangChain4j auto-instrumentation (optional)
    implementation 'io.openinference:openinference-instrumentation-langchain4j:1.0.0'
}
```

#### Maven

Add the dependencies to your `pom.xml`:

```xml
<dependencies>
    <dependency>
        <groupId>io.openinference</groupId>
        <artifactId>openinference-semantic-conventions</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </dependency>
    <dependency>
        <groupId>io.openinference</groupId>
        <artifactId>openinference-instrumentation</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </dependency>
    <dependency>
        <groupId>io.openinference</groupId>
        <artifactId>openinference-instrumentation-langchain4j</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </dependency>
</dependencies>
```

### Quick Start

#### Manual Instrumentation

```java
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import io.openinference.instrumentation.OITracer;
import io.openinference.semconv.trace.SpanAttributes;

// Create an OITracer
Tracer otelTracer = GlobalOpenTelemetry.getTracer("my-app");
OITracer tracer = new OITracer(otelTracer);

// Create an LLM span
Span span = tracer.llmSpanBuilder("chat", "gpt-4")
    .setAttribute(SpanAttributes.LLM_MODEL_NAME, "gpt-4")
    .setAttribute(SpanAttributes.LLM_PROVIDER, "openai")
    .startSpan();

try {
    // Your LLM call here
    // ...
    
    // Set response attributes
    span.setAttribute(SpanAttributes.LLM_TOKEN_COUNT_PROMPT, 10L);
    span.setAttribute(SpanAttributes.LLM_TOKEN_COUNT_COMPLETION, 20L);
} finally {
    span.end();
}
```

#### Auto-instrumentation (with LangChain4j)&#x20;

```java
import io.openinference.instrumentation.langchain4j.LangChain4jInstrumentor;
import dev.langchain4j.model.openai.OpenAiChatModel;

// Initialize OpenTelemetry (see OpenTelemetry Java docs for full setup)
initializeOpenTelemetry();

// Auto-instrument LangChain4j
LangChain4jInstrumentor.instrument();

// Use LangChain4j as normal - traces will be automatically created
OpenAiChatModel model = OpenAiChatModel.builder()
    .apiKey("your-api-key")
    .modelName("gpt-4")
    .build();

String response = model.generate("What is the capital of France?");

```

#### Environment Configuration Example for Phoenix Tracing

Set your Phoenix credentials as environment variables:

```bash
export PHOENIX_API_KEY="your-phoenix-api-key"
```

{% hint style="warning" %}
If you are using Phoenix Cloud, adjust the endpoint in the code below as needed.&#x20;
{% endhint %}

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

### Observability in Phoenix

Once configured, your OpenInference traces will be automatically sent to Phoenix where you can:

* **Monitor Performance**: Track latency, throughput, and error rates
* **Analyze Usage**: View token usage, model performance, and cost metrics
* **Debug Issues**: Trace request flows and identify bottlenecks
* **Evaluate Quality**: Run evaluations on your LLM outputs

### Support

* **Slack**: [Join our community](https://arize.com/community/)
* **GitHub Issues**: [OpenInference Repository](https://github.com/Arize-ai/openinference/issues)

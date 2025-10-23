---
description: >-
  How to use OpenInference instrumentation with Arconia and export traces to
  Arize Phoenix.
---

# Arconia Tracing

## Prerequisites

* Java 11 or higher
* (Optional) Phoenix API key if using auth

### Add Dependencies

#### **1. Gradle**

Add the dependencies to your `build.gradle`:

```groovy
dependencies {
    implementation 'io.arconia:arconia-openinference-semantic-conventions'
    implementation 'io.arconia:arconia-opentelemetry-spring-boot-starter'

    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.ai:spring-ai-starter-model-mistral-ai'

    developmentOnly 'org.springframework.boot:spring-boot-devtools'
    testAndDevelopmentOnly 'io.arconia:arconia-dev-services-phoenix'

    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}
```

## **Setup Phoenix Tracing**

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
If you are using Phoenix Cloud, adjust the endpoint in the code as needed.
{% endhint %}

## Run Arconia

By instrumenting your  application with Arconia, spans are automatically created whenever your AI models (e.g., via Spring AI) are invoked and sent to the Phoenix server for collection. Arconia plugs into Spring Boot and Spring AI with minimal code changes.

```java
package io.arconia.demo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
public class ArconiaTracingApplication {
    public static void main(String[] args) {
        SpringApplication.run(ArconiaTracingApplication.class, args);
    }
}

@RestController
class ChatController {

    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);
    private final ChatClient chatClient;

    ChatController(ChatClient.Builder chatClientBuilder) {
        this.chatClient = chatClientBuilder.clone().build();
    }

    @GetMapping("/chat")
    String chat(String question) {
        logger.info("Received question: {}", question);
        return chatClient
                .prompt(question)
                .call()
                .content();
    }
}
```

{% hint style="success" %}
Full example: [https://github.com/arconia-io/arconia-examples/tree/main/arconia-openinference](https://github.com/arconia-io/arconia-examples/tree/main/arconia-openinference)
{% endhint %}

## Observe

Once configured, your OpenInference traces will be automatically sent to Phoenix where you can:

* **Monitor Performance**: Track latency and errors
* **Analyze Usage**: View token usage, model performance, and cost metrics
* **Debug Issues**: Trace request flows and identify bottlenecks
* **Evaluate Quality**: Run evaluations on your LLM outputs

## Resources

* [Full Example](https://github.com/arconia-io/arconia-examples/tree/main/arconia-openinference)
* [OpenInference package](https://central.sonatype.com/artifact/com.arize/openinference-instrumentation-langchain4j)

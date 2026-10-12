package com.arize.phoenix.examples.adk;

import com.google.adk.agents.LlmAgent;
import com.google.adk.runner.InMemoryRunner;
import com.google.adk.sessions.Session;
import com.google.adk.tools.Annotations.Schema;
import com.google.adk.tools.FunctionTool;
import com.google.genai.types.Content;
import com.google.genai.types.Part;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.propagation.W3CTraceContextPropagator;
import io.opentelemetry.context.propagation.ContextPropagators;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public final class WeatherAgent {
    private WeatherAgent() {}

    public static Map<String, Object> getWeather(
            @Schema(name = "city", description = "The city to look up") String city) {
        return Map.of(
                "city", city,
                "forecast", "sunny",
                "temperature_celsius", 21);
    }

    public static void main(String[] args) {
        // Do this before touching an ADK class. ADK captures GlobalOpenTelemetry when
        // com.google.adk.Telemetry is first loaded.
        SdkTracerProvider tracerProvider = initializeOpenTelemetry();

        LlmAgent agent = LlmAgent.builder()
                .name("weather_agent")
                .model(environment("GEMINI_MODEL", "gemini-2.5-flash"))
                .description("Answers weather questions with the getWeather tool.")
                .instruction("Always call getWeather before answering. Reply in one short sentence.")
                .tools(FunctionTool.create(WeatherAgent.class, "getWeather"))
                .build();

        InMemoryRunner runner = new InMemoryRunner(agent);
        String userId = "visitor-123";
        Session session =
                runner.sessionService().createSession(runner.appName(), userId).blockingGet();

        Content message =
                Content.fromParts(Part.fromText("What is the weather in Paris right now?"));
        runner.runAsync(userId, session.id(), message).blockingForEach(event -> {
            if (event.finalResponse()) {
                System.out.println("Agent: " + event.stringifyContent());
            }
        });

        tracerProvider.forceFlush().join(10, TimeUnit.SECONDS);
        tracerProvider.shutdown().join(10, TimeUnit.SECONDS);
    }

    private static SdkTracerProvider initializeOpenTelemetry() {
        Resource resource = Resource.getDefault()
                .merge(Resource.create(Attributes.of(
                        AttributeKey.stringKey("service.name"),
                        "google-adk-java-example",
                        AttributeKey.stringKey("openinference.project.name"),
                        environment("PHOENIX_PROJECT_NAME", "google-adk-java"))));

        OtlpGrpcSpanExporter exporter = OtlpGrpcSpanExporter.builder()
                .setEndpoint(environment("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317"))
                .setTimeout(Duration.ofSeconds(5))
                .build();

        SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
                .addSpanProcessor(BatchSpanProcessor.builder(exporter)
                        .setScheduleDelay(Duration.ofSeconds(1))
                        .build())
                .setResource(resource)
                .build();

        OpenTelemetrySdk.builder()
                .setTracerProvider(tracerProvider)
                .setPropagators(
                        ContextPropagators.create(W3CTraceContextPropagator.getInstance()))
                .buildAndRegisterGlobal();
        return tracerProvider;
    }

    private static String environment(String name, String defaultValue) {
        return System.getenv().getOrDefault(name, defaultValue);
    }
}

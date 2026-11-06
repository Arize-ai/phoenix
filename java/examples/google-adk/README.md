# Trace Google ADK for Java with Phoenix

This example runs a Google ADK agent with a function tool and sends its OpenTelemetry traces to a local Phoenix instance. The OpenInference Java agent decorates ADK's spans at JVM startup; the application does not call an instrumentor.

## Run the example

You need Java, Gradle, Docker, a [Gemini API key](https://aistudio.google.com/app/apikey), and the shaded OpenInference ADK Java agent JAR.

```bash
docker run --rm -p 6006:6006 -p 4317:4317 arizephoenix/phoenix:latest
```

In another terminal:

```bash
export GOOGLE_API_KEY="your-key"
export OPENINFERENCE_ADK_AGENT_JAR="/path/to/adk-agent.jar"
cd /path/to/phoenix/java/examples/google-adk
gradle -PagentJar="$OPENINFERENCE_ADK_AGENT_JAR" run
```

Open [http://localhost:6006](http://localhost:6006) and select the `google-adk-java` project. Override the defaults with `GEMINI_MODEL`, `PHOENIX_PROJECT_NAME`, and `OTEL_EXPORTER_OTLP_ENDPOINT`.

The `run` task passes the JAR supplied through `agentJar` to the JVM with `-javaagent`. See [`WeatherAgent.java`](src/main/java/com/arize/phoenix/examples/adk/WeatherAgent.java) for the complete application and OpenTelemetry setup.

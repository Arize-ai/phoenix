import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import { register, registerInstrumentations } from "@arizeai/phoenix-otel";

import OpenAI from "openai";

export function instrument({
  projectName,
  headers,
  collectorEndpoint = "http://localhost:6006",
}: {
  projectName?: string;
  headers?: Record<string, string>;
  collectorEndpoint?: string;
}) {
  register({
    projectName,
    headers,
    url: collectorEndpoint,
    batch: false,
    global: true,
  });

  const instrumentation = new OpenAIInstrumentation();
  instrumentation.manuallyInstrument(OpenAI);

  registerInstrumentations({
    instrumentations: [instrumentation],
  });
}

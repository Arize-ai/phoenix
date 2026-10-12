// Observe Your Agent: register Phoenix tracing and instrument OpenAI.

// docs:start register
import OpenAI from "openai";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import { register, registerInstrumentations } from "@arizeai/phoenix-otel";

export const provider = register({ projectName: "tracing-quickstart" });

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);
registerInstrumentations({ instrumentations: [instrumentation] });
// docs:end register

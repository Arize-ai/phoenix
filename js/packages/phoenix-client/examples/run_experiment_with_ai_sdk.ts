/* eslint-disable no-console */
import { openai } from "@ai-sdk/openai";
import { OpenTelemetry } from "@ai-sdk/otel";
import { createDataset } from "@arizeai/phoenix-client/datasets";
import { runExperiment } from "@arizeai/phoenix-client/experiments";
import type { ExperimentTask } from "@arizeai/phoenix-client/types/experiments";
import { getTracer } from "@arizeai/phoenix-otel";
import { generateText, registerTelemetry } from "ai";

// AI SDK v7 only emits OpenTelemetry spans through telemetry integrations —
// a global tracer provider by itself produces no AI SDK traces. Register the
// `@ai-sdk/otel` integration once at startup so every AI SDK call is traced.
// Phoenix's `getTracer` resolves the tracer provider on every span, so task
// spans follow the experiment's provider that runExperiment mounts per run.
registerTelemetry(new OpenTelemetry({ tracer: getTracer("ai") }));

const model = openai("gpt-4o-mini");

const main = async () => {
  const dataset = await createDataset({
    name: "ai-sdk-questions",
    description: "Questions answered by an AI SDK task",
    examples: [
      {
        input: { question: "What is Arize Phoenix?" },
      },
      {
        input: { question: "Is Arize Phoenix open-source?" },
      },
    ],
  });

  const task: ExperimentTask = async (example) => {
    const { text } = await generateText({
      model,
      prompt: String(example.input.question),
    });
    return text;
  };

  const experiment = await runExperiment({
    experimentName: "ai-sdk-task",
    experimentDescription: "An experiment whose task is an AI SDK call",
    dataset,
    task,
  });
  console.table(experiment.runs);
};

main();

/* eslint-disable no-console */
import { openai } from "@ai-sdk/openai";
import { OpenTelemetry } from "@ai-sdk/otel";
import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import { runExperiment } from "@arizeai/phoenix-client/experiments";
import type { ExperimentTask } from "@arizeai/phoenix-client/types/experiments";
import { generateText } from "ai";

const model = openai("gpt-4o-mini");

const main = async () => {
  const dataset = await createOrGetDataset({
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

  // AI SDK v7 only emits OpenTelemetry spans through telemetry integrations —
  // a global tracer provider by itself produces no AI SDK traces. Pass the
  // `@ai-sdk/otel` integration per call, constructed inside the task: the
  // integration binds to the active tracer provider when it is constructed,
  // and runExperiment mounts the experiment's provider only while tasks run.
  // An integration registered at startup via `registerTelemetry` would bind
  // before that provider exists and the task spans would be lost.
  const task: ExperimentTask = async (example) => {
    const { text } = await generateText({
      model,
      prompt: String(example.input.question),
      telemetry: { integrations: [new OpenTelemetry()] },
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

// Set OpenTelemetry attribute value length limit BEFORE any imports
// This must be set before OpenTelemetry initializes to prevent truncation
// Default is ~250 characters, increase to allow full agent/LLM/tool outputs
if (!process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT) {
  process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = "25000";
}

import { Mastra } from "@mastra/core/mastra";
import { Observability } from "@mastra/observability";
import { ArizeExporter } from "@mastra/arize";
import type { SpanOutputProcessor } from "@mastra/core/observability";
import { SpanType } from "@mastra/core/observability";
import { financialOrchestratorAgent } from "./agents/financial-orchestrator-agent";
import { financialResearcherAgent } from "./agents/financial-researcher-agent";
import { financialWriterAgent } from "./agents/financial-writer-agent";
import { createArizeConfig } from '@mastra/arize';


export const mastra = new Mastra({
  agents: {
    financialOrchestratorAgent,
    financialResearcherAgent,
    financialWriterAgent,
  },
  observability: new Observability({
    configs: {
      arize: createArizeConfig({
        exporter: {
          endpoint: process.env.PHOENIX_ENDPOINT!,
          apiKey: process.env.PHOENIX_API_KEY,
          projectName: process.env.PHOENIX_PROJECT_NAME,
        },
        //  serializationOptions: {
        //  },
        //  spanProcessors: [
        //  ],
      }),
    },
 }),
  // observability: new Observability({
  //   configs: {
  //     arize: {
  //       serviceName:
  //         process.env.PHOENIX_PROJECT_NAME || "mastra-tracing-quickstart",
  //       exporters: [
  //         new ArizeExporter({
  //           endpoint: process.env.PHOENIX_ENDPOINT!,
  //           apiKey: process.env.PHOENIX_API_KEY,
  //           projectName: process.env.PHOENIX_PROJECT_NAME,
  //         }),
  //       ],
  //       serializationOptions: {
  //         maxStringLength: Infinity,
  //         maxDepth: 10,
  //         maxArrayLength: 1000,
  //         maxObjectKeys: 1000,
  //       },
  //       spanOutputProcessors: [
  //         {
  //           name: "workflow-loop-filter",
  //           process: (span) =>
  //             [
  //               SpanType.WORKFLOW_LOOP,
  //               SpanType.WORKFLOW_PARALLEL,
  //               SpanType.WORKFLOW_CONDITIONAL,
  //               SpanType.WORKFLOW_CONDITIONAL_EVAL,
  //             ].includes((span as any)?.type)
  //               ? undefined
  //               : span,
  //           shutdown: async () => {},
  //         } satisfies SpanOutputProcessor,
  //       ],
  //     },
  //   },
  // }),
});
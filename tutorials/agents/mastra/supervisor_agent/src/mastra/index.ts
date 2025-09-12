
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';

// Import orchestrator/worker agents - this is the only workflow pattern now
import { weatherOrchestratorAgent } from './agents/weather-orchestrator-agent';
import { weatherDataAgent } from './agents/weather-data-agent';
import { weatherAnalysisAgent } from './agents/weather-analysis-agent';
import { activityPlanningAgent } from './agents/activity-planning-agent';

import {
  isOpenInferenceSpan,
  OpenInferenceOTLPTraceExporter,
} from "@arizeai/openinference-mastra";

export const mastra = new Mastra({
  // No workflows - using pure orchestrator/worker agent pattern
  agents: { 
    // Orchestrator agent that coordinates the entire workflow
    weatherOrchestratorAgent,
    // Specialized worker agents
    weatherDataAgent,
    weatherAnalysisAgent,
    activityPlanningAgent
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: {
    enabled: true,
    serviceName: "mastra-orchestrator-workflow",
    export: {
      type: "custom",
      tracerName: "mastra-orchestrator-workflow",
      exporter: new OpenInferenceOTLPTraceExporter({
        url: process.env.PHOENIX_COLLECTOR_ENDPOINT + "/v1/traces",
        headers: {
          Authorization: `Bearer ${process.env.PHOENIX_API_KEY}`,
        },
        spanFilter: isOpenInferenceSpan,
      }),    
    },
  },
});

import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherAgent } from './agents/weather-agent';

import {
  isOpenInferenceSpan,
  OpenInferenceOTLPTraceExporter,
} from "@arizeai/openinference-mastra";

export const mastra = new Mastra({
  agents: { weatherAgent },
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
    serviceName: "mastra-weather-agent",
    export: {
      type: "custom",
      tracerName: "mastra-weather-agent",
      exporter: new OpenInferenceOTLPTraceExporter({
        url: "http://localhost:6006/v1/traces",
        spanFilter: isOpenInferenceSpan,
      }),    
    },
  },
});

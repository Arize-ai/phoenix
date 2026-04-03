// Install these alongside @arizeai/phoenix-otel before running:
// npm install @opentelemetry/instrumentation-express @opentelemetry/instrumentation-http
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";

/* eslint-disable no-console */
import { register } from "../src";

register({
  projectName: "instrumentation-example",
  instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
});

console.log("Instrumentation registered.");

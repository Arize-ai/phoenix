import { register, trace } from "../src";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const provider = register({
  url: "http://localhost:6006/v1/traces",
  apiKey: "your-api-key",
  projectName: "example-app",
  batch: false,
});

const tracer = trace.getTracer("my-app");

tracer.startActiveSpan("custom-span", (span) => {
  // do something
  span.end();
});

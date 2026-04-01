/* eslint-disable no-console */
import { register, SpanStatusCode, trace } from "../src";

async function main() {
  const provider = register({
    projectName: "manual-spans-example",
    batch: false,
  });

  const tracer = trace.getTracer("manual-spans-example");

  await tracer.startActiveSpan("fetch-context", async (span) => {
    try {
      span.setAttribute("app.operation", "fetch-context");
      await Promise.resolve();
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });

  await provider.shutdown();
}

main().catch(console.error);

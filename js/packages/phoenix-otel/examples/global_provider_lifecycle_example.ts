/* eslint-disable no-console */
import {
  attachGlobalTracerProvider,
  detachGlobalTracerProvider,
  register,
  trace,
} from "../src";

async function main() {
  const provider = register({
    projectName: "provider-lifecycle-example",
    global: false,
    batch: false,
  });

  const registration = attachGlobalTracerProvider(provider);

  await trace
    .getTracer("provider-lifecycle-example")
    .startActiveSpan("attached-provider-span", async (span) => {
      span.end();
    });

  registration.detach();
  detachGlobalTracerProvider();
  await provider.shutdown();
}

main().catch(console.error);

import { register } from "@arizeai/phoenix-otel";

const provider = register({ projectName: "success-only" });

async function main() {
  await doWork();
  await provider.forceFlush();
}

async function doWork() {}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

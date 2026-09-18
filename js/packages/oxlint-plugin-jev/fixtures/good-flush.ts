import { register } from "@arizeai/phoenix-otel";

const provider = register({ projectName: "good-flush", batch: true });

async function main() {
  await doWork();
}

async function doWork() {}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await provider.shutdown();
  });

process.on("SIGTERM", async () => {
  await provider.shutdown();
  process.exit(0);
});

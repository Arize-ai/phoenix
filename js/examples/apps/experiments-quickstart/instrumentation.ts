import { register } from "@arizeai/phoenix-otel";

const ENDPOINT = process.env.PHOENIX_HOST;
const PROJECT_NAME = "experiments-tutorial-ts";

if (!ENDPOINT) {
  // eslint-disable-next-line no-console
  console.warn("⚠️  PHOENIX_HOST not set, tracing will not be enabled");
} else {
  register({
    url: ENDPOINT,
    projectName: PROJECT_NAME,
    apiKey: process.env.PHOENIX_API_KEY,
    batch: false,
  });
}

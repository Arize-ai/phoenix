import { ENV_PHOENIX_DISCOVER_CONFIG } from "@arizeai/phoenix-config";

// Disable `.env.phoenix` file discovery so a developer's real credential file
// (anywhere above the repo) cannot leak into test assertions.
process.env[ENV_PHOENIX_DISCOVER_CONFIG] = "false";

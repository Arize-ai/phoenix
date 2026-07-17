import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ENV_PHOENIX_DISCOVER_CONFIG } from "@arizeai/phoenix-config";

// Disable `.env.phoenix` file discovery so a developer's real credential file
// (anywhere above the repo) cannot leak into test assertions.
process.env[ENV_PHOENIX_DISCOVER_CONFIG] = "false";

// Point the settings directory at a throwaway location so a developer's real
// `~/.px/settings.json` (e.g. OAuth tokens from `px auth login`) cannot leak
// into test assertions or trigger token refreshes against mocked fetch.
process.env.XDG_CONFIG_HOME = fs.mkdtempSync(
  path.join(os.tmpdir(), "px-test-config-")
);

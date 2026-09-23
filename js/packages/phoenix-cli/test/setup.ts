import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { isolatePhoenixEnvForTesting } from "@arizeai/phoenix-config";

isolatePhoenixEnvForTesting();

// Point the settings directory at a throwaway location so a developer's real
// `~/.px/settings.json` (e.g. OAuth tokens from `px auth login`) cannot leak
// into test assertions or trigger token refreshes against mocked fetch.
process.env.XDG_CONFIG_HOME = fs.mkdtempSync(
  path.join(os.tmpdir(), "px-test-config-")
);

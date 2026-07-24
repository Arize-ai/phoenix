//@ts-check
/* eslint-disable */
import { exec, execSync } from "child_process";
import fs from "fs";
import * as crypto from "node:crypto";
import os from "os";
import path from "path";
import process from "process";

const appPrefix = "phoenix";
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), appPrefix));

// Set environment variables for the server
process.env["PHOENIX_WORKING_DIR"] = tmpDir;
process.env["PHOENIX_ENABLE_AUTH"] = "True";
process.env["PHOENIX_SECRET"] = crypto.randomBytes(32).toString("hex");
process.env["PHOENIX_SQL_DATABASE_URL"] = "sqlite:///:memory:";
// Disable rate limiting for tests to avoid flakiness from parallel logins
// The rate-limit.spec.ts test will re-enable it for its specific test
process.env["PHOENIX_DISABLE_RATE_LIMIT"] = "True";

// Enable Prometheus so the PrometheusMiddleware is mounted on every request
// during the e2e suite. This produces metrics on :9090 and, crucially, gives
// the suite real coverage of the metrics code path — e.g. the FastAPI 0.137
// `_IncludedRouter` route-resolution regression that PrometheusMiddleware hit
// only surfaces when the middleware actually runs against included routers.
process.env["PHOENIX_ENABLE_PROMETHEUS"] = "True";

// Fake credentials for hosted sandbox providers so they advertise
// `status=AVAILABLE` (instead of `MISSING_CREDENTIALS`) and surface in the
// New Sandbox Config dropdown — which now filters out unavailable/disabled
// providers (#13117). The adapter `build_backend()` calls are pure object
// construction; no network is performed at probe time, so a synthetic key
// is sufficient. Tests that exercise live execution stub the runtime
// separately.
process.env["E2B_API_KEY"] = "phoenix-e2e-fake-e2b-key";

// Pre-warm the CPython WASM binary cache so ``WASMAdapter.probe_binary()``
// returns AVAILABLE and the WASM provider surfaces in the New Sandbox
// dropdown (the dropdown filters on ``status === "AVAILABLE"``). CI does
// this in ``.github/workflows/playwright.yaml`` via a direct urlretrieve +
// ``PHOENIX_WASM_BINARY_PATH`` override; for local runs we delegate to the
// Python helper so it handles sha256 verification and the same default
// cache directory (``~/.cache/phoenix/wasm/``). After the first run the
// binary is on disk and this becomes a no-op.
const wasmCacheDir = path.join(os.homedir(), ".cache", "phoenix", "wasm");
const wasmCachedBinary = path.join(wasmCacheDir, "python-3.12.0.wasm");
if (!fs.existsSync(wasmCachedBinary)) {
  console.log(
    "Pre-warming CPython WASM binary cache (one-time, ~30MB download)..."
  );
  execSync(
    `uv run --extra container python -c "from phoenix.server.sandbox._download import ensure_wasm_binary; ensure_wasm_binary()"`,
    { stdio: "inherit" }
  );
}

if (
  process.env["PXI_E2E"] === "true" ||
  process.env["PHOENIX_E2E_ENABLE_AGENT_ASSISTANT"] === "true"
) {
  process.env["PHOENIX_ALLOW_EXTERNAL_RESOURCES"] = "True";
} else {
  // The PXI assistant is enabled by default, which renders a floating action
  // button that overlaps and intercepts clicks in unrelated specs. Disable it
  // for the standard e2e suite; PXI specs run with PXI_E2E=true and rely on the
  // assistant being enabled.
  process.env["PHOENIX_DISABLE_AGENT_ASSISTANT"] = "True";
}

console.log("Phoenix test server starting...");
console.log("PHOENIX_SECRET: ", process.env["PHOENIX_SECRET"]);
console.log("PHOENIX_WORKING_DIR: ", process.env["PHOENIX_WORKING_DIR"]);
console.log(
  "PHOENIX_SQL_DATABASE_URL: ",
  process.env["PHOENIX_SQL_DATABASE_URL"]
);

// Execute the server
const childProcess = exec(`uv run --compile --extra container phoenix serve`);

childProcess.stdout?.pipe(process.stdout);
childProcess.stderr?.pipe(process.stderr);

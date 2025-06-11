//@ts-check
/* eslint-disable no-console */
import { exec } from "child_process";
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

console.log("Phoenix test server starting...");
console.log("PHOENIX_SECRET: ", process.env["PHOENIX_SECRET"]);
console.log("PHOENIX_WORKING_DIR: ", process.env["PHOENIX_WORKING_DIR"]);
console.log(
  "PHOENIX_SQL_DATABASE_URL: ",
  process.env["PHOENIX_SQL_DATABASE_URL"]
);

// Execute the server
// uv will:
// - install the phoenix server in editable mode
// - install the phoenix evals and otel packages from the local packages directory
// - install container extras (necessary for playground)
// - run the arize-phoenix serve command
const childProcess = exec(
  `uv run \
  --extra=container\
  --with=arize-phoenix-evals@../packages/phoenix-evals\
  --with=arize-phoenix-otel@../packages/phoenix-otel\
  arize-phoenix serve`
);

childProcess.stdout?.pipe(process.stdout);
childProcess.stderr?.pipe(process.stderr);

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

// Execute the server
// TODO: Might have to force install the phoenix server
const childProcess = exec("uv tool run arize-phoenix serve");

childProcess.stdout?.pipe(process.stdout);
childProcess.stderr?.pipe(process.stderr);

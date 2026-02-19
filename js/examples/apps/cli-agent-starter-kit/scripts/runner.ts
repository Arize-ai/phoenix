import { spawn } from "node:child_process";
import path from "node:path";
/* eslint-disable no-console */
import { createClient } from "@arizeai/phoenix-client";
import { glob } from "glob";

import { flush } from "../src/instrumentation.js";

function runFile(file: string): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    const child = spawn("tsx", [file], {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    child.on("exit", (code) => {
      resolve({ success: code === 0 });
    });

    child.on("error", (error) => {
      console.error(`Failed to run ${file}:`, error);
      resolve({ success: false });
    });
  });
}

export async function runSuite({
  dir,
  ext,
  label,
  pattern,
}: {
  dir: string;
  ext: string;
  label: string;
  pattern?: string;
}): Promise<void> {
  const searchPattern = pattern ? `${dir}/*${pattern}*${ext}` : `${dir}/*${ext}`;

  const files = await glob(searchPattern, { cwd: process.cwd(), absolute: true });
  const entries = files.map((file) => ({ name: path.basename(file, ext), file }));

  console.log(
    pattern ? `\nRunning ${label}s matching: ${pattern}\n` : `\nRunning all ${label}s\n`
  );

  if (entries.length === 0) {
    console.error(
      pattern ? `No ${label}s found matching: ${pattern}` : `No ${label}s found in ${dir}/`
    );
    process.exit(1);
  }

  console.log(`Found ${entries.length} ${label}(s):\n`);
  for (const entry of entries) {
    console.log(`  • ${entry.name}${ext}`);
  }
  console.log();

  let passed = 0;
  let failed = 0;

  for (const entry of entries) {
    console.log(`\n▶ Running: ${entry.name}\n`);
    const result = await runFile(entry.file);
    if (result.success) {
      passed++;
      console.log(`\n✓ ${entry.name} completed\n`);
    } else {
      failed++;
      console.log(`\n✗ ${entry.name} failed (script error)\n`);
    }
  }

  await flush();

  const client = createClient();
  const baseUrl = client.config.baseUrl || "http://localhost:6006";

  console.log("\n" + "=".repeat(50));
  console.log(`\nCompleted: ${passed} successful, ${failed} failed`);
  console.log(`\n→ View results: ${baseUrl}/datasets\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

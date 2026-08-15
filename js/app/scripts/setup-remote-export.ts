#!/usr/bin/env -S node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON

import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

export const DEFAULT_COLLECTOR_ENDPOINT =
  "https://app.phoenix.arize.com/s/phoenix-devs";
export const DEFAULT_PROJECT_NAME = "pxi_dev";
const ENV_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.env"
);

const COLLECTOR_ENDPOINT = "PHOENIX_AGENTS_COLLECTOR_ENDPOINT";
const COLLECTOR_API_KEY = "PHOENIX_AGENTS_COLLECTOR_API_KEY";
const ASSISTANT_PROJECT_NAME = "PHOENIX_AGENTS_ASSISTANT_PROJECT_NAME";
const FORCE_TRACING = "PHOENIX_AGENTS_FORCE_TRACING";

class SecretOutput extends Writable {
  isMuted = false;

  _write(
    chunk: string | Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ) {
    if (!this.isMuted) {
      process.stdout.write(chunk, encoding);
    }
    callback();
  }
}

export function quoteShellValue(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function getEnvValue({
  contents,
  name,
}: {
  contents: string;
  name: string;
}): string | undefined {
  const assignmentPattern = new RegExp(
    `^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`
  );
  let value: string | undefined;

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(assignmentPattern);
    if (match) {
      value = parseShellValue(match[1] ?? "");
    }
  }
  return value;
}

export function updateEnvVariables({
  contents,
  values,
}: {
  contents: string;
  values: ReadonlyMap<string, string>;
}): string {
  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  const hasFinalNewline = contents.endsWith("\n");
  const lines = contents === "" ? [] : contents.split(/\r?\n/);
  if (hasFinalNewline) {
    lines.pop();
  }

  for (const [name, value] of values) {
    const assignmentPattern = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=.*$`);
    const assignment = `export ${name}=${quoteShellValue(value)}`;
    let hasWrittenAssignment = false;
    const updatedLines: string[] = [];

    for (const line of lines) {
      if (!assignmentPattern.test(line)) {
        updatedLines.push(line);
      } else if (!hasWrittenAssignment) {
        updatedLines.push(assignment);
        hasWrittenAssignment = true;
      }
    }

    if (!hasWrittenAssignment) {
      updatedLines.push(assignment);
    }
    lines.splice(0, lines.length, ...updatedLines);
  }

  return `${lines.join(newline)}${newline}`;
}

export function normalizeCollectorEndpoint(value: string): string {
  const endpoint = value.trim().replace(/\/+$/, "");
  const normalizedEndpoint = endpoint.replace(/\/v1\/traces$/, "");
  const url = new URL(normalizedEndpoint);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The collector endpoint must use http:// or https://.");
  }
  return normalizedEndpoint;
}

async function main() {
  const contents = await readEnvFile(ENV_PATH);
  const currentEndpoint = getEnvValue({
    contents,
    name: COLLECTOR_ENDPOINT,
  });
  const currentApiKey = getEnvValue({ contents, name: COLLECTOR_API_KEY });
  const currentProjectName = getEnvValue({
    contents,
    name: ASSISTANT_PROJECT_NAME,
  });
  const secretOutput = new SecretOutput();
  const prompt = createInterface({
    input: process.stdin,
    output: secretOutput,
    terminal: true,
  });

  process.stdout.write(
    `Configure PXI remote trace export in ${path.relative(process.cwd(), ENV_PATH)}.\n\n`
  );

  try {
    const endpoint = await askForEndpoint({ prompt, currentEndpoint });
    const apiKey = await askForSecret({
      prompt,
      output: secretOutput,
      hasCurrentValue: Boolean(currentApiKey),
    });
    const projectName = await askWithDefault({
      prompt,
      message: "Assistant project name",
      defaultValue: currentProjectName || DEFAULT_PROJECT_NAME,
    });
    const nextApiKey =
      apiKey === "" ? currentApiKey || "" : apiKey === "-" ? "" : apiKey;
    const updatedContents = updateEnvVariables({
      contents,
      values: new Map([
        [COLLECTOR_ENDPOINT, endpoint],
        [COLLECTOR_API_KEY, nextApiKey],
        [ASSISTANT_PROJECT_NAME, projectName],
        [FORCE_TRACING, "true"],
      ]),
    });

    await writeEnvFile({ path: ENV_PATH, contents: updatedContents });
    process.stdout.write(
      "\nPXI remote export and tracing configured. Restart Phoenix to apply the changes.\n"
    );
  } finally {
    prompt.close();
  }
}

async function askForEndpoint({
  prompt,
  currentEndpoint,
}: {
  prompt: ReturnType<typeof createInterface>;
  currentEndpoint?: string;
}): Promise<string> {
  while (true) {
    const answer = await askWithDefault({
      prompt,
      message: "Collector base endpoint",
      defaultValue: currentEndpoint || DEFAULT_COLLECTOR_ENDPOINT,
    });
    if (!answer) {
      process.stdout.write("A collector endpoint is required.\n");
      continue;
    }
    try {
      const endpoint = normalizeCollectorEndpoint(answer);
      if (endpoint !== answer.trim().replace(/\/+$/, "")) {
        process.stdout.write(`Using collector base endpoint ${endpoint}.\n`);
      }
      return endpoint;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(`Invalid endpoint: ${message}\n`);
    }
  }
}

async function askWithDefault({
  prompt,
  message,
  defaultValue,
}: {
  prompt: ReturnType<typeof createInterface>;
  message: string;
  defaultValue?: string;
}): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await prompt.question(`${message}${suffix}: `)).trim();
  return answer || defaultValue || "";
}

async function askForSecret({
  prompt,
  output,
  hasCurrentValue,
}: {
  prompt: ReturnType<typeof createInterface>;
  output: SecretOutput;
  hasCurrentValue: boolean;
}): Promise<string> {
  const currentValueHint = hasCurrentValue
    ? " (hidden; blank keeps current, '-' clears)"
    : " (optional; hidden)";
  const answerPromise = prompt.question(
    `Collector API key${currentValueHint}: `
  );
  output.isMuted = true;
  try {
    return (await answerPromise).trim();
  } finally {
    output.isMuted = false;
    process.stdout.write("\n");
  }
}

async function readEnvFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function writeEnvFile({
  path: filePath,
  contents,
}: {
  path: string;
  contents: string;
}) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  let mode = 0o600;
  try {
    mode = (await stat(filePath)).mode;
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", mode });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

function parseShellValue(value: string): string {
  const trimmedValue = value.trim();
  if (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) {
    return trimmedValue.slice(1, -1).replaceAll(`'\\''`, "'");
  }
  if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) {
    return trimmedValue.slice(1, -1).replace(/\\(["\\$`])/g, "$1");
  }
  return trimmedValue;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === invokedPath) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Failed to configure PXI remote export: ${message}\n`);
    process.exitCode = 1;
  });
}

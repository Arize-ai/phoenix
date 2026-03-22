import {
  Bash,
  type InMemoryFs,
  type BashOptions,
  type InitialFiles,
} from "just-bash";

import {
  applyBashToolFilesystemPolicy,
  BASH_TOOL_READONLY_ROOT,
  BASH_TOOL_WORKSPACE_ROOT,
  captureBashToolFilesystemMutationMethods,
  type BashToolFilesystemMutationMethods,
} from "./bashToolFilesystemPolicy";
import type { BashToolCommandResult, BashToolRuntime } from "./bashToolTypes";
import { phoenixGqlCommand } from "./phoenixGqlCommand";

/**
 * Default working directory for the browser bash runtime scratch space.
 */
export const DEFAULT_BASH_TOOL_CWD = BASH_TOOL_WORKSPACE_ROOT;

type BashExecutionLimits = NonNullable<BashOptions["executionLimits"]>;

type CreateBashToolRuntimeOptions = {
  initialFiles?: InitialFiles;
};

/**
 * Guardrails applied to each just-bash runtime to bound work and output size.
 */
export const DEFAULT_BASH_TOOL_EXECUTION_LIMITS = {
  maxCallDepth: 50,
  maxCommandCount: 200,
  maxLoopIterations: 1000,
  maxAwkIterations: 1000,
  maxSedIterations: 1000,
  maxJqIterations: 1000,
  maxSqliteTimeoutMs: 2000,
  maxJsTimeoutMs: 2000,
  maxGlobOperations: 10000,
  maxStringLength: 1024 * 1024,
  maxArrayElements: 10000,
  maxHeredocSize: 1024 * 1024,
  maxSubstitutionDepth: 20,
  maxBraceExpansionResults: 1000,
  maxOutputSize: 256 * 1024,
  maxFileDescriptors: 128,
  maxSourceDepth: 20,
} satisfies BashExecutionLimits;

function getFileContent(value: InitialFiles[string]) {
  if (typeof value === "function") {
    return value();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "content" in value &&
    !(value instanceof Uint8Array)
  ) {
    return value.content;
  }

  return value;
}

function toTextContent(content: string | Uint8Array) {
  return typeof content === "string"
    ? content
    : new TextDecoder().decode(content);
}

function escapeShellPath(path: string) {
  return `"${path.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

async function executeInternalShellCommand(bash: Bash, command: string) {
  const result = await bash.exec(command);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Command failed: ${command}`);
  }
}

async function withPolicyDisabled<T>(
  bash: Bash,
  originalMutationMethods: BashToolFilesystemMutationMethods,
  callback: () => Promise<T>
) {
  Object.assign(bash.fs, originalMutationMethods);

  try {
    return await callback();
  } finally {
    applyBashToolFilesystemPolicy(bash.fs);
  }
}

function getParentPath(filePath: string) {
  return filePath.slice(0, filePath.lastIndexOf("/")) || "/";
}

function buildPhoenixFileWriteCommand({
  filePath,
  content,
  fileIndex,
}: {
  filePath: string;
  content: string;
  fileIndex: number;
}) {
  const heredocDelimiter = `__PHOENIX_CONTEXT_${fileIndex}__`;

  return [
    `cat <<'${heredocDelimiter}' > ${escapeShellPath(filePath)}`,
    content,
    heredocDelimiter,
  ].join("\n");
}

async function writeInitialFiles(
  bash: Bash,
  originalMutationMethods: BashToolFilesystemMutationMethods,
  files: InitialFiles
) {
  await withPolicyDisabled(bash, originalMutationMethods, async () => {
    await originalMutationMethods.rm(BASH_TOOL_READONLY_ROOT, {
      force: true,
      recursive: true,
    });
    await originalMutationMethods.mkdir(BASH_TOOL_READONLY_ROOT, {
      recursive: true,
    });

    const createdDirectories = new Set<string>([BASH_TOOL_READONLY_ROOT]);
    let fileIndex = 0;

    for (const [filePath, value] of Object.entries(files)) {
      const parentPath = getParentPath(filePath);

      if (!createdDirectories.has(parentPath)) {
        await originalMutationMethods.mkdir(parentPath, { recursive: true });
        createdDirectories.add(parentPath);
      }

      const content = toTextContent(
        (await getFileContent(value)) as string | Uint8Array
      );

      await executeInternalShellCommand(
        bash,
        buildPhoenixFileWriteCommand({
          filePath,
          content,
          fileIndex,
        })
      );

      fileIndex += 1;
    }
  });
}

function getByteLength(content: string) {
  return new TextEncoder().encode(content).byteLength;
}

function createInstrumentedCommandResult({
  command,
  result,
  startedAt,
  completedAt,
  durationMs,
}: {
  command: string;
  result: Awaited<ReturnType<Bash["exec"]>>;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}): BashToolCommandResult {
  return {
    command,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    durationMs,
    startedAt,
    completedAt,
    stdoutBytes: getByteLength(result.stdout),
    stderrBytes: getByteLength(result.stderr),
  };
}

/**
 * Creates an instrumented just-bash runtime with Phoenix filesystem policy and
 * support for replacing generated context files between refreshes.
 */
export async function createBashToolRuntime({
  initialFiles,
}: CreateBashToolRuntimeOptions = {}): Promise<BashToolRuntime> {
  // We execute just-bash directly in the browser for now.
  // Future reference: bash-tool's browser work is being explored in
  // https://github.com/vercel-labs/bash-tool/pull/7
  const bash = new Bash({
    cwd: DEFAULT_BASH_TOOL_CWD,
    customCommands: [phoenixGqlCommand],
    executionLimits: DEFAULT_BASH_TOOL_EXECUTION_LIMITS,
  });
  const originalMutationMethods = captureBashToolFilesystemMutationMethods(
    bash.fs as InMemoryFs
  );
  applyBashToolFilesystemPolicy(bash.fs);

  const runtime: BashToolRuntime = {
    executeCommand: async (
      command,
      options
    ): Promise<BashToolCommandResult> => {
      const startedAt = new Date().toISOString();
      const startTime = performance.now();
      const result = await bash.exec(command, {
        signal: options?.signal,
      });
      const completedAt = new Date().toISOString();

      return createInstrumentedCommandResult({
        command,
        result,
        startedAt,
        completedAt,
        durationMs: Math.round(performance.now() - startTime),
      });
    },
    replacePhoenixFiles: async (files) => {
      await writeInitialFiles(bash, originalMutationMethods, files);
    },
  };

  if (initialFiles) {
    await runtime.replacePhoenixFiles(initialFiles);
  }

  return runtime;
}

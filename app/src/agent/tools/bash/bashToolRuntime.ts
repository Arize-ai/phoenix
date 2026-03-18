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
} from "./bashToolFilesystemPolicy";
import type { BashToolCommandResult, BashToolRuntime } from "./bashToolTypes";

export const DEFAULT_BASH_TOOL_CWD = BASH_TOOL_WORKSPACE_ROOT;
const PHOENIX_CONTEXT_HEREDOC_PREFIX = "__PHOENIX_CONTEXT_";

type BashExecutionLimits = NonNullable<BashOptions["executionLimits"]>;

type WritableMutationMethods = Pick<
  InMemoryFs,
  | "appendFile"
  | "chmod"
  | "cp"
  | "link"
  | "mkdir"
  | "mv"
  | "rm"
  | "symlink"
  | "utimes"
  | "writeFile"
>;

type CreateBashToolRuntimeOptions = {
  initialFiles?: InitialFiles;
};

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
  maxHeredocSize: 256 * 1024,
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

function escapeShellPath(path: string) {
  return `"${path.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function toTextContent(content: string | Uint8Array) {
  return typeof content === "string"
    ? content
    : new TextDecoder().decode(content);
}

async function executeInternalShellCommand(bash: Bash, command: string) {
  const result = await bash.exec(command);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Command failed: ${command}`);
  }
}

function getWritableMutationMethods(bash: Bash): WritableMutationMethods {
  return {
    appendFile: bash.fs.appendFile.bind(bash.fs),
    chmod: bash.fs.chmod.bind(bash.fs),
    cp: bash.fs.cp.bind(bash.fs),
    link: bash.fs.link.bind(bash.fs),
    mkdir: bash.fs.mkdir.bind(bash.fs),
    mv: bash.fs.mv.bind(bash.fs),
    rm: bash.fs.rm.bind(bash.fs),
    symlink: bash.fs.symlink.bind(bash.fs),
    utimes: bash.fs.utimes.bind(bash.fs),
    writeFile: bash.fs.writeFile.bind(bash.fs),
  };
}

async function withPolicyDisabled<T>(
  bash: Bash,
  originalMutationMethods: WritableMutationMethods,
  callback: () => Promise<T>
) {
  Object.assign(bash.fs, originalMutationMethods);

  try {
    return await callback();
  } finally {
    applyBashToolFilesystemPolicy(bash.fs);
  }
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
  const parentPath = filePath.slice(0, filePath.lastIndexOf("/")) || "/";
  const heredocDelimiter = `${PHOENIX_CONTEXT_HEREDOC_PREFIX}${fileIndex}__`;

  return [
    `mkdir -p ${escapeShellPath(parentPath)}`,
    `cat <<'${heredocDelimiter}' > ${escapeShellPath(filePath)}`,
    content,
    heredocDelimiter,
  ].join("\n");
}

async function writeInitialFiles(
  bash: Bash,
  originalMutationMethods: WritableMutationMethods,
  files: InitialFiles
) {
  await withPolicyDisabled(bash, originalMutationMethods, async () => {
    await executeInternalShellCommand(
      bash,
      `rm -rf ${escapeShellPath(BASH_TOOL_READONLY_ROOT)} && mkdir -p ${escapeShellPath(BASH_TOOL_READONLY_ROOT)}`
    );

    let fileIndex = 0;

    for (const [filePath, value] of Object.entries(files)) {
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

export async function createBashToolRuntime({
  initialFiles,
}: CreateBashToolRuntimeOptions = {}): Promise<BashToolRuntime> {
  // We execute just-bash directly in the browser for now.
  // Future reference: bash-tool's browser work is being explored in
  // https://github.com/vercel-labs/bash-tool/pull/7
  const bash = new Bash({
    cwd: DEFAULT_BASH_TOOL_CWD,
    executionLimits: DEFAULT_BASH_TOOL_EXECUTION_LIMITS,
  });
  const originalMutationMethods = getWritableMutationMethods(bash);
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

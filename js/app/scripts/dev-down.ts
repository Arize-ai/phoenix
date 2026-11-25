#!/usr/bin/env tsx
/**
 * Stops the Phoenix dev services started from this checkout.
 *
 * Stops the dekit stack (`pnpm dev`), then terminates any remaining Vite,
 * Storybook, and Phoenix server/datagen processes whose working directory is
 * inside this checkout. Processes from other clones are never touched.
 *
 * Run: `pnpm dev:down`, or `pnpm dev:down --dry-run` to only list them.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(APP_DIR, "../..");
const DEV_SERVICE_RE =
  /\bvite\b|\bstorybook\b|phoenix\.server\.main|\bphoenix (?:serve|datagen)\b|testServer\.mjs/;
const DEFAULT_GRACE_PERIOD_MS = 5_000;
const POLL_INTERVAL_MS = 200;

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

type DevProcess = {
  pid: number;
  command: string;
  ports: string[];
};

function runCommand({
  command,
  args,
}: {
  command: string;
  args: string[];
}): string {
  try {
    return execFileSync(command, args, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (error) {
    // lsof exits non-zero when some of the requested pids have no match
    const stdout = (error as { stdout?: unknown }).stdout;
    return typeof stdout === "string" ? stdout : "";
  }
}

/**
 * Parse `lsof -F pn` output into a map of pid to names.
 */
function parseLsofNames(output: string): Map<number, string[]> {
  const namesByPid = new Map<number, string[]>();
  let currentPid: number | undefined;
  output.split("\n").forEach((line) => {
    if (line.startsWith("p")) {
      currentPid = Number(line.slice(1));
      namesByPid.set(currentPid, namesByPid.get(currentPid) ?? []);
    } else if (line.startsWith("n") && currentPid !== undefined) {
      namesByPid.get(currentPid)?.push(line.slice(1));
    }
  });
  return namesByPid;
}

function isInsideRepo(path: string): boolean {
  return path === REPO_ROOT || path.startsWith(REPO_ROOT + sep);
}

function getAncestorPids(): Set<number> {
  const parentByPid = new Map<number, number>();
  runCommand({ command: "ps", args: ["-xo", "pid=,ppid="] })
    .trim()
    .split("\n")
    .forEach((line) => {
      const [pid, ppid] = line.trim().split(/\s+/).map(Number);
      parentByPid.set(pid, ppid);
    });
  const ancestors = new Set<number>();
  let pid: number | undefined = process.pid;
  while (pid !== undefined && pid > 1 && !ancestors.has(pid)) {
    ancestors.add(pid);
    pid = parentByPid.get(pid);
  }
  return ancestors;
}

function findDevProcesses(): DevProcess[] {
  const ancestorPids = getAncestorPids();
  const candidates = runCommand({
    command: "ps",
    args: ["-xo", "pid=,command="],
  })
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(.*)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({ pid: Number(match[1]), command: match[2] }))
    .filter(
      ({ pid, command }) =>
        !ancestorPids.has(pid) && DEV_SERVICE_RE.test(command)
    );
  if (candidates.length === 0) {
    return [];
  }
  const pidList = candidates.map(({ pid }) => pid).join(",");
  const cwdByPid = parseLsofNames(
    runCommand({
      command: "lsof",
      args: ["-a", "-d", "cwd", "-p", pidList, "-Fpn"],
    })
  );
  const portsByPid = parseLsofNames(
    runCommand({
      command: "lsof",
      args: ["-a", "-nP", "-iTCP", "-sTCP:LISTEN", "-p", pidList, "-Fpn"],
    })
  );
  return candidates
    .filter(({ pid }) => {
      const cwd = cwdByPid.get(pid)?.[0];
      return cwd !== undefined && isInsideRepo(cwd);
    })
    .map(({ pid, command }) => ({
      pid,
      command,
      ports: (portsByPid.get(pid) ?? []).map((name) =>
        name.replace(/^.*:/, ":")
      ),
    }));
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sendSignal({
  pid,
  signal,
}: {
  pid: number;
  signal: NodeJS.Signals;
}): void {
  try {
    process.kill(pid, signal);
  } catch {
    // already exited
  }
}

/**
 * Send SIGTERM, then SIGKILL whatever is still running after the grace period.
 * @param params.pids - processes to stop
 * @param params.gracePeriodMs - how long to wait before SIGKILL
 */
async function stopProcesses({
  pids,
  gracePeriodMs = DEFAULT_GRACE_PERIOD_MS,
}: {
  pids: number[];
  gracePeriodMs?: number;
}): Promise<number[]> {
  pids.forEach((pid) => sendSignal({ pid, signal: "SIGTERM" }));
  const deadline = Date.now() + gracePeriodMs;
  while (Date.now() < deadline && pids.some(isRunning)) {
    await new Promise((resolveWait) =>
      setTimeout(resolveWait, POLL_INTERVAL_MS)
    );
  }
  const survivors = pids.filter(isRunning);
  survivors.forEach((pid) => sendSignal({ pid, signal: "SIGKILL" }));
  return survivors;
}

function stopDekitStack(): void {
  const hasDekit =
    spawnSync("sh", ["-c", "command -v dekit"], { stdio: "ignore" }).status ===
    0;
  if (!hasDekit) {
    return;
  }
  const result = spawnSync("dekit", ["down", APP_DIR], { stdio: "inherit" });
  if (result.status === 0) {
    log("Stopped the dekit stack (pnpm dev).");
  }
}

function formatProcess({ pid, command, ports }: DevProcess): string {
  const portLabel = ports.length > 0 ? ` [${ports.join(", ")}]` : "";
  const shortCommand =
    command.length > 120 ? `${command.slice(0, 117)}...` : command;
  return `  ${pid}${portLabel}  ${shortCommand}`;
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes("--dry-run");
  if (!isDryRun) {
    stopDekitStack();
  }
  const devProcesses = findDevProcesses();
  if (devProcesses.length === 0) {
    log(`No dev services running from ${REPO_ROOT}.`);
    return;
  }
  log(
    `${isDryRun ? "Would stop" : "Stopping"} ${devProcesses.length} process(es) running from ${REPO_ROOT}:`
  );
  devProcesses.forEach((devProcess) => log(formatProcess(devProcess)));
  if (isDryRun) {
    return;
  }
  const survivors = await stopProcesses({
    pids: devProcesses.map(({ pid }) => pid),
  });
  if (survivors.length > 0) {
    log(`Force-killed ${survivors.join(", ")} after SIGTERM.`);
  }
  log("Done.");
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});

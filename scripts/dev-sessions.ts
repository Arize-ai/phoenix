/* eslint-disable no-console -- Terminal output is this CLI's public interface. */

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_ROOT = join(REPOSITORY_ROOT, "js", "app");
const STATE_ROOT = resolve(
  process.env.PHOENIX_DEV_SESSIONS_DIR ??
    join(homedir(), ".cache", "phoenix", "dev-sessions")
);
const PORTLESS = join(
  REPOSITORY_ROOT,
  "js",
  "node_modules",
  ".bin",
  "portless"
);
const MPROCS = join(APP_ROOT, "node_modules", ".bin", "mprocs");

type Session = {
  id: string;
  branch: string;
  worktreePath: string;
  pid: number | null;
  controlPort: number;
  grpcPort: number;
  startedAt: string;
};

function run({
  command,
  arguments_,
  cwd = REPOSITORY_ROOT,
  inherit = false,
}: {
  command: string;
  arguments_: string[];
  cwd?: string;
  inherit?: boolean;
}): string {
  try {
    const output = execFileSync(command, arguments_, {
      cwd,
      encoding: "utf8",
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    return output?.trim() ?? "";
  } catch (error) {
    const stderr = (error as { stderr?: string | Buffer }).stderr;
    const message =
      typeof stderr === "string" ? stderr.trim() : stderr?.toString().trim();
    throw new Error(message || `${command} failed`, { cause: error });
  }
}

function runGit({
  arguments_,
  cwd = process.cwd(),
}: {
  arguments_: string[];
  cwd?: string;
}): string {
  return run({ command: "git", arguments_, cwd });
}

function getIdentity(): Pick<Session, "id" | "branch" | "worktreePath"> {
  const worktreePath = resolve(
    runGit({ arguments_: ["rev-parse", "--show-toplevel"] })
  );
  const commonGitDirectory = resolve(
    worktreePath,
    runGit({
      arguments_: ["rev-parse", "--git-common-dir"],
      cwd: worktreePath,
    })
  );
  const branch =
    runGit({ arguments_: ["branch", "--show-current"], cwd: worktreePath }) ||
    `detached-${runGit({ arguments_: ["rev-parse", "--short", "HEAD"], cwd: worktreePath })}`;
  const id = createHash("sha256")
    .update(`${commonGitDirectory}\0${worktreePath}`)
    .digest("hex")
    .slice(0, 12);
  return { id, branch, worktreePath };
}

const getSessionDirectory = (id: string) => join(STATE_ROOT, id);
const getSessionPath = (id: string) =>
  join(getSessionDirectory(id), "session.json");
const getDataDirectory = (id: string) => join(getSessionDirectory(id), "data");
const getLogDirectory = (id: string) => join(getSessionDirectory(id), "logs");
const getEnvironmentPath = (id: string) =>
  join(getSessionDirectory(id), "env.sh");

async function readSession(id: string): Promise<Session | null> {
  try {
    return JSON.parse(await readFile(getSessionPath(id), "utf8")) as Session;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function readSessions(): Promise<Session[]> {
  let ids: string[];
  try {
    ids = await readdir(STATE_ROOT);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return (await Promise.all(ids.map(readSession))).filter(
    (session): session is Session => session !== null
  );
}

async function writeSession(session: Session): Promise<void> {
  const directory = getSessionDirectory(session.id);
  await mkdir(directory, { recursive: true });
  const temporaryPath = join(directory, `session.${process.pid}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(session, null, 2)}\n`);
  await rename(temporaryPath, getSessionPath(session.id));
}

function isRunning(session: Session): boolean {
  if (session.pid === null) return false;
  try {
    process.kill(session.pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function selectSession(selector?: string): Promise<Session> {
  if (!selector) {
    const session = await readSession(getIdentity().id);
    if (session) return session;
    throw new Error("This worktree does not have a dev session.");
  }
  const matches = (await readSessions()).filter(
    (session) =>
      session.id.startsWith(selector) ||
      session.branch === selector ||
      session.worktreePath === resolve(selector)
  );
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `No dev session matches "${selector}".`
        : `More than one dev session matches "${selector}".`
    );
  }
  return matches[0] as Session;
}

async function getFreePort(): Promise<number> {
  const server = createServer();
  const port = await new Promise<number>((resolvePort, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return reject(new Error("Could not allocate a local port."));
      resolvePort(address.port);
    });
  });
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose()))
  );
  return port;
}

function getPortlessUrl({
  name,
  worktreePath,
}: {
  name: string;
  worktreePath: string;
}): string {
  return run({
    command: PORTLESS,
    arguments_: ["get", name],
    cwd: worktreePath,
  });
}

function isReady(url: string): boolean {
  const result = spawnSync(
    "curl",
    ["--fail", "--insecure", "--silent", "--max-time", "1", url],
    {
      stdio: "ignore",
    }
  );
  return result.status === 0;
}

function hasReachableService(session: Session): boolean {
  return (
    isReady(
      `${getPortlessUrl({ name: "phoenix", worktreePath: session.worktreePath })}/healthz`
    ) ||
    isReady(
      `${getPortlessUrl({ name: "phoenix-vite", worktreePath: session.worktreePath })}/@vite/client`
    )
  );
}

function stopPortlessServices(session: Session): void {
  for (const name of ["phoenix", "phoenix-vite"]) {
    run({
      command: PORTLESS,
      arguments_: ["run", "--name", name, "--force", "true"],
      cwd: session.worktreePath,
    });
  }
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function readEnvironment(path: string): NodeJS.ProcessEnv {
  if (!existsSync(path)) return {};
  const output = run({
    command: "/bin/sh",
    arguments_: [
      "-c",
      'set -a; . "$1" >/dev/null; env -0',
      "dev-session",
      path,
    ],
    cwd: APP_ROOT,
  });
  return Object.fromEntries(
    output
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf("=");
        return [entry.slice(0, separator), entry.slice(separator + 1)];
      })
  );
}

function findSqliteDatabase({
  environment,
  primaryRoot,
}: {
  environment: NodeJS.ProcessEnv;
  primaryRoot: string;
}): string | null {
  if (process.env.PHOENIX_DEV_DATABASE_SOURCE)
    return resolve(process.env.PHOENIX_DEV_DATABASE_SOURCE);
  if (environment.PHOENIX_POSTGRES_HOST) return null;
  if (environment.PHOENIX_SQL_DATABASE_URL) {
    const match = environment.PHOENIX_SQL_DATABASE_URL.match(
      /^sqlite(?:\+[^:]+)?:\/\/\/([^?#]*)/
    );
    if (!match?.[1]) return null;
    return resolve(primaryRoot, "js", "app", decodeURIComponent(match[1]));
  }
  return join(
    resolve(environment.PHOENIX_WORKING_DIR ?? join(homedir(), ".phoenix")),
    "phoenix.db"
  );
}

async function seedDatabase({
  environmentPath,
  primaryRoot,
  targetPath,
}: {
  environmentPath: string;
  primaryRoot: string;
  targetPath: string;
}): Promise<void> {
  const isEnabled = !["0", "false", "no"].includes(
    (process.env.PHOENIX_DEV_SEED_DATABASE ?? "true").toLowerCase()
  );
  if (!isEnabled || existsSync(targetPath)) return;
  const sourcePath = findSqliteDatabase({
    environment: readEnvironment(environmentPath),
    primaryRoot,
  });
  if (!sourcePath || !existsSync(sourcePath)) {
    console.log("No primary SQLite database found; using empty session data.");
    return;
  }
  console.log(`Copying ${sourcePath} ...`);
  const temporaryPath = `${targetPath}.tmp`;
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    await backup(source, temporaryPath, { rate: 4096 });
    await rename(temporaryPath, targetPath);
  } finally {
    source.close();
    await rm(temporaryPath, { force: true });
  }
}

async function prepareSession(session: Session): Promise<void> {
  const primaryRoot = dirname(
    resolve(
      session.worktreePath,
      runGit({
        arguments_: ["rev-parse", "--git-common-dir"],
        cwd: session.worktreePath,
      })
    )
  );
  const directory = getSessionDirectory(session.id);
  const dataDirectory = getDataDirectory(session.id);
  const primaryEnvironment = join(directory, "primary.env");
  await Promise.all([
    mkdir(dataDirectory, { recursive: true }),
    mkdir(getLogDirectory(session.id), { recursive: true }),
  ]);
  if (!existsSync(primaryEnvironment)) {
    const source = join(primaryRoot, "js", "app", ".env");
    if (existsSync(source)) await copyFile(source, primaryEnvironment);
    else await writeFile(primaryEnvironment, "");
    await chmod(primaryEnvironment, 0o600);
  }
  await seedDatabase({
    environmentPath: primaryEnvironment,
    primaryRoot,
    targetPath: join(dataDirectory, "phoenix.db"),
  });
  const appUrl = getPortlessUrl({
    name: "phoenix",
    worktreePath: session.worktreePath,
  });
  const viteUrl = getPortlessUrl({
    name: "phoenix-vite",
    worktreePath: session.worktreePath,
  });
  const environment = [
    `test ! -f ${quoteShell(primaryEnvironment)} || source ${quoteShell(primaryEnvironment)}`,
    `test ! -f ${quoteShell(join(APP_ROOT, ".env"))} || source ${quoteShell(join(APP_ROOT, ".env"))}`,
    "unset PHOENIX_SQL_DATABASE_READ_REPLICA_URL PHOENIX_SQL_DATABASE_SCHEMA",
    "unset PHOENIX_POSTGRES_HOST PHOENIX_POSTGRES_PORT PHOENIX_POSTGRES_USER PHOENIX_POSTGRES_PASSWORD PHOENIX_POSTGRES_DB",
    "unset PHOENIX_HOST_ROOT_PATH PHOENIX_TLS_CERT_FILE PHOENIX_TLS_KEY_FILE PHOENIX_TLS_CA_FILE",
    "export PHOENIX_HOST=127.0.0.1",
    "export PHOENIX_TLS_ENABLED=false",
    "export PHOENIX_TLS_ENABLED_FOR_HTTP=false",
    "export PHOENIX_TLS_ENABLED_FOR_GRPC=false",
    `export PHOENIX_GRPC_PORT=${session.grpcPort}`,
    `export PHOENIX_WORKING_DIR=${quoteShell(dataDirectory)}`,
    `export PHOENIX_SQL_DATABASE_URL=${quoteShell(`sqlite:///${join(dataDirectory, "phoenix.db")}`)}`,
    `export PHOENIX_CHAT_LOG_DIR=${quoteShell(join(dataDirectory, "chat-logs"))}`,
    `export PHOENIX_ROOT_URL=${quoteShell(appUrl)}`,
    `export PHOENIX_COLLECTOR_ENDPOINT=${quoteShell(appUrl)}`,
    `export PHOENIX_DEV_VITE_URL=${quoteShell(viteUrl)}`,
    "",
  ].join("\n");
  await writeFile(getEnvironmentPath(session.id), environment, { mode: 0o600 });
}

async function startSession(): Promise<number> {
  if (!existsSync(PORTLESS) || !existsSync(MPROCS))
    throw new Error("Run `make install-node` before starting a dev session.");
  const identity = getIdentity();
  const existing = await readSession(identity.id);
  if (existing && (isRunning(existing) || hasReachableService(existing)))
    throw new Error(
      `This worktree is already running at ${getPortlessUrl({ name: "phoenix", worktreePath: identity.worktreePath })}`
    );
  const session: Session = {
    ...identity,
    pid: process.pid,
    controlPort: await getFreePort(),
    grpcPort: await getFreePort(),
    startedAt: new Date().toISOString(),
  };
  await prepareSession(session);
  await writeSession(session);
  const url = getPortlessUrl({
    name: "phoenix",
    worktreePath: session.worktreePath,
  });
  console.log(`\nPhoenix dev session ${session.id}`);
  console.log(`  app       ${url}`);
  console.log(`  data      ${getDataDirectory(session.id)}`);
  console.log(`  logs      ${getLogDirectory(session.id)}`);
  console.log(`  stop      make dev-sessions ARGS="stop ${session.id}"\n`);
  const child = spawn(
    MPROCS,
    [
      "--config",
      join(APP_ROOT, "mprocs.managed.yaml"),
      "--server",
      `127.0.0.1:${session.controlPort}`,
      "--log-dir",
      getLogDirectory(session.id),
    ],
    {
      cwd: APP_ROOT,
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        PHOENIX_DEV_ENV_FILE: getEnvironmentPath(session.id),
      },
      stdio: "inherit",
    }
  );
  let isStopping = false;
  const stop = (signal: NodeJS.Signals) => {
    if (isStopping) return;
    isStopping = true;
    try {
      sendMprocs(session, { c: "quit" });
    } catch {
      if (child.pid)
        process.kill(
          process.platform === "win32" ? child.pid : -child.pid,
          signal
        );
    }
  };
  const signals: NodeJS.Signals[] = ["SIGHUP", "SIGINT", "SIGTERM"];
  for (const signal of signals) process.once(signal, stop);
  try {
    return await new Promise<number>((resolveExit, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolveExit(code ?? 0));
    });
  } finally {
    for (const signal of signals) process.removeListener(signal, stop);
    try {
      stopPortlessServices(session);
    } finally {
      await writeSession({ ...session, pid: null });
    }
  }
}

function sendMprocs(session: Session, command: unknown): void {
  if (!isRunning(session)) throw new Error(`${session.id} is not running.`);
  run({
    command: MPROCS,
    arguments_: [
      "--server",
      `127.0.0.1:${session.controlPort}`,
      "--ctl",
      JSON.stringify(command),
    ],
    cwd: APP_ROOT,
  });
}

async function listSessions(): Promise<void> {
  const sessions = (await readSessions()).sort((left, right) =>
    right.startedAt.localeCompare(left.startedAt)
  );
  if (sessions.length === 0) return console.log("No Phoenix dev sessions.");
  for (const session of sessions) {
    const status = isRunning(session)
      ? "running"
      : hasReachableService(session)
        ? "orphaned"
        : "stopped";
    console.log(
      `${session.id}  ${status.padEnd(7)}  ${session.branch}  ${getPortlessUrl({ name: "phoenix", worktreePath: session.worktreePath })}`
    );
  }
}

async function printStatus(selector?: string): Promise<void> {
  const session = await selectSession(selector);
  const appUrl = getPortlessUrl({
    name: "phoenix",
    worktreePath: session.worktreePath,
  });
  const viteUrl = getPortlessUrl({
    name: "phoenix-vite",
    worktreePath: session.worktreePath,
  });
  const isApiReady = isReady(`${appUrl}/healthz`);
  const isFrontendReady = isReady(`${viteUrl}/@vite/client`);
  const status = isRunning(session)
    ? "running"
    : isApiReady || isFrontendReady
      ? "orphaned"
      : "stopped";
  console.log(`Phoenix dev session ${session.id}`);
  console.log(`  status    ${status}`);
  console.log(`  branch    ${session.branch}`);
  console.log(`  app       ${appUrl}`);
  console.log(`  api       ${isApiReady ? "ready" : "unavailable"}`);
  console.log(`  frontend  ${isFrontendReady ? "ready" : "unavailable"}`);
  console.log(`  logs      ${getLogDirectory(session.id)}`);
}

async function restartSession({
  target,
  selector,
}: {
  target: string;
  selector?: string;
}): Promise<void> {
  const session = await selectSession(selector);
  if (!["api", "backend", "frontend", "ui", "all"].includes(target))
    throw new Error("Restart target must be api, frontend, or all.");
  const index = target === "api" || target === "backend" ? 0 : 1;
  sendMprocs(
    session,
    target === "all"
      ? { c: "restart-all" }
      : {
          c: "batch",
          cmds: [{ c: "select-proc", index }, { c: "restart-proc" }],
        }
  );
  console.log(`Restarting ${target} for ${session.id}.`);
}

async function cleanSession(selector?: string): Promise<void> {
  const session = await selectSession(selector);
  if (isRunning(session))
    throw new Error(`Stop ${session.id} before cleaning it.`);
  const directory = getSessionDirectory(session.id);
  if (relative(STATE_ROOT, directory).startsWith(".."))
    throw new Error(`Refusing to remove unmanaged path ${directory}.`);
  stopPortlessServices(session);
  await rm(directory, { recursive: true });
  console.log(`Removed data and logs for ${session.id} (${session.branch}).`);
}

async function stopSessions(selector?: string): Promise<void> {
  const sessions =
    selector === "--all"
      ? await readSessions()
      : [await selectSession(selector)];
  for (const session of sessions) {
    if (isRunning(session)) {
      sendMprocs(session, { c: "quit" });
    } else {
      await writeSession({ ...session, pid: null });
    }
    stopPortlessServices(session);
    console.log(`Stopping ${session.id} (${session.branch})...`);
  }
}

async function runCommand(): Promise<number> {
  const [command = "list", ...arguments_] = process.argv.slice(2);
  switch (command) {
    case "start":
      return startSession();
    case "list":
      await listSessions();
      break;
    case "status":
      await printStatus(arguments_[0]);
      break;
    case "url": {
      const session = await selectSession(arguments_[0]);
      console.log(
        getPortlessUrl({
          name: "phoenix",
          worktreePath: session.worktreePath,
        })
      );
      break;
    }
    case "open": {
      const session = await selectSession(arguments_[0]);
      run({
        command: "open",
        arguments_: [
          getPortlessUrl({
            name: "phoenix",
            worktreePath: session.worktreePath,
          }),
        ],
      });
      break;
    }
    case "restart":
      await restartSession({
        target: arguments_[0] ?? "",
        selector: arguments_[1],
      });
      break;
    case "stop": {
      await stopSessions(arguments_[0]);
      break;
    }
    case "clean":
      await cleanSession(arguments_[0]);
      break;
    case "prune":
    case "doctor":
      run({ command: PORTLESS, arguments_: [command], inherit: true });
      break;
    default:
      throw new Error(`Unknown command "${command}".`);
  }
  return 0;
}

runCommand().then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error: unknown) => {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
);

/* eslint-disable no-console -- Terminal output is this CLI's public interface. */

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, openSync } from "node:fs";
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
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { createServer, type Server } from "node:net";
import { homedir } from "node:os";
import { delimiter, dirname, join, relative, resolve } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
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
const PORTLESS_STATE_DIR = resolve(
  process.env.PORTLESS_STATE_DIR ?? join(homedir(), ".portless")
);
/** Port Portless suggests when it cannot bind 443 without sudo. */
const UNPRIVILEGED_PROXY_PORT = 1355;
const MPROCS = join(APP_ROOT, "node_modules", ".bin", "mprocs");
const MINIMUM_NODE_MAJOR = 24;
const STALE_DATABASE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SIGNALS: NodeJS.Signals[] = ["SIGHUP", "SIGINT", "SIGTERM"];

type Session = {
  id: string;
  branch: string;
  worktreePath: string;
  pid: number | null;
  controlPort: number;
  grpcPort: number;
  debugpyPort: number | null;
  startedAt: string;
  databaseClonedAt: string | null;
  routes: { api: string; frontend: string };
};

type PortlessRoute = { hostname: string; pid?: number };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

function assertNodeVersion(): void {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < MINIMUM_NODE_MAJOR)
    throw new Error(
      `Node ${MINIMUM_NODE_MAJOR} or newer is required (see .nvmrc); this is Node ${process.versions.node}. Run \`nvm use\` first.`
    );
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
const getDatabasePath = (id: string) =>
  join(getDataDirectory(id), "phoenix.db");

async function readSession(id: string): Promise<Session | null> {
  try {
    const session = JSON.parse(
      await readFile(getSessionPath(id), "utf8")
    ) as Session;
    session.routes ??= getRoutes(session.id);
    session.debugpyPort ??= null;
    return session;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function readSessions(): Promise<Session[]> {
  let entries;
  try {
    entries = await readdir(STATE_ROOT, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const sessions: Session[] = [];
  for (const entry of entries) {
    // Finder drops .DS_Store here; a corrupt record must not block the rest.
    if (!entry.isDirectory()) continue;
    try {
      const session = await readSession(entry.name);
      if (session) sessions.push(session);
    } catch (error) {
      console.warn(
        `Skipping unreadable dev session ${join(STATE_ROOT, entry.name)}: ${getErrorMessage(error)}`
      );
    }
  }
  return sessions;
}

/**
 * @param params - Age formatting parameters.
 * @param params.clonedAt - Time when the database clone was created.
 * @param params.now - Reference time. Defaults to the current time.
 */
function getDatabaseAge({
  clonedAt,
  now = new Date(),
}: {
  clonedAt: string | null;
  now?: Date;
}): { ageMs: number; label: string } | null {
  if (!clonedAt) return null;
  const ageMs = Math.max(0, now.getTime() - Date.parse(clonedAt));
  const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
  const label =
    ageHours < 1
      ? "<1h"
      : ageHours < 48
        ? `${ageHours}h`
        : `${Math.floor(ageHours / 24)}d`;
  return { ageMs, label };
}

async function writeSession(session: Session): Promise<void> {
  const directory = getSessionDirectory(session.id);
  await mkdir(directory, { recursive: true });
  const temporaryPath = join(directory, `session.${process.pid}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(session, null, 2)}\n`);
  await rename(temporaryPath, getSessionPath(session.id));
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function isRunning(session: Session): boolean {
  return session.pid !== null && isProcessAlive(session.pid);
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
      Object.values(session.routes).includes(selector) ||
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

/**
 * Allocate distinct free loopback ports. All listeners stay open until every
 * port is chosen so the same port is never handed out twice.
 * @param count - Number of ports to allocate.
 */
async function getFreePorts(count: number): Promise<number[]> {
  const servers: Server[] = [];
  const ports: number[] = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = createServer();
      servers.push(server);
      ports.push(
        await new Promise<number>((resolvePort, reject) => {
          server.once("error", reject);
          server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (!address || typeof address === "string")
              return reject(new Error("Could not allocate a local port."));
            resolvePort(address.port);
          });
        })
      );
    }
  } finally {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolveClose) =>
            server.close(() => resolveClose())
          )
      )
    );
  }
  return ports;
}

function getRoutes(id: string): Session["routes"] {
  return { api: `phoenix-${id}`, frontend: `phoenix-vite-${id}` };
}

function getPortlessUrl(name: string): string {
  return run({
    command: PORTLESS,
    arguments_: ["get", name, "--no-worktree"],
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
    isReady(`${getPortlessUrl(session.routes.api)}/healthz`) ||
    isReady(`${getPortlessUrl(session.routes.frontend)}/@vite/client`)
  );
}

async function readProxyPort(): Promise<number | null> {
  try {
    const port = parseInt(
      await readFile(join(PORTLESS_STATE_DIR, "proxy.port"), "utf8"),
      10
    );
    return Number.isNaN(port) ? null : port;
  } catch {
    return null;
  }
}

function probeProxy({ port, tls }: { port: number; tls: boolean }) {
  return new Promise<boolean>((resolveProbe) => {
    const request = (tls ? httpsRequest : httpRequest)(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        method: "HEAD",
        timeout: 1000,
        ...(tls ? { rejectUnauthorized: false } : {}),
      },
      (response) => {
        response.resume();
        resolveProbe(response.headers["x-portless"] === "1");
      }
    );
    request.on("error", () => resolveProbe(false));
    request.on("timeout", () => {
      request.destroy();
      resolveProbe(false);
    });
    request.end();
  });
}

async function isProxyRunning(): Promise<boolean> {
  const port = await readProxyPort();
  if (port === null) return false;
  return (
    (await probeProxy({ port, tls: true })) ||
    (await probeProxy({ port, tls: false }))
  );
}

/**
 * Portless needs sudo to bind 443 and refuses without a TTY, which is how
 * agents and CI shells run this command. Start it on the unprivileged port
 * instead so `start` never blocks on an interactive prompt.
 */
async function ensureProxy(): Promise<void> {
  if (await isProxyRunning()) return;
  console.log(
    `Starting the Portless proxy on port ${UNPRIVILEGED_PROXY_PORT} (no sudo needed). For URLs without a port, run \`sudo portless proxy start --https\` once instead.`
  );
  run({
    command: PORTLESS,
    arguments_: [
      "proxy",
      "start",
      "--port",
      String(UNPRIVILEGED_PROXY_PORT),
      "--https",
    ],
    inherit: true,
  });
  if (!(await isProxyRunning()))
    throw new Error(
      'The Portless proxy did not start. Run `make dev-sessions ARGS="doctor"`.'
    );
}

async function readPortlessRoutes(): Promise<PortlessRoute[]> {
  try {
    const routes: unknown = JSON.parse(
      await readFile(join(PORTLESS_STATE_DIR, "routes.json"), "utf8")
    );
    return Array.isArray(routes) ? (routes as PortlessRoute[]) : [];
  } catch {
    return [];
  }
}

/**
 * Release this session's Portless routes without spawning a Portless command,
 * so stop and clean keep working while the proxy is down. A live route owner
 * is the Portless CLI wrapping our process; SIGTERM makes it stop its child
 * and remove its own route. Dead owners are left for `portless prune`.
 */
async function releaseRoutes(session: Session): Promise<void> {
  const names = Object.values(session.routes);
  const routes = (await readPortlessRoutes()).filter((route) =>
    names.some(
      (name) => route.hostname === name || route.hostname.startsWith(`${name}.`)
    )
  );
  let hasStaleRoutes = false;
  for (const route of routes) {
    if (route.pid && isProcessAlive(route.pid)) {
      try {
        process.kill(route.pid, "SIGTERM");
      } catch {
        hasStaleRoutes = true;
      }
    } else {
      hasStaleRoutes = true;
    }
  }
  if (!hasStaleRoutes) return;
  try {
    run({ command: PORTLESS, arguments_: ["prune"] });
  } catch (error) {
    console.warn(
      `Could not prune stale Portless routes: ${getErrorMessage(error)}`
    );
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
  // Same precedence as phoenix.config: an explicit URL wins over Postgres vars.
  if (environment.PHOENIX_SQL_DATABASE_URL) {
    const match = environment.PHOENIX_SQL_DATABASE_URL.match(
      /^sqlite(?:\+[^:]+)?:\/\/\/([^?#]*)/
    );
    if (!match?.[1]) return null;
    return resolve(primaryRoot, "js", "app", decodeURIComponent(match[1]));
  }
  if (environment.PHOENIX_POSTGRES_HOST) return null;
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
}): Promise<boolean> {
  const isEnabled = !["0", "false", "no"].includes(
    (process.env.PHOENIX_DEV_SEED_DATABASE ?? "true").toLowerCase()
  );
  if (!isEnabled || existsSync(targetPath)) return false;
  const sourcePath = findSqliteDatabase({
    environment: readEnvironment(environmentPath),
    primaryRoot,
  });
  if (!sourcePath || !existsSync(sourcePath)) {
    console.log("No primary SQLite database found; using empty session data.");
    return false;
  }
  console.log(`Copying ${sourcePath} ...`);
  const temporaryPath = `${targetPath}.tmp`;
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    await backup(source, temporaryPath, { rate: 4096 });
    await rename(temporaryPath, targetPath);
    return true;
  } finally {
    source.close();
    await rm(temporaryPath, { force: true });
  }
}

function getPrimaryRoot(session: Session): string {
  return dirname(
    resolve(
      session.worktreePath,
      runGit({
        arguments_: ["rev-parse", "--git-common-dir"],
        cwd: session.worktreePath,
      })
    )
  );
}

/** Slow, port-independent setup: directories, the config snapshot, and the database clone. */
async function prepareSessionState(session: Session): Promise<boolean> {
  const primaryRoot = getPrimaryRoot(session);
  const directory = getSessionDirectory(session.id);
  const primaryEnvironment = join(directory, "primary.env");
  await Promise.all([
    mkdir(getDataDirectory(session.id), { recursive: true }),
    mkdir(getLogDirectory(session.id), { recursive: true }),
  ]);
  if (!existsSync(primaryEnvironment)) {
    const source = join(primaryRoot, "js", "app", ".env");
    if (existsSync(source)) await copyFile(source, primaryEnvironment);
    else await writeFile(primaryEnvironment, "");
    await chmod(primaryEnvironment, 0o600);
  }
  return seedDatabase({
    environmentPath: primaryEnvironment,
    primaryRoot,
    targetPath: getDatabasePath(session.id),
  });
}

/** Write env.sh with this start's ports and URLs. Session-owned values always win over inherited ones. */
async function writeEnvironmentFile(session: Session): Promise<void> {
  const dataDirectory = getDataDirectory(session.id);
  const primaryEnvironment = join(
    getSessionDirectory(session.id),
    "primary.env"
  );
  const appUrl = getPortlessUrl(session.routes.api);
  const viteUrl = getPortlessUrl(session.routes.frontend);
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
    `export DEBUGPY_PORT=${session.debugpyPort}`,
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

function spawnMprocs({
  session,
  headless,
}: {
  session: Session;
  headless: boolean;
}) {
  const mprocsArguments = [
    "--config",
    join(APP_ROOT, "mprocs.managed.yaml"),
    "--server",
    `127.0.0.1:${session.controlPort}`,
    "--log-dir",
    getLogDirectory(session.id),
  ];
  const env = {
    ...process.env,
    PHOENIX_DEV_ENV_FILE: getEnvironmentPath(session.id),
    PHOENIX_DEV_API_NAME: session.routes.api,
    PHOENIX_DEV_FRONTEND_NAME: session.routes.frontend,
    PHOENIX_DEV_NODE: process.execPath,
  };
  if (!headless)
    return spawn(MPROCS, mprocsArguments, {
      cwd: APP_ROOT,
      detached: process.platform !== "win32",
      env,
      stdio: "inherit",
    });
  if (process.platform === "win32")
    throw new Error("Run `make dev-session` from a terminal on Windows.");
  // mprocs is a TUI and exits without a TTY, so give it a pseudo-terminal via
  // `script`. A zero-size window makes it panic, hence the explicit stty.
  const command = `stty rows 50 cols 200 2>/dev/null; exec ${quoteShell(MPROCS)} ${mprocsArguments.map(quoteShell).join(" ")}`;
  const scriptArguments =
    process.platform === "darwin"
      ? ["-q", "/dev/null", "/bin/sh", "-c", command]
      : ["-q", "-e", "-c", command, "/dev/null"];
  const tuiLog = openSync(join(getLogDirectory(session.id), "mprocs.log"), "a");
  return spawn("script", scriptArguments, {
    cwd: APP_ROOT,
    detached: true,
    env,
    stdio: ["ignore", tuiLog, tuiLog],
  });
}

async function startSession(): Promise<number> {
  assertNodeVersion();
  if (!existsSync(PORTLESS) || !existsSync(MPROCS))
    throw new Error("Run `make install-node` before starting a dev session.");
  const identity = getIdentity();
  const existing = await readSession(identity.id);
  if (existing && (isRunning(existing) || hasReachableService(existing)))
    throw new Error(
      `This worktree is already running at ${getPortlessUrl(existing.routes.api)}`
    );
  await ensureProxy();
  const startedAt = new Date().toISOString();
  const preparedSession: Session = {
    ...identity,
    routes: getRoutes(identity.id),
    pid: process.pid,
    controlPort: 0,
    grpcPort: 0,
    debugpyPort: null,
    startedAt,
    databaseClonedAt: existing?.databaseClonedAt ?? null,
  };
  const didCloneDatabase = await prepareSessionState(preparedSession);
  // Ports are allocated after the (possibly slow) database clone so the window
  // in which another process could grab them before mprocs binds is short.
  const [controlPort, grpcPort, debugpyPort] = await getFreePorts(3);
  const session: Session = {
    ...preparedSession,
    controlPort: controlPort as number,
    grpcPort: grpcPort as number,
    debugpyPort: debugpyPort as number,
    databaseClonedAt: didCloneDatabase
      ? startedAt
      : preparedSession.databaseClonedAt,
  };
  await writeEnvironmentFile(session);
  await writeSession(session);
  const headless = !process.stdin.isTTY;
  console.log(`\nPhoenix dev session ${session.id}`);
  console.log(`  app       ${getPortlessUrl(session.routes.api)}`);
  console.log(`  debugpy   127.0.0.1:${session.debugpyPort}`);
  console.log(`  data      ${getDataDirectory(session.id)}`);
  console.log(`  logs      ${getLogDirectory(session.id)}`);
  console.log(`  stop      make dev-sessions ARGS="stop ${session.id}"`);
  if (headless)
    console.log(
      `  headless  no TTY; the process list is hidden, use make dev-sessions ARGS="status ${session.id}"`
    );
  console.log("");
  const child = spawnMprocs({ session, headless });
  let isStopping = false;
  const signalChild = (signal: NodeJS.Signals) => {
    try {
      if (child.pid)
        process.kill(
          process.platform === "win32" ? child.pid : -child.pid,
          signal
        );
    } catch {
      // Already gone; the close handler below finishes the cleanup.
    }
  };
  const stop = (signal: NodeJS.Signals) => {
    if (isStopping) {
      // A repeated signal during graceful shutdown escalates instead of killing
      // this supervisor before it can release routes and clear the pid.
      signalChild(signal);
      return;
    }
    isStopping = true;
    try {
      sendMprocs(session, { c: "quit" });
    } catch {
      signalChild(signal);
    }
  };
  for (const signal of SIGNALS) process.on(signal, stop);
  try {
    return await new Promise<number>((resolveExit, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolveExit(code ?? 0));
    });
  } finally {
    for (const signal of SIGNALS) process.removeListener(signal, stop);
    try {
      await releaseRoutes(session);
    } finally {
      await writeSession({ ...session, pid: null });
    }
  }
}

/**
 * Entry point mprocs runs once per process (see mprocs.managed.yaml). It
 * wraps the API or Vite in a Portless route and maps the assigned port onto
 * the variables Phoenix and Vite expect.
 * @param target - Which process to run: api or frontend.
 */
async function execProcess(target: string): Promise<number> {
  const environmentPath = process.env.PHOENIX_DEV_ENV_FILE;
  const name =
    target === "api"
      ? process.env.PHOENIX_DEV_API_NAME
      : target === "frontend"
        ? process.env.PHOENIX_DEV_FRONTEND_NAME
        : undefined;
  if (!environmentPath || !name)
    throw new Error(
      "exec is started by mprocs from a dev session; run `make dev-session` instead."
    );
  const script =
    target === "api"
      ? 'export PHOENIX_PORT="$PORT"; exec uv run python -Xfrozen_modules=off -m debugpy --listen "127.0.0.1:${DEBUGPY_PORT:?}" -m phoenix.server.main serve --dev --debug'
      : 'export VITE_PORT="$PORT" VITE_HOST="$HOST"; pnpm run build:static && pnpm run build:relay && exec vite';
  const environment = readEnvironment(environmentPath);
  const child = spawn(
    PORTLESS,
    ["--name", name, "--force", "/bin/sh", "-c", script],
    {
      cwd: APP_ROOT,
      env: {
        ...process.env,
        ...environment,
        // Same node as this supervisor, plus the workspace binaries (vite, pnpm).
        PATH: [
          dirname(process.execPath),
          join(APP_ROOT, "node_modules", ".bin"),
          join(REPOSITORY_ROOT, "js", "node_modules", ".bin"),
          environment.PATH ?? process.env.PATH ?? "",
        ].join(delimiter),
      },
      stdio: "inherit",
    }
  );
  const forward = (signal: NodeJS.Signals) => {
    try {
      child.kill(signal);
    } catch {
      // Already exited.
    }
  };
  for (const signal of SIGNALS) process.on(signal, forward);
  return new Promise<number>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) =>
      resolveExit(code ?? (signal ? 1 : 0))
    );
  });
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
    const databaseAge = getDatabaseAge({
      clonedAt: session.databaseClonedAt,
    });
    const database = databaseAge ? `db ${databaseAge.label}` : "no db clone";
    console.log(
      `${session.id}  ${status.padEnd(8)}  ${database.padEnd(11)}  ${session.branch}  ${getPortlessUrl(session.routes.api)}`
    );
  }
}

async function printStatus(selector?: string): Promise<void> {
  const session = await selectSession(selector);
  const appUrl = getPortlessUrl(session.routes.api);
  const viteUrl = getPortlessUrl(session.routes.frontend);
  const isApiReady = isReady(`${appUrl}/healthz`);
  const isFrontendReady = isReady(`${viteUrl}/@vite/client`);
  const databaseAge = getDatabaseAge({
    clonedAt: session.databaseClonedAt,
  });
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
  console.log(
    `  debugpy   ${status === "running" && session.debugpyPort ? `127.0.0.1:${session.debugpyPort}` : "unavailable"}`
  );
  console.log(
    `  database  ${databaseAge ? `cloned ${databaseAge.label} ago` : "no primary database clone"}`
  );
  console.log(`  logs      ${getLogDirectory(session.id)}`);
  if (databaseAge && databaseAge.ageMs > STALE_DATABASE_AGE_MS) {
    const cleanupStep = status === "stopped" ? "run" : "stop it, then run";
    console.log(
      `  cleanup   clone is over 7d old; ${cleanupStep} make dev-sessions ARGS="clean ${session.id}" if it is no longer needed`
    );
  }
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
  await releaseRoutes(session);
  await rm(directory, { recursive: true });
  console.log(`Removed data and logs for ${session.id} (${session.branch}).`);
}

async function stopSessions(selector?: string): Promise<void> {
  const sessions =
    selector === "--all"
      ? await readSessions()
      : [await selectSession(selector)];
  let failures = 0;
  for (const session of sessions) {
    try {
      if (isRunning(session)) {
        sendMprocs(session, { c: "quit" });
      } else {
        await writeSession({ ...session, pid: null });
      }
      await releaseRoutes(session);
      console.log(`Stopping ${session.id} (${session.branch})...`);
    } catch (error) {
      failures += 1;
      console.error(
        `Could not stop ${session.id} (${session.branch}): ${getErrorMessage(error)}`
      );
    }
  }
  if (failures > 0) throw new Error(`${failures} session(s) failed to stop.`);
}

async function runCommand(): Promise<number> {
  const [command = "list", ...arguments_] = process.argv.slice(2);
  switch (command) {
    case "start":
      return startSession();
    case "exec":
      return execProcess(arguments_[0] ?? "");
    case "list":
      await listSessions();
      break;
    case "status":
      await printStatus(arguments_[0]);
      break;
    case "url": {
      const session = await selectSession(arguments_[0]);
      console.log(getPortlessUrl(session.routes.api));
      break;
    }
    case "open": {
      const session = await selectSession(arguments_[0]);
      run({
        command: "open",
        arguments_: [getPortlessUrl(session.routes.api)],
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
    console.error(`Error: ${getErrorMessage(error)}`);
    process.exitCode = 1;
  }
);

import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCommand } from "./command";

export async function withTemporaryPostgres<Result>(
  work: (databaseUrl: string) => Promise<Result>
): Promise<Result> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not allocate a Postgres port.");
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  const directory = mkdtempSync(join(tmpdir(), "factory-message-service-"));
  const getBinary = (name: string): string =>
    process.env.POSTGRES_BIN ? join(process.env.POSTGRES_BIN, name) : name;
  let hasStarted = false;
  try {
    runCommand({
      command: getBinary("initdb"),
      args: [
        "-D",
        directory,
        "-A",
        "trust",
        "-U",
        "postgres",
        "--encoding=UTF8",
        "--no-locale",
      ],
    });
    runCommand({
      command: getBinary("pg_ctl"),
      args: [
        "-D",
        directory,
        "-l",
        join(directory, "server.log"),
        "-o",
        `-p ${port} -h 127.0.0.1 -k ${directory}`,
        "-w",
        "start",
      ],
    });
    hasStarted = true;
    return await work(
      `postgresql://postgres@127.0.0.1:${port}/postgres?sslmode=disable`
    );
  } finally {
    if (hasStarted) {
      runCommand({
        command: getBinary("pg_ctl"),
        args: ["-D", directory, "-m", "immediate", "-w", "stop"],
      });
    }
    rmSync(directory, { recursive: true, force: true });
  }
}

import { spawnSync } from "node:child_process";

export function runCommand({
  command,
  args,
  env = process.env,
}: {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}): void {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed.`);
}

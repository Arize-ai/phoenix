import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ENV_FILE_NAME,
  writeEnvFile,
} from "../../src/setup/steps/writeEnvFile";
import { fakeRunContext } from "./fakes";

const CONNECTION = {
  endpoint: "https://phoenix.example.com",
  projectName: "my-app",
};

const NOW = Date.UTC(2026, 6, 8, 12, 0, 0);

describe("writeEnvFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "px-setup-env-file-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function deps() {
    return {
      context: fakeRunContext({ cwd: dir }),
      clock: { now: () => NOW, sleep: async () => {} },
    };
  }

  it("writes the env file with mode 0600", () => {
    const result = writeEnvFile(
      deps(),
      { ...CONNECTION, apiKey: "sk-secret" },
      { isGitRepository: false }
    );
    const mode = fs.statSync(result.envFilePath).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("emits SDK env var names, with the key line when auth is on", () => {
    writeEnvFile(
      deps(),
      { ...CONNECTION, apiKey: "sk-secret" },
      { isGitRepository: false }
    );
    const env = fs.readFileSync(path.join(dir, ENV_FILE_NAME), "utf-8");
    expect(env).toContain(
      'PHOENIX_COLLECTOR_ENDPOINT="https://phoenix.example.com"'
    );
    expect(env).toContain('PHOENIX_PROJECT_NAME="my-app"');
    expect(env).toContain('PHOENIX_API_KEY="sk-secret"');
    expect(env).toContain("do NOT commit");
  });

  it("quotes values so `source` survives spaces and shell metacharacters", () => {
    writeEnvFile(
      deps(),
      {
        endpoint: "https://phoenix.example.com",
        projectName: 'My App "v2" $HOME `id`',
      },
      { isGitRepository: false }
    );
    const env = fs.readFileSync(path.join(dir, ENV_FILE_NAME), "utf-8");
    expect(env).toContain(
      'PHOENIX_PROJECT_NAME="My App \\"v2\\" \\$HOME \\`id\\`"'
    );
  });

  it("omits the key line entirely when auth is off", () => {
    writeEnvFile(deps(), CONNECTION, { isGitRepository: false });
    const env = fs.readFileSync(path.join(dir, ENV_FILE_NAME), "utf-8");
    expect(env).not.toContain("PHOENIX_API_KEY");
  });

  it("gitignores the env file in a repo", () => {
    const result = writeEnvFile(deps(), CONNECTION, {
      isGitRepository: true,
    });
    expect(result.gitignoreAppended).toEqual([ENV_FILE_NAME]);
    const gitignore = fs.readFileSync(path.join(dir, ".gitignore"), "utf-8");
    expect(gitignore).toContain(ENV_FILE_NAME);
  });
});

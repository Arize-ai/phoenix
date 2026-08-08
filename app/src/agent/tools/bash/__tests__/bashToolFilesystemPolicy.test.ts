import { createBashToolRuntime } from "@phoenix/agent/tools/bash/bashToolRuntime";

describe("bash tool filesystem policy", () => {
  it("discards writes redirected to /dev/null without aborting the command", async () => {
    const runtime = await createBashToolRuntime();

    const result = await runtime.executeCommand(
      "printf 'noise' >/dev/null 2>&1; printf 'done'"
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("done");
    expect(result.stderr).toBe("");
  });

  it("discards appends to /dev/null and never persists content there", async () => {
    const runtime = await createBashToolRuntime();

    const result = await runtime.executeCommand(
      "printf 'a' >>/dev/null; printf 'b' >>/dev/null; cat /dev/null; printf 'ok'"
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("ok");
  });

  it("allows writes to /tmp", async () => {
    const runtime = await createBashToolRuntime();

    const result = await runtime.executeCommand(
      "printf 'help' > /tmp/help && cat /tmp/help"
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("help");
  });

  it("still blocks writes outside scratch directories", async () => {
    const runtime = await createBashToolRuntime();

    await expect(
      runtime.executeCommand("printf 'nope' > /etc/passwd")
    ).rejects.toThrow("Writes outside scratch directories are blocked");
  });

  it("still allows workspace writes", async () => {
    const runtime = await createBashToolRuntime();

    const result = await runtime.executeCommand(
      "printf 'ok' > /home/user/workspace/note.txt && cat /home/user/workspace/note.txt"
    );

    expect(result.stdout).toContain("ok");
  });
});

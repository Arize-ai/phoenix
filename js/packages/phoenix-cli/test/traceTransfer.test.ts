import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Readable } from "stream";
import { HttpResponse } from "@arizeai/phoenix-testing";
import type * as ClackPrompts from "@clack/prompts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { confirmMock } = vi.hoisted(() => ({ confirmMock: vi.fn() }));

vi.mock("@clack/prompts", async (importOriginal) => ({
  ...(await importOriginal<typeof ClackPrompts>()),
  confirm: confirmMock,
}));

import { formatTraceTransferOutput } from "../src/commands/formatTraceTransfer";
import { createTraceCommand } from "../src/commands/trace";
import { ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES } from "../src/confirm";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const TRACE_ID_A = "0123456789abcdef0123456789abcdef";
const TRACE_ID_B = "VHJhY2U6Mg==";
const DESTINATION = "production";
const DESTINATION_ID = "UHJvamVjdDoy";
const TRANSFER_ARGS = [
  "transfer",
  TRACE_ID_A,
  TRACE_ID_B,
  "--to",
  DESTINATION,
  ...BASE_ARGS,
  "--yes",
];

let tmpDir: string;
const originalIsTTY = process.stdin.isTTY;
const originalStdin = Object.getOwnPropertyDescriptor(process, "stdin");

function setStdinIsTTY(value: boolean | undefined) {
  Object.defineProperty(process.stdin, "isTTY", {
    value,
    configurable: true,
  });
}

function setStdin(text: string) {
  Object.defineProperty(process, "stdin", {
    value: Readable.from([text]),
    configurable: true,
  });
}

beforeEach(() => {
  // Keep a developer's real `~/.px/settings.json` out of config resolution.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-transfer-test-"));
  vi.stubEnv("XDG_CONFIG_HOME", tmpDir);
  // transferTraces checks the server version before calling the route.
  mock.server.use(
    http.get("/arize_phoenix_version", ({ response }) =>
      response.untyped(new Response("20.4.0", { status: 200 }))
    )
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  confirmMock.mockReset();
  if (originalStdin) {
    Object.defineProperty(process, "stdin", originalStdin);
  }
  setStdinIsTTY(originalIsTTY);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Register a POST /v1/traces/transfer handler that records each request body
 * and answers with the given transferred count.
 */
function captureTransfer({ count }: { count?: number } = {}) {
  const captured: {
    calls: number;
    traceIdentifiers?: string[];
    destinationProjectIdentifier?: string;
  } = { calls: 0 };
  mock.server.use(
    http.post("/v1/traces/transfer", async ({ request, response }) => {
      const body = await request.json();
      captured.calls += 1;
      captured.traceIdentifiers = body.trace_identifiers;
      captured.destinationProjectIdentifier =
        body.destination_project_identifier;
      return response(200).json({
        data: {
          transferred_trace_count: count ?? body.trace_identifiers.length,
          destination_project_id: DESTINATION_ID,
        },
      });
    })
  );
  return captured;
}

function respondToTransfer(status: number, message: string) {
  mock.server.use(
    http.post("/v1/traces/transfer", ({ response }) =>
      response.untyped(new HttpResponse(message, { status }))
    )
  );
}

async function runTransfer(args: string[]) {
  await createTraceCommand().parseAsync(args, { from: "user" });
}

describe("trace transfer", () => {
  it("posts repeated trace IDs and the destination, and prints a raw record", async () => {
    const captured = captureTransfer();
    const io = captureCliOutput();

    await runTransfer([...TRANSFER_ARGS, "--format", "raw"]);

    expect(captured.calls).toBe(1);
    expect(captured.traceIdentifiers).toEqual([TRACE_ID_A, TRACE_ID_B]);
    expect(captured.destinationProjectIdentifier).toBe(DESTINATION);
    expect(io.stdout).toHaveBeenCalledTimes(1);
    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      JSON.stringify({
        transferred_trace_count: 2,
        destination_project_identifier: DESTINATION,
        destination_project_id: DESTINATION_ID,
      })
    );
  });

  it("prints indented JSON with --format json", async () => {
    captureTransfer();
    const io = captureCliOutput();

    await runTransfer([...TRANSFER_ARGS, "--format", "json"]);

    expect(JSON.parse(io.stdout.mock.calls[0]?.[0] as string)).toEqual({
      transferred_trace_count: 2,
      destination_project_identifier: DESTINATION,
      destination_project_id: DESTINATION_ID,
    });
    expect(io.stdout.mock.calls[0]?.[0]).toContain("\n");
  });

  it("prints a human-readable summary by default", async () => {
    captureTransfer();
    const io = captureCliOutput();

    await runTransfer(TRANSFER_ARGS);

    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      `Transferred 2 traces to project ${DESTINATION} (${DESTINATION_ID}).`
    );
  });

  it("accepts a project GlobalID as the destination", async () => {
    const captured = captureTransfer();
    const io = captureCliOutput();

    await runTransfer([
      "transfer",
      TRACE_ID_A,
      "--to",
      DESTINATION_ID,
      ...BASE_ARGS,
      "--yes",
    ]);

    expect(captured.destinationProjectIdentifier).toBe(DESTINATION_ID);
    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      `Transferred 1 trace to project ${DESTINATION_ID}.`
    );
  });

  it("reads trace IDs from --file, merged with arguments and de-duplicated", async () => {
    const captured = captureTransfer();
    captureCliOutput();
    const idsFile = path.join(tmpDir, "trace-ids.txt");
    fs.writeFileSync(idsFile, `${TRACE_ID_B}\n\n  ${TRACE_ID_A}  \nabc123\n`);

    await runTransfer([
      "transfer",
      TRACE_ID_A,
      "--file",
      idsFile,
      "--to",
      DESTINATION,
      ...BASE_ARGS,
      "--yes",
    ]);

    expect(captured.traceIdentifiers).toEqual([
      TRACE_ID_A,
      TRACE_ID_B,
      "abc123",
    ]);
  });

  it("reads trace IDs from stdin with --file -", async () => {
    const captured = captureTransfer();
    captureCliOutput();
    setStdin(`${TRACE_ID_A}\n${TRACE_ID_B}\n`);

    await runTransfer([
      "transfer",
      "--file",
      "-",
      "--to",
      DESTINATION,
      ...BASE_ARGS,
      "--yes",
    ]);

    expect(captured.traceIdentifiers).toEqual([TRACE_ID_A, TRACE_ID_B]);
  });

  it("exits INVALID_ARGUMENT before any request when the --file path does not exist", async () => {
    const captured = captureTransfer();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      runTransfer([
        "transfer",
        "--file",
        path.join(tmpDir, "missing.txt"),
        "--to",
        DESTINATION,
        ...BASE_ARGS,
        "--yes",
      ])
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringMatching(/^Error transferring traces: .*missing\.txt/)
    );
    expect(captured.calls).toBe(0);
  });

  it("exits INVALID_ARGUMENT before any request when no trace IDs are given", async () => {
    const captured = captureTransfer();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();
    const idsFile = path.join(tmpDir, "empty.txt");
    fs.writeFileSync(idsFile, "\n  \n");

    await expect(
      runTransfer([
        "transfer",
        "--file",
        idsFile,
        "--to",
        DESTINATION,
        ...BASE_ARGS,
        "--yes",
      ])
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringContaining("at least one trace ID")
    );
    expect(captured.calls).toBe(0);
  });

  it("rejects a missing --to before any request", async () => {
    const captured = captureTransfer();
    captureCliOutput();
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    mockProcessExit();

    await expect(
      runTransfer(["transfer", TRACE_ID_A, ...BASE_ARGS, "--yes"])
    ).rejects.toThrow("process.exit:");

    expect(stderrWrite).toHaveBeenCalledWith(
      expect.stringContaining("required option '--to <project>' not specified")
    );
    expect(captured.calls).toBe(0);
  });

  it("exits INVALID_ARGUMENT and reports the server detail when traces come from multiple projects", async () => {
    respondToTransfer(422, "Cannot transfer traces from multiple projects");
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(runTransfer(TRANSFER_ARGS)).rejects.toThrow(
      `process.exit:${ExitCode.INVALID_ARGUMENT}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(io.stdout).not.toHaveBeenCalled();
    expect(io.stderr).toHaveBeenCalledWith(
      "Error transferring traces: HTTP 422: Cannot transfer traces from multiple projects"
    );
  });

  it.each([
    ["a trace", "One or more traces not found"],
    ["the destination project", "Project with name production not found"],
  ])(
    "exits FAILURE and reports the server detail when %s is missing",
    async (_missing, message) => {
      respondToTransfer(404, message);
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(runTransfer(TRANSFER_ARGS)).rejects.toThrow(
        `process.exit:${ExitCode.FAILURE}`
      );

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
      expect(io.stdout).not.toHaveBeenCalled();
      expect(io.stderr).toHaveBeenCalledWith(
        `Error transferring traces: HTTP 404: ${message}`
      );
    }
  );

  it.each([401, 403])(
    "exits AUTH_REQUIRED when the server responds %i",
    async (status) => {
      respondToTransfer(status, "Forbidden");
      captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(runTransfer(TRANSFER_ARGS)).rejects.toThrow(
        `process.exit:${ExitCode.AUTH_REQUIRED}`
      );

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.AUTH_REQUIRED);
    }
  );

  it("exits FAILURE on an unexpected server error", async () => {
    respondToTransfer(500, "Internal Server Error");
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(runTransfer(TRANSFER_ARGS)).rejects.toThrow(
      `process.exit:${ExitCode.FAILURE}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringMatching(/^Error transferring traces: HTTP 500/)
    );
  });

  it("exits NETWORK_ERROR when the connection fails", async () => {
    mock.server.use(
      http.post("/v1/traces/transfer", () => HttpResponse.error())
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(runTransfer(TRANSFER_ARGS)).rejects.toThrow(
      `process.exit:${ExitCode.NETWORK_ERROR}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
    expect(io.stdout).not.toHaveBeenCalled();
  });

  it("exits FAILURE without calling the route when the server is too old", async () => {
    mock.server.use(
      http.get("/arize_phoenix_version", ({ response }) =>
        response.untyped(new Response("20.3.0", { status: 200 }))
      )
    );
    const captured = captureTransfer();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(runTransfer(TRANSFER_ARGS)).rejects.toThrow(
      `process.exit:${ExitCode.FAILURE}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringContaining("requires Phoenix server >= 20.4.0")
    );
    expect(captured.calls).toBe(0);
  });

  it("asks for confirmation without --yes and transfers once confirmed", async () => {
    const captured = captureTransfer();
    captureCliOutput();
    setStdinIsTTY(true);
    confirmMock.mockResolvedValue(true);

    await runTransfer([
      "transfer",
      TRACE_ID_A,
      "--to",
      DESTINATION,
      ...BASE_ARGS,
    ]);

    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Transfer 1 trace to project ${DESTINATION}? It will no longer appear in its current project.`,
      })
    );
    expect(captured.calls).toBe(1);
  });

  it("exits CANCELLED without calling the API when confirmation is declined", async () => {
    const captured = captureTransfer();
    captureCliOutput();
    setStdinIsTTY(true);
    confirmMock.mockResolvedValue(false);
    const exitSpy = mockProcessExit();

    await expect(
      runTransfer([
        "transfer",
        TRACE_ID_A,
        TRACE_ID_B,
        "--to",
        DESTINATION,
        ...BASE_ARGS,
      ])
    ).rejects.toThrow("process.exit:");

    // The mocked exit throws, so the handler's catch exits again; the first
    // call is the one a real process would stop at.
    expect(exitSpy).toHaveBeenNthCalledWith(1, ExitCode.CANCELLED);
    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Transfer 2 traces to project ${DESTINATION}? They will no longer appear in their current project.`,
      })
    );
    expect(captured.calls).toBe(0);
  });

  it("exits INVALID_ARGUMENT without --yes when stdin is not a TTY", async () => {
    const captured = captureTransfer();
    captureCliOutput();
    setStdinIsTTY(false);
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const exitSpy = mockProcessExit();

    await expect(
      runTransfer(["transfer", TRACE_ID_A, "--to", DESTINATION, ...BASE_ARGS])
    ).rejects.toThrow("process.exit:");

    // The mocked exit throws, so the handler's catch exits again; the first
    // call is the one a real process would stop at.
    expect(exitSpy).toHaveBeenNthCalledWith(1, ExitCode.INVALID_ARGUMENT);
    expect(stderrWrite).toHaveBeenCalledWith(
      expect.stringContaining("Use --yes to skip confirmation")
    );
    expect(confirmMock).not.toHaveBeenCalled();
    expect(captured.calls).toBe(0);
  });

  it("does not require the delete gate", async () => {
    vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "false");
    const captured = captureTransfer();
    captureCliOutput();

    await runTransfer(TRANSFER_ARGS);

    expect(captured.calls).toBe(1);
  });
});

describe("formatTraceTransferOutput", () => {
  const result = {
    transferred_trace_count: 3,
    destination_project_identifier: DESTINATION,
    destination_project_id: DESTINATION_ID,
  };

  it("defaults to pretty output", () => {
    expect(formatTraceTransferOutput({ result })).toBe(
      `Transferred 3 traces to project ${DESTINATION} (${DESTINATION_ID}).`
    );
  });

  it("omits the GlobalID when the destination was given as one", () => {
    expect(
      formatTraceTransferOutput({
        result: {
          transferred_trace_count: 1,
          destination_project_identifier: DESTINATION_ID,
          destination_project_id: DESTINATION_ID,
        },
      })
    ).toBe(`Transferred 1 trace to project ${DESTINATION_ID}.`);
  });

  it("renders compact JSON for raw", () => {
    expect(formatTraceTransferOutput({ result, format: "raw" })).toBe(
      JSON.stringify(result)
    );
  });

  it("renders indented JSON for json", () => {
    expect(formatTraceTransferOutput({ result, format: "json" })).toBe(
      JSON.stringify(result, null, 2)
    );
  });
});

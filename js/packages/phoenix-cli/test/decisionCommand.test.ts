import type { componentsV1 } from "@arizeai/phoenix-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ConfirmModule from "../src/confirm";

vi.mock("../src/confirm", async (importOriginal) => {
  const originalModule = await importOriginal<typeof ConfirmModule>();
  return {
    ...originalModule,
    confirmOrExit: vi.fn().mockResolvedValue(undefined),
  };
});

import { createDecisionCommand } from "../src/commands/decision";
import { formatDecisionOutput } from "../src/commands/formatDecision";
import { formatDecisionsOutput } from "../src/commands/formatDecisions";
import {
  confirmOrExit,
  ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES,
} from "../src/confirm";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import {
  BASE_ARGS,
  captureCliOutput,
  mockProcessExit,
  recordRequests,
} from "./testUtils";

const mock = setupMockPhoenixServer();

type Decision = componentsV1["schemas"]["Decision"];
type DecisionVersion = componentsV1["schemas"]["DecisionVersion"];

const DECISION_ID = "RGVjaXNpb246MQ==";
const VERSION_ID = "RGVjaXNpb25WZXJzaW9uOjQ=";

function decision(index: number): Decision {
  return {
    id: `RGVjaXNpb246${index}`,
    name: `decision-${index}`,
    description: index === 1 ? "Routes support tickets" : null,
    metadata: {},
    created_at: "2026-11-01T00:00:00+00:00",
    updated_at: "2026-11-02T00:00:00+00:00",
  };
}

const VERSION: DecisionVersion = {
  id: VERSION_ID,
  decision_id: DECISION_ID,
  decision_name: "ticket-triage",
  version_number: 4,
  tag_names: ["production"],
  description: "newer model",
  metadata: {},
  template_format: "MUSTACHE",
  state: {
    type: "json",
    template: { ticket: "{{ticket}}", plan: "{{customer.plan}}" },
  },
  questions: [
    {
      type: "predicate",
      name: "urgent",
      instructions: "Is this ticket urgent?",
      criteria: { true: "Customer is blocked", false: "Can wait" },
    },
    {
      type: "choice",
      name: "team",
      instructions: "Which team owns it?",
      choices: [
        { value: "billing" },
        { value: "technical", description: "Bugs and outages" },
      ],
    },
    {
      type: "scale",
      name: "severity",
      instructions: "How severe for a {{customer.plan}} customer?",
      levels: [{ label: "low" }, { label: "medium" }, { label: "high" }],
    },
  ],
  variables: ["ticket", "customer"],
  model_provider: "TYPESAFE",
  model_name: "tev1",
  created_at: "2026-11-02T00:00:00+00:00",
};

function problem(status: number, code: string, detail: string, extra = {}) {
  return new Response(
    JSON.stringify({
      type: `urn:phoenix:problem:${code}`,
      title: code,
      status,
      detail,
      code,
      ...extra,
    }),
    { status, headers: { "content-type": "application/problem+json" } }
  );
}

async function run(args: string[]) {
  await createDecisionCommand().parseAsync(args, { from: "user" });
}

function stdoutJson(io: ReturnType<typeof captureCliOutput>): unknown {
  return JSON.parse(String(io.stdout.mock.calls.at(-1)?.[0]));
}

function stderrJson(io: ReturnType<typeof captureCliOutput>): {
  code: string;
  hint?: string;
  problem_code?: string;
  problem_reason?: string;
  problem?: { detail: string };
} {
  return JSON.parse(String(io.stderr.mock.calls.at(-1)?.[0]));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("decision list", () => {
  it("follows the cursor, forwards the filters, and prints raw JSON", async () => {
    const queries: URLSearchParams[] = [];
    mock.server.use(
      http.get("/v1/decisions", ({ request, response }) => {
        const query = new URL(request.url).searchParams;
        queries.push(query);
        return query.get("cursor")
          ? response(200).json({ data: [decision(1)], next_cursor: null })
          : response(200).json({
              data: [decision(3), decision(2)],
              next_cursor: "RGVjaXNpb246MQ==",
            });
      })
    );
    const io = captureCliOutput();
    await run([
      "list",
      ...BASE_ARGS,
      "--name",
      "triage",
      "--label",
      "support",
      "--label",
      "RGVjaXNpb25MYWJlbDoy",
      "--format",
      "raw",
    ]);
    expect((stdoutJson(io) as Decision[]).map((item) => item.name)).toEqual([
      "decision-3",
      "decision-2",
      "decision-1",
    ]);
    expect(queries).toHaveLength(2);
    expect(queries[0]?.get("name")).toBe("triage");
    // Names and IDs pass through as given; the server resolves either.
    expect(queries[0]?.getAll("label")).toEqual([
      "support",
      "RGVjaXNpb25MYWJlbDoy",
    ]);
    expect(queries[1]?.get("cursor")).toBe("RGVjaXNpb246MQ==");
  });

  it("caps the result at --limit without fetching another page", async () => {
    const limits: (string | null)[] = [];
    mock.server.use(
      http.get("/v1/decisions", ({ request, response }) => {
        limits.push(new URL(request.url).searchParams.get("limit"));
        return response(200).json({
          data: [decision(3), decision(2)],
          next_cursor: "RGVjaXNpb246MQ==",
        });
      })
    );
    const io = captureCliOutput();
    await run(["list", ...BASE_ARGS, "--limit", "2", "--format", "raw"]);
    expect((stdoutJson(io) as Decision[]).length).toBe(2);
    expect(limits).toEqual(["2"]);
  });

  it("says so when there are no decisions", async () => {
    mock.server.use(
      http.get("/v1/decisions", ({ response }) =>
        response(200).json({ data: [], next_cursor: null })
      )
    );
    const io = captureCliOutput();
    await run(["list", ...BASE_ARGS]);
    expect(io.stdout.mock.calls.at(-1)?.[0]).toBe("No decisions found");
  });

  it("rejects a non-positive --limit before contacting the server", async () => {
    const requests = recordRequests(mock.server);
    const exit = mockProcessExit();
    const io = captureCliOutput();
    await expect(
      run(["list", ...BASE_ARGS, "--limit", "0", "--format", "raw"])
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
    expect(exit).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(stderrJson(io).code).toBe("INVALID_ARGUMENT");
    expect(requests).toEqual([]);
  });

  it("rejects an invalid --format before contacting the server", async () => {
    const requests = recordRequests(mock.server);
    mockProcessExit();
    captureCliOutput();
    await expect(
      run(["list", ...BASE_ARGS, "--format", "yaml"])
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
    expect(requests).toEqual([]);
  });

  it("works against the generated handlers alone", async () => {
    const io = captureCliOutput();
    await run(["list", ...BASE_ARGS, "--limit", "3", "--format", "raw"]);
    expect(Array.isArray(stdoutJson(io))).toBe(true);
  });
});

describe("decision get", () => {
  it("shows the latest version by default", async () => {
    const paths: string[] = [];
    mock.server.use(
      http.get(
        "/v1/decisions/{decision_identifier}/latest",
        ({ params, response }) => {
          paths.push(params.decision_identifier);
          return response(200).json({ data: VERSION });
        }
      )
    );
    const io = captureCliOutput();
    await run(["get", "ticket-triage", ...BASE_ARGS, "--format", "raw"]);
    expect(stdoutJson(io)).toEqual(VERSION);
    expect(paths).toEqual(["ticket-triage"]);
  });

  it("shows the version a --tag points to", async () => {
    const tags: string[] = [];
    mock.server.use(
      http.get(
        "/v1/decisions/{decision_identifier}/tags/{tag_name}",
        ({ params, response }) => {
          tags.push(params.tag_name);
          return response(200).json({ data: VERSION });
        }
      )
    );
    const io = captureCliOutput();
    await run([
      "get",
      "ticket-triage",
      ...BASE_ARGS,
      "--tag",
      "production",
      "--format",
      "json",
    ]);
    expect(stdoutJson(io)).toEqual(VERSION);
    expect(tags).toEqual(["production"]);
  });

  it.each([["ticket-triage"], [DECISION_ID]])(
    "shows a --version that belongs to %s",
    async (identifier) => {
      mock.server.use(
        http.get(
          "/v1/decision_versions/{decision_version_id}",
          ({ response }) => response(200).json({ data: VERSION })
        )
      );
      const io = captureCliOutput();
      await run([
        "get",
        identifier,
        ...BASE_ARGS,
        "--version",
        VERSION_ID,
        "--format",
        "raw",
      ]);
      expect(stdoutJson(io)).toEqual(VERSION);
    }
  );

  it("refuses a --version that belongs to another decision", async () => {
    mock.server.use(
      http.get("/v1/decision_versions/{decision_version_id}", ({ response }) =>
        response(200).json({ data: VERSION })
      )
    );
    mockProcessExit();
    const io = captureCliOutput();
    await expect(
      run([
        "get",
        "refund-check",
        ...BASE_ARGS,
        "--version",
        VERSION_ID,
        "--format",
        "raw",
      ])
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
    expect(io.stdout).not.toHaveBeenCalled();
    const error = stderrJson(io);
    expect(error.code).toBe("INVALID_ARGUMENT");
    expect(error.hint).toBe(
      `px decision get ticket-triage --version ${VERSION_ID}`
    );
  });

  it("rejects --tag with --version before contacting the server", async () => {
    const requests = recordRequests(mock.server);
    mockProcessExit();
    const io = captureCliOutput();
    await expect(
      run([
        "get",
        "ticket-triage",
        ...BASE_ARGS,
        "--tag",
        "production",
        "--version",
        VERSION_ID,
        "--format",
        "raw",
      ])
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
    expect(stderrJson(io).code).toBe("INVALID_ARGUMENT");
    expect(requests).toEqual([]);
  });

  it("exits FAILURE with the server's explanation for an unknown tag", async () => {
    mock.server.use(
      http.get(
        "/v1/decisions/{decision_identifier}/tags/{tag_name}",
        ({ response }) =>
          response.untyped(
            problem(
              404,
              "not_found",
              "No version of decision 'ticket-triage' is tagged 'nightly'"
            )
          )
      )
    );
    mockProcessExit();
    const io = captureCliOutput();
    await expect(
      run([
        "get",
        "ticket-triage",
        ...BASE_ARGS,
        "--tag",
        "nightly",
        "--format",
        "raw",
      ])
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);
    const error = stderrJson(io);
    expect(error.problem_code).toBe("not_found");
    expect(error.problem?.detail).toContain("tagged 'nightly'");
  });
});

describe("decision delete", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES];
    process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES] = "true";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES];
    } else {
      process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES] = originalEnv;
    }
  });

  it("DELETEs the decision after confirming", async () => {
    const deleted: string[] = [];
    mock.server.use(
      http.delete(
        "/v1/decisions/{decision_identifier}",
        ({ params, response }) => {
          deleted.push(params.decision_identifier);
          return response(204).empty();
        }
      )
    );
    captureCliOutput();
    await run(["delete", "ticket-triage", ...BASE_ARGS, "--yes"]);
    expect(deleted).toEqual(["ticket-triage"]);
    expect(confirmOrExit).toHaveBeenCalledWith(
      expect.objectContaining({ yes: true })
    );
  });

  it("exits INVALID_ARGUMENT when deletes are not enabled", async () => {
    delete process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES];
    const requests = recordRequests(mock.server);
    mockProcessExit();
    captureCliOutput();
    await expect(
      run(["delete", "ticket-triage", ...BASE_ARGS, "--yes"])
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
    expect(requests).toEqual([]);
  });

  it("does not delete when the confirmation is declined", async () => {
    // The real confirmOrExit exits CANCELLED when the user declines.
    vi.mocked(confirmOrExit).mockImplementationOnce(() =>
      process.exit(ExitCode.CANCELLED)
    );
    const requests = recordRequests(mock.server);
    const exit = mockProcessExit();
    captureCliOutput();
    await expect(
      run(["delete", "ticket-triage", ...BASE_ARGS])
    ).rejects.toThrow();
    expect(exit.mock.calls[0]).toEqual([ExitCode.CANCELLED]);
    expect(requests).toEqual([]);
  });

  it("prints the evaluator refusal as structured JSON in raw mode", async () => {
    mock.server.use(
      http.delete("/v1/decisions/{decision_identifier}", ({ response }) =>
        response.untyped(
          problem(
            409,
            "conflict",
            "This decision is referenced by an evaluator (native-judge); delete it first",
            { reason: "referenced_by_evaluator" }
          )
        )
      )
    );
    mockProcessExit();
    const io = captureCliOutput();
    await expect(
      run(["delete", "ticket-triage", ...BASE_ARGS, "--yes", "--format", "raw"])
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);
    const error = stderrJson(io);
    expect(error.problem_code).toBe("conflict");
    expect(error.problem_reason).toBe("referenced_by_evaluator");
    expect(error.problem?.detail).toContain("native-judge");
  });

  it("exits FAILURE for a decision that does not exist", async () => {
    mock.server.use(
      http.delete("/v1/decisions/{decision_identifier}", ({ response }) =>
        response.untyped(problem(404, "not_found", "Decision not found: nope"))
      )
    );
    mockProcessExit();
    const io = captureCliOutput();
    await expect(
      run(["delete", "nope", ...BASE_ARGS, "--yes", "--format", "raw"])
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);
    expect(stderrJson(io).problem_code).toBe("not_found");
  });
});

describe("decision formatters", () => {
  it("renders a version's state, questions, tags, and variables", () => {
    const output = formatDecisionOutput({ decisionVersion: VERSION });
    expect(output).toContain("Decision: ticket-triage (version 4)");
    expect(output).toContain("Model: TYPESAFE / tev1");
    expect(output).toContain("Tags: production");
    expect(output).toContain("Variables: ticket, customer");
    expect(output).toContain('"plan": "{{customer.plan}}"');
    expect(output).toContain("urgent (predicate)");
    expect(output).toContain("true: Customer is blocked");
    expect(output).toContain("- technical: Bugs and outages");
    expect(output).toContain("2. high");
  });

  it("names a question type it does not know instead of dropping it", () => {
    const output = formatDecisionOutput({
      decisionVersion: {
        ...VERSION,
        questions: [
          { type: "box", name: "region", instructions: "Where?" },
        ] as unknown as DecisionVersion["questions"],
      },
    });
    expect(output).toContain("region (box)");
    expect(output).toContain("upgrade @arizeai/phoenix-cli");
  });

  it("renders json and raw verbatim", () => {
    expect(
      JSON.parse(
        formatDecisionOutput({ decisionVersion: VERSION, format: "raw" })
      )
    ).toEqual(VERSION);
    expect(
      formatDecisionsOutput({ decisions: [decision(1)], format: "json" })
    ).toBe(JSON.stringify([decision(1)], null, 2));
  });

  it("lists decisions in a table", () => {
    const output = formatDecisionsOutput({ decisions: [decision(1)] });
    expect(output).toContain("decision-1");
    expect(output).toContain("Routes support tickets");
  });
});

import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../src/cli";
import * as config from "../src/config";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

type DatasetLabel = componentsV1["schemas"]["DatasetLabel"];

const GOLDEN_LABEL: DatasetLabel = {
  id: "RGF0YXNldExhYmVsOjE=",
  name: "golden",
  description: "Curated evaluation datasets",
  color: "#00cc88",
};
const REGRESSION_LABEL: DatasetLabel = {
  id: "RGF0YXNldExhYmVsOjI=",
  name: "regression",
  description: null,
  color: "#cc8800",
};
const mock = setupMockPhoenixServer();

beforeEach(() => {
  mock.server.use(
    http.get("/arize_phoenix_version", ({ response }) =>
      response.untyped(new Response("17.16.0"))
    )
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function runCommand({ args }: { args: string[] }): Promise<void> {
  const program = createProgram();
  program.configureOutput({ writeErr: () => {} });
  for (const command of program.commands) {
    command.exitOverride();
    for (const subcommand of command.commands) {
      subcommand.exitOverride().configureOutput({ writeErr: () => {} });
    }
  }
  await program.parseAsync(["dataset-labels", ...args, ...BASE_ARGS], {
    from: "user",
  });
}

describe("dataset-labels", () => {
  it.each(["support-eval", "RGF0YXNldDox", "cafe", "support eval"])(
    "passes dataset identifier %s directly to the assignment endpoint",
    async (datasetIdentifier) => {
      const receivedIdentifiers: string[] = [];
      const resolveDataset = vi.fn();
      mock.server.use(
        http.get("/v1/datasets", ({ response }) => {
          resolveDataset();
          return response(200).json({ data: [], next_cursor: null });
        }),
        http.get(
          "/v1/datasets/{dataset_identifier}/labels",
          ({ params, response }) => {
            receivedIdentifiers.push(params.dataset_identifier);
            return response(200).json({ data: [GOLDEN_LABEL] });
          }
        )
      );
      const io = captureCliOutput();
      await runCommand({
        args: ["list", "--dataset", datasetIdentifier, "--format", "raw"],
      });
      expect(receivedIdentifiers).toEqual([datasetIdentifier]);
      expect(resolveDataset).not.toHaveBeenCalled();
      expect(io.stdout).toHaveBeenCalledWith(JSON.stringify([GOLDEN_LABEL]));
      expect(io.stderr).not.toHaveBeenCalled();
    }
  );

  it.each(["pretty", "json", "raw"] as const)(
    "lists labels in %s format",
    async (format) => {
      mock.server.use(
        http.get("/v1/datasets/{dataset_identifier}/labels", ({ response }) =>
          response(200).json({ data: [GOLDEN_LABEL, REGRESSION_LABEL] })
        )
      );
      const io = captureCliOutput();
      await runCommand({
        args: ["list", "--dataset", "support-eval", "--format", format],
      });
      const output = String(io.stdout.mock.calls[0]?.[0]);
      if (format === "pretty") {
        expect(output).toContain(GOLDEN_LABEL.name);
        expect(output).toContain(REGRESSION_LABEL.id);
        expect(output).toContain(GOLDEN_LABEL.color);
        expect(output).toContain(GOLDEN_LABEL.description);
        expect(output).not.toContain("null");
      } else {
        expect(output).toBe(
          JSON.stringify(
            [GOLDEN_LABEL, REGRESSION_LABEL],
            null,
            format === "json" ? 2 : undefined
          )
        );
      }
    }
  );

  it.each(["pretty", "json", "raw"] as const)(
    "handles an empty label list in %s format",
    async (format) => {
      mock.server.use(
        http.get("/v1/datasets/{dataset_identifier}/labels", ({ response }) =>
          response(200).json({ data: [] })
        )
      );
      const io = captureCliOutput();
      await runCommand({
        args: ["list", "--dataset", "support-eval", "--format", format],
      });
      expect(io.stdout).toHaveBeenCalledWith(
        format === "pretty" ? "No dataset labels assigned" : "[]"
      );
    }
  );

  it.each(["pretty", "json", "raw"] as const)(
    "adds the same label twice and prints the returned label in %s format",
    async (format) => {
      const requests: unknown[] = [];
      mock.server.use(
        http.put(
          "/v1/datasets/{dataset_identifier}/labels/{label_id}",
          ({ params, response }) => {
            requests.push(params);
            return response(200).json({ data: GOLDEN_LABEL });
          }
        )
      );
      const io = captureCliOutput();
      const args = [
        "add",
        "--dataset",
        "RGF0YXNldDox",
        "--label",
        GOLDEN_LABEL.id,
        "--format",
        format,
      ];
      await runCommand({ args });
      await runCommand({ args });
      expect(requests).toEqual([
        { dataset_identifier: "RGF0YXNldDox", label_id: GOLDEN_LABEL.id },
        { dataset_identifier: "RGF0YXNldDox", label_id: GOLDEN_LABEL.id },
      ]);
      expect(io.stdout).toHaveBeenCalledTimes(2);
      const output = String(io.stdout.mock.calls[0]?.[0]);
      if (format === "pretty") {
        expect(output).toContain(GOLDEN_LABEL.name);
      } else {
        expect(JSON.parse(output)).toEqual(GOLDEN_LABEL);
      }
      expect(io.stderr).not.toHaveBeenCalled();
    }
  );

  it.each(["pretty", "json", "raw"] as const)(
    "removes the same assignment twice with empty 204 responses in %s format",
    async (format) => {
      const requests: unknown[] = [];
      mock.server.use(
        http.delete(
          "/v1/datasets/{dataset_identifier}/labels/{label_id}",
          ({ params, response }) => {
            requests.push(params);
            return response(204).empty();
          }
        )
      );
      const io = captureCliOutput();
      const args = [
        "remove",
        "--dataset",
        "support-eval",
        "--label",
        GOLDEN_LABEL.id,
        "--format",
        format,
      ];
      await runCommand({ args });
      await runCommand({ args });
      expect(requests).toEqual([
        { dataset_identifier: "support-eval", label_id: GOLDEN_LABEL.id },
        { dataset_identifier: "support-eval", label_id: GOLDEN_LABEL.id },
      ]);
      expect(io.stdout).toHaveBeenCalledTimes(2);
      const output = String(io.stdout.mock.calls[0]?.[0]);
      if (format === "pretty") {
        expect(output).toContain(GOLDEN_LABEL.id);
        expect(output).toContain("support-eval");
      } else {
        expect(JSON.parse(output)).toEqual({
          dataset_identifier: "support-eval",
          label_id: GOLDEN_LABEL.id,
        });
      }
      expect(io.stderr).not.toHaveBeenCalled();
    }
  );

  it.each(["pretty", "json", "raw"] as const)(
    "replaces labels from repeatable flags in %s format",
    async (format) => {
      let receivedBody: unknown;
      mock.server.use(
        http.put(
          "/v1/datasets/{dataset_identifier}/labels",
          async ({ params, request, response }) => {
            expect(params.dataset_identifier).toBe("support-eval");
            receivedBody = await request.json();
            return response(200).json({ data: [REGRESSION_LABEL] });
          }
        )
      );
      const io = captureCliOutput();
      await runCommand({
        args: [
          "replace",
          "--dataset",
          "support-eval",
          "--label",
          GOLDEN_LABEL.id,
          "--label",
          REGRESSION_LABEL.id,
          "--format",
          format,
        ],
      });
      expect(receivedBody).toEqual({
        dataset_label_ids: [GOLDEN_LABEL.id, REGRESSION_LABEL.id],
      });
      const output = String(io.stdout.mock.calls[0]?.[0]);
      if (format === "pretty") {
        expect(output).toContain(REGRESSION_LABEL.name);
        expect(output).not.toContain(GOLDEN_LABEL.name);
      } else {
        expect(JSON.parse(output)).toEqual([REGRESSION_LABEL]);
      }
    }
  );

  it.each(["pretty", "json", "raw"] as const)(
    "clears assignments explicitly in %s format",
    async (format) => {
      let receivedBody: unknown;
      mock.server.use(
        http.put(
          "/v1/datasets/{dataset_identifier}/labels",
          async ({ request, response }) => {
            receivedBody = await request.json();
            return response(200).json({ data: [] });
          }
        )
      );
      const io = captureCliOutput();
      await runCommand({
        args: [
          "replace",
          "--dataset",
          "support-eval",
          "--clear",
          "--format",
          format,
        ],
      });
      expect(receivedBody).toEqual({ dataset_label_ids: [] });
      expect(io.stdout).toHaveBeenCalledWith(
        format === "pretty" ? "No dataset labels assigned" : "[]"
      );
    }
  );

  it.each([
    ["list"],
    ["list", "--dataset", " "],
    ["add", "--dataset", "support-eval"],
    ["add", "--dataset", "support-eval", "--label", " "],
    [
      "add",
      "--dataset",
      "support-eval",
      "--label",
      GOLDEN_LABEL.id,
      "--label",
      REGRESSION_LABEL.id,
    ],
    ["remove", "--dataset", "support-eval"],
    ["replace", "--dataset", "support-eval"],
    ["replace", "--dataset", "support-eval", "--label", " "],
    [
      "replace",
      "--dataset",
      "support-eval",
      "--clear",
      "--label",
      GOLDEN_LABEL.id,
    ],
  ])(
    "rejects invalid input %j before making HTTP requests",
    async (...args) => {
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();
      const requests: string[] = [];
      mock.server.events.on("request:start", ({ request }) =>
        requests.push(request.url)
      );
      try {
        await expect(
          runCommand({ args: [...args, "--format", "raw"] })
        ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
        expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
        expect(requests).toEqual([]);
        expect(io.stdout).not.toHaveBeenCalled();
        expect(JSON.parse(String(io.stderr.mock.calls[0]?.[0]))).toMatchObject({
          code: "INVALID_ARGUMENT",
        });
      } finally {
        mock.server.events.removeAllListeners("request:start");
      }
    }
  );

  it("rejects an unsupported output format", async () => {
    await expect(
      runCommand({
        args: ["list", "--dataset", "support-eval", "--format", "csv"],
      })
    ).rejects.toThrow(/Allowed choices/);
  });

  it.each([
    ["list", "get", "/v1/datasets/{dataset_identifier}/labels", []],
    [
      "add",
      "put",
      "/v1/datasets/{dataset_identifier}/labels/{label_id}",
      ["--label", GOLDEN_LABEL.id],
    ],
    [
      "remove",
      "delete",
      "/v1/datasets/{dataset_identifier}/labels/{label_id}",
      ["--label", GOLDEN_LABEL.id],
    ],
    ["replace", "put", "/v1/datasets/{dataset_identifier}/labels", ["--clear"]],
  ] as const)(
    "reports %s HTTP failures",
    async (operation, method, path, extraArgs) => {
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();
      for (const status of [401, 403, 404, 422, 500]) {
        io.stderr.mockClear();
        mock.server.use(
          http[method](path, ({ response }) =>
            response.untyped(
              Response.json(
                { detail: `${operation} failed: resource not found` },
                { status }
              )
            )
          )
        );
        const expectedExit =
          status === 401 || status === 403
            ? ExitCode.AUTH_REQUIRED
            : status === 422
              ? ExitCode.INVALID_ARGUMENT
              : ExitCode.FAILURE;
        await expect(
          runCommand({
            args: [
              operation,
              "--dataset",
              "support-eval",
              ...extraArgs,
              "--format",
              "raw",
            ],
          })
        ).rejects.toThrow(`process.exit:${expectedExit}`);
        expect(exitSpy).toHaveBeenLastCalledWith(expectedExit);
        const error = JSON.parse(String(io.stderr.mock.calls[0]?.[0]));
        expect(error.error).toContain(String(status));
        expect(error.error).toContain(
          `${operation} failed: resource not found`
        );
        expect(error.code).toBe(
          status === 401 || status === 403
            ? "AUTH_REQUIRED"
            : status === 422
              ? "INVALID_ARGUMENT"
              : "FAILURE"
        );
      }
      expect(io.stdout).not.toHaveBeenCalled();
    }
  );

  it.each(["pretty", "json", "raw"] as const)(
    "preserves actionable HTTP details and falls back for HTML or empty bodies in %s mode",
    async (format) => {
      const io = captureCliOutput();
      mockProcessExit();
      const responses = [
        {
          body: JSON.stringify({
            detail: 'Dataset with name "typo" not found',
          }),
          expected: 'Dataset with name "typo" not found',
        },
        {
          body: JSON.stringify({ detail: "Dataset label not found" }),
          expected: "Dataset label not found",
        },
        {
          body: JSON.stringify({
            detail: [
              {
                loc: ["path", "label_id"],
                msg: "Invalid DatasetLabel ID",
                type: "value_error",
              },
            ],
          }),
          expected: "Invalid DatasetLabel ID",
        },
        {
          body: "Invalid dataset label ID: invalid",
          contentType: "text/plain; charset=utf-8",
          expected: "Invalid dataset label ID: invalid",
        },
        {
          body: "<html>Internal server error</html>",
          contentType: "text/html",
          expected: "Phoenix returned HTTP 404",
        },
        { body: "", expected: "Phoenix returned HTTP 404" },
      ];
      for (const { body, contentType, expected } of responses) {
        io.stderr.mockClear();
        mock.server.use(
          http.get("/v1/datasets/{dataset_identifier}/labels", ({ response }) =>
            response.untyped(
              new Response(body, {
                status: 404,
                headers: { "Content-Type": contentType ?? "application/json" },
              })
            )
          )
        );
        await expect(
          runCommand({
            args: ["list", "--dataset", "typo", "--format", format],
          })
        ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);
        const output = String(io.stderr.mock.calls[0]?.[0]);
        const message = format === "pretty" ? output : JSON.parse(output).error;
        expect(message).toContain(expected);
        expect(message).not.toContain("<html>");
      }
      expect(io.stdout).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["list"],
    ["add", "--label", GOLDEN_LABEL.id],
    ["remove", "--label", GOLDEN_LABEL.id],
    ["replace", "--clear"],
  ])(
    "blocks %j on unsupported servers before assignment requests",
    async (...args) => {
      mock.server.use(
        http.get("/arize_phoenix_version", ({ response }) =>
          response.untyped(new Response("17.15.0"))
        )
      );
      const io = captureCliOutput();
      mockProcessExit();
      const requests: string[] = [];
      mock.server.events.on("request:start", ({ request }) =>
        requests.push(new URL(request.url).pathname)
      );
      try {
        await expect(
          runCommand({
            args: [...args, "--dataset", "support-eval", "--format", "raw"],
          })
        ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);
        expect(requests).toEqual(["/arize_phoenix_version"]);
        expect(String(io.stderr.mock.calls[0]?.[0])).toContain(
          "requires Phoenix server >= 17.16.0"
        );
      } finally {
        mock.server.events.removeAllListeners("request:start");
      }
    }
  );

  it("reports network failures without writing success output", async () => {
    mock.server.use(
      http.get("/v1/datasets/{dataset_identifier}/labels", () =>
        HttpResponse.error()
      )
    );
    const io = captureCliOutput();
    mockProcessExit();
    await expect(
      runCommand({
        args: ["list", "--dataset", "support-eval", "--format", "raw"],
      })
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);
    expect(JSON.parse(String(io.stderr.mock.calls[0]?.[0]))).toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(io.stdout).not.toHaveBeenCalled();
  });

  it("reports invalid config without requiring a project", async () => {
    vi.spyOn(config, "validateConfig").mockReturnValue({
      valid: false,
      errors: ["Invalid endpoint"],
    });
    const io = captureCliOutput();
    mockProcessExit();
    await expect(
      runCommand({
        args: ["list", "--dataset", "support-eval", "--format", "raw"],
      })
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
    expect(config.validateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ projectRequired: false })
    );
    expect(JSON.parse(String(io.stderr.mock.calls[0]?.[0]))).toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });

  it("forwards authentication and endpoint overrides", async () => {
    let receivedAuthorization: string | null = null;
    mock.server.use(
      http.get(
        "/v1/datasets/{dataset_identifier}/labels",
        ({ request, response }) => {
          receivedAuthorization = request.headers.get("Authorization");
          return response(200).json({ data: [] });
        }
      )
    );
    captureCliOutput();
    await runCommand({
      args: [
        "list",
        "--dataset",
        "support-eval",
        "--api-key",
        "test-key",
        "--format",
        "raw",
      ],
    });
    expect(receivedAuthorization).toBe("Bearer test-key");
  });

  it("registers the group with discoverable help and examples", () => {
    const command = createProgram().commands.find(
      (entry) => entry.name() === "dataset-labels"
    );
    expect(command).toBeDefined();
    expect(command?.commands.map((entry) => entry.name())).toEqual([
      "list",
      "add",
      "remove",
      "replace",
    ]);
    const replace = command?.commands.find(
      (entry) => entry.name() === "replace"
    );
    let help = "";
    replace?.configureOutput({
      writeOut: (text: string) => {
        help += text;
      },
    });
    replace?.outputHelp();
    expect(help).toContain("--clear");
    expect(help).toContain("px dataset-labels replace");
    expect(help).toContain("global label");
    expect(help).toContain("GET /v1/dataset_labels");
    expect(help).toContain("px api graphql");
    expect(help).toContain("datasetLabels");
  });
});

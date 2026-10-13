import { beforeEach, describe, expect, it, vi } from "vitest";

const relayMocks = vi.hoisted(() => ({
  commitMutation: vi.fn(),
  graphql: vi.fn((strings: TemplateStringsArray) => strings.join("")),
}));

vi.mock("relay-runtime", () => ({
  commitMutation: relayMocks.commitMutation,
  graphql: relayMocks.graphql,
}));

import type { Environment } from "relay-runtime";

import { createProjectLlmEvaluator } from "@phoenix/pages/project/evaluators/createProjectLlmEvaluator";

type MutationConfig = {
  variables: { input: Record<string, unknown> };
  onCompleted: (
    response: unknown,
    errors: readonly { message: string }[] | null
  ) => void;
  onError: (error: Error) => void;
};

const environment = {} as Environment;
const input = {
  name: "hallucination",
} as unknown as Parameters<typeof createProjectLlmEvaluator>[0]["input"];

function lastMutationConfig(): MutationConfig {
  const call = relayMocks.commitMutation.mock.calls.at(-1);
  expect(call).toBeDefined();
  return call![1] as MutationConfig;
}

describe("createProjectLlmEvaluator", () => {
  beforeEach(() => {
    relayMocks.commitMutation.mockReset();
  });

  it("resolves with the created evaluator", async () => {
    const pending = createProjectLlmEvaluator({ environment, input });
    lastMutationConfig().onCompleted(
      {
        createProjectLlmEvaluator: {
          evaluator: { id: "ProjectEvaluator:1", name: "hallucination" },
        },
      },
      null
    );
    await expect(pending).resolves.toEqual({
      id: "ProjectEvaluator:1",
      name: "hallucination",
    });
  });

  it("rejects with only the GraphQL error messages from a Relay network error", async () => {
    const pending = createProjectLlmEvaluator({ environment, input });
    // Relay's fetch function wraps the GraphQL errors together with the full
    // mutation variables (the whole prompt template, tools, and so on).
    lastMutationConfig().onError(
      new Error(
        `Error fetching GraphQL query 'createProjectLlmEvaluatorMutation' with variables '{"input":{"name":"hallucination","description":"Detect whether an assistant's response contains hallucinations","enabled":true}}': [{"message":"A project evaluator with this name already exists for this project","locations":[{"line":4,"column":3}],"path":["createProjectLlmEvaluator"]}]`
      )
    );
    await expect(pending).rejects.toThrow(
      /^A project evaluator with this name already exists for this project$/
    );
  });

  it("falls back to the raw message when the error carries no GraphQL messages", async () => {
    const pending = createProjectLlmEvaluator({ environment, input });
    lastMutationConfig().onError(
      new Error("GraphQL request failed with status 502 Bad Gateway")
    );
    await expect(pending).rejects.toThrow(
      /^GraphQL request failed with status 502 Bad Gateway$/
    );
  });

  it("rejects with the messages of errors returned alongside the response", async () => {
    const pending = createProjectLlmEvaluator({ environment, input });
    lastMutationConfig().onCompleted(null, [
      { message: "first" },
      { message: "second" },
    ]);
    await expect(pending).rejects.toThrow(/^first\nsecond$/);
  });
});

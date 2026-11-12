import { describe, expect, it, vi } from "vitest";

import type { EvaluatorInputMapping } from "@phoenix/types";

import {
  applyProjectEvaluatorAttachEdit,
  createEditProjectEvaluatorAttachClientAction,
  createReadProjectEvaluatorAttachClientAction,
  createSubmitProjectEvaluatorAttachClientAction,
  type ProjectEvaluatorAttachHost,
  type ProjectEvaluatorAttachSnapshot,
} from "..";

const SNAPSHOT: ProjectEvaluatorAttachSnapshot = {
  evaluatorId: "Q29kZUV2YWx1YXRvcjo4",
  name: "no_sql_in_output",
  kind: "CODE",
  variables: ["output", "threshold"],
  requiredVariables: ["output"],
  inputDescriptions: { output: "The assistant reply." },
  inputMapping: { pathMapping: {}, literalMapping: { threshold: 3 } },
  isDefaultMapping: true,
};

const CONTEXT = { callId: "tool-call-1:1", sessionId: "session-1" };

function createHost() {
  let inputMapping: EvaluatorInputMapping = SNAPSHOT.inputMapping;
  const submit = vi.fn(async () => ({
    ok: true as const,
    acceptedBy: "auto" as const,
    evaluator: { id: "UHJvamVjdEV2YWx1YXRvcjo5", name: SNAPSHOT.name },
  }));
  const host: ProjectEvaluatorAttachHost = {
    getSnapshot: () => ({
      ...SNAPSHOT,
      inputMapping,
      isDefaultMapping: inputMapping === SNAPSHOT.inputMapping,
    }),
    applyInputMapping: (next) => {
      inputMapping = next;
    },
    submit,
  };
  return { host, submit };
}

describe("applyProjectEvaluatorAttachEdit", () => {
  it("replaces the half it is given and keeps the other", () => {
    const result = applyProjectEvaluatorAttachEdit({
      snapshot: SNAPSHOT,
      input: {
        inputMapping: { pathMapping: { output: "attributes.output.value" } },
      },
    });
    expect(result).toEqual({
      ok: true,
      inputMapping: {
        pathMapping: { output: "attributes.output.value" },
        literalMapping: { threshold: 3 },
      },
    });
  });

  it("refuses inputs the evaluator does not read", () => {
    const result = applyProjectEvaluatorAttachEdit({
      snapshot: SNAPSHOT,
      input: { inputMapping: { pathMapping: { reference: "metadata.ref" } } },
    });
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toContain(
      "has no input named reference"
    );
  });
});

describe("attach client actions", () => {
  it("reads the open form", async () => {
    const { host } = createHost();
    const read = createReadProjectEvaluatorAttachClientAction({
      getHost: () => host,
    });
    await expect(read()).resolves.toEqual({ ok: true, output: SNAPSHOT });
  });

  it("reports a closed form", async () => {
    const read = createReadProjectEvaluatorAttachClientAction({
      getHost: () => null,
    });
    await expect(read()).resolves.toMatchObject({ ok: false });
  });

  it("refuses an edit from an unapproved script", async () => {
    const { host } = createHost();
    const edit = createEditProjectEvaluatorAttachClientAction({
      getHost: () => host,
    });
    const result = await edit(
      { inputMapping: { pathMapping: { output: "output.value" } } },
      CONTEXT
    );
    expect(result).toMatchObject({ ok: false });
    expect(host.getSnapshot().isDefaultMapping).toBe(true);
  });

  it("applies an approved edit to the form", async () => {
    const { host } = createHost();
    const edit = createEditProjectEvaluatorAttachClientAction({
      getHost: () => host,
      shouldAutoAccept: () => true,
    });
    const result = await edit(
      { inputMapping: { pathMapping: { output: "output.value" } } },
      CONTEXT
    );
    expect(result).toMatchObject({
      ok: true,
      output: {
        status: "accepted",
        attach: {
          inputMapping: {
            pathMapping: { output: "output.value" },
            literalMapping: { threshold: 3 },
          },
          isDefaultMapping: false,
        },
      },
    });
  });

  it("attaches through the form's submit", async () => {
    const { host, submit } = createHost();
    const attach = createSubmitProjectEvaluatorAttachClientAction({
      getHost: () => host,
      shouldAutoAccept: () => true,
    });
    const result = await attach({}, CONTEXT);
    expect(submit).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ ok: true });
  });
});

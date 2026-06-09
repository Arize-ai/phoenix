import type { AgentClientActionResult } from "@phoenix/store/agentStore";

export type ApprovalSource = "user" | "auto";

export type EvaluatorSubmitResult =
  | {
      ok: true;
      acceptedBy: ApprovalSource;
      evaluator: { id: string; name: string };
    }
  | { ok: false; error: string };

export function createEvaluatorHostSubmit({
  getHandleSubmit,
  unmountedError,
}: {
  getHandleSubmit: () => (() => Promise<EvaluatorSubmitResult>) | null;
  unmountedError: string;
}) {
  return async ({
    approvalSource,
  }: {
    approvalSource: ApprovalSource;
  }): Promise<EvaluatorSubmitResult> => {
    const handleSubmit = getHandleSubmit();
    if (!handleSubmit) {
      return { ok: false, error: unmountedError };
    }
    const result = await handleSubmit();
    if (!result.ok) {
      return result;
    }
    return { ...result, acceptedBy: approvalSource };
  };
}

type EvaluatorSubmitHost = {
  submit: (options: {
    approvalSource: ApprovalSource;
  }) => Promise<EvaluatorSubmitResult>;
};

export type EvaluatorSubmitToolOutput =
  | {
      status: "saved";
      persisted: true;
      acceptedBy: ApprovalSource;
      evaluator: { id: string; name: string };
    }
  | {
      status: "awaiting_user";
      persisted: false;
      requiresUserAction: true;
      message: string;
    };

const AWAITING_USER_MESSAGE =
  "The draft is open — review and click the dialog's Create/Update button to persist the evaluator.";

export function createEvaluatorSubmitClientAction<
  THost extends EvaluatorSubmitHost,
>({
  getDraftHost,
  parseInput,
  invalidInputError,
  notMountedError,
  shouldAutoAccept = () => false,
}: {
  getDraftHost: () => THost | null;
  parseInput: (input: unknown) => unknown;
  invalidInputError: string;
  notMountedError: string;
  shouldAutoAccept?: () => boolean;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    if (parseInput(input) == null) {
      return { ok: false, error: invalidInputError };
    }
    const host = getDraftHost();
    if (!host) {
      return { ok: false, error: notMountedError };
    }
    if (!shouldAutoAccept()) {
      const output: EvaluatorSubmitToolOutput = {
        status: "awaiting_user",
        persisted: false,
        requiresUserAction: true,
        message: AWAITING_USER_MESSAGE,
      };
      return { ok: true, output: JSON.stringify(output) };
    }
    const result = await host.submit({ approvalSource: "auto" });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    const output: EvaluatorSubmitToolOutput = {
      status: "saved",
      persisted: true,
      acceptedBy: result.acceptedBy,
      evaluator: result.evaluator,
    };
    return { ok: true, output: JSON.stringify(output) };
  };
}

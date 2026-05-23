import { authFetch } from "@phoenix/authFetch";
import { BASE_URL } from "@phoenix/config";

import type { CreateCodeEvaluatorInput } from "./types";

export const CREATE_CODE_EVALUATOR_MUTATION = `mutation createCodeEvaluator(
  $input: CreateCodeEvaluatorInput!
) {
  createCodeEvaluator(input: $input) {
    evaluator {
      id
      name
    }
  }
}`;

type GraphQLError = { message?: unknown };

type CreateCodeEvaluatorResponse = {
  data?: {
    createCodeEvaluator?: {
      evaluator?: { id: string; name: string };
    };
  } | null;
  errors?: GraphQLError[];
};

export type CreateCodeEvaluatorDispatchResult =
  | {
      ok: true;
      evaluator: { id: string; name: string };
    }
  | {
      ok: false;
      error: string;
    };

function formatGraphqlErrors(errors: GraphQLError[]): string {
  return errors
    .map((err) =>
      typeof err.message === "string" && err.message.length > 0
        ? err.message
        : "Unknown GraphQL error"
    )
    .join("\n");
}

/** Posts `createCodeEvaluator` and surfaces GraphQL errors verbatim. */
export async function dispatchCreateCodeEvaluator(
  input: CreateCodeEvaluatorInput
): Promise<CreateCodeEvaluatorDispatchResult> {
  // Mirror the code-evaluator form: when the model supplied a freeform output
  // config, persist it as a one-element `output_configs` array whose
  // freeform-variant `name` reuses the evaluator's own name. Omitted entirely
  // when the model left `outputConfig` null so today's no-config callers see
  // unchanged GraphQL traffic.
  const outputConfigsVariable =
    input.outputConfig !== null
      ? {
          outputConfigs: [
            {
              freeform: {
                name: input.name,
                optimizationDirection:
                  input.outputConfig.optimizationDirection ?? null,
                threshold: input.outputConfig.threshold ?? null,
                lowerBound: input.outputConfig.lowerBound ?? null,
                upperBound: input.outputConfig.upperBound ?? null,
              },
            },
          ],
        }
      : {};

  const variables = {
    input: {
      name: input.name,
      sourceCode: input.sourceCode,
      language: input.language,
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.sandboxConfigId !== null
        ? { sandboxConfigId: input.sandboxConfigId }
        : {}),
      inputMapping: input.inputMapping,
      ...outputConfigsVariable,
    },
  };

  let response: Response;
  try {
    response = await authFetch(`${BASE_URL}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: CREATE_CODE_EVALUATOR_MUTATION,
        variables,
      }),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `GraphQL request failed: HTTP ${response.status} ${response.statusText}`,
    };
  }

  let payload: CreateCodeEvaluatorResponse;
  try {
    payload = (await response.json()) as CreateCodeEvaluatorResponse;
  } catch {
    return { ok: false, error: "Failed to parse GraphQL response as JSON" };
  }

  if (payload.errors && payload.errors.length > 0) {
    return { ok: false, error: formatGraphqlErrors(payload.errors) };
  }

  const evaluator = payload.data?.createCodeEvaluator?.evaluator;
  if (!evaluator) {
    return {
      ok: false,
      error: "createCodeEvaluator response missing evaluator payload",
    };
  }

  return { ok: true, evaluator };
}

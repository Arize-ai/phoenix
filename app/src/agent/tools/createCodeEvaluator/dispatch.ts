import type {
  OutputConfigDraft,
  PendingCodeEvaluatorCreateDatasetSnapshot,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
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

export const CREATE_DATASET_CODE_EVALUATOR_MUTATION = `mutation createDatasetCodeEvaluator(
  $input: CreateDatasetCodeEvaluatorInput!
) {
  createDatasetCodeEvaluator(input: $input) {
    evaluator {
      id
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

type CreateDatasetCodeEvaluatorResponse = {
  data?: {
    createDatasetCodeEvaluator?: {
      evaluator?: { id: string };
    };
  } | null;
  errors?: GraphQLError[];
};

export type CreateCodeEvaluatorDispatchResult =
  | {
      ok: true;
      evaluator: { id: string; name: string };
      datasetEvaluatorId: string | null;
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

function outputConfigDraftToGraphQL(
  draft: OutputConfigDraft,
  evaluatorName: string
): Record<string, unknown> {
  const name = draft.name && draft.name.length > 0 ? draft.name : evaluatorName;
  switch (draft.kind) {
    case "classification":
      return {
        categorical: {
          name,
          optimizationDirection: draft.optimizationDirection,
          values: draft.values.map((value) => ({
            label: value.label,
            score: value.score ?? null,
          })),
        },
      };
    case "continuous":
      return {
        continuous: {
          name,
          optimizationDirection: draft.optimizationDirection,
          lowerBound: draft.lowerBound ?? null,
          upperBound: draft.upperBound ?? null,
        },
      };
    case "freeform":
      return {
        freeform: {
          name,
          optimizationDirection: draft.optimizationDirection,
          threshold: draft.threshold ?? null,
          lowerBound: draft.lowerBound ?? null,
          upperBound: draft.upperBound ?? null,
        },
      };
  }
}

function buildOutputConfigsVariable(
  drafts: OutputConfigDraft[],
  evaluatorName: string
): Record<string, unknown>[] {
  return drafts.map((draft) =>
    outputConfigDraftToGraphQL(draft, evaluatorName)
  );
}

async function postGraphQL(
  query: string,
  variables: Record<string, unknown>
): Promise<{ ok: true; payload: unknown } | { ok: false; error: string }> {
  let response: Response;
  try {
    response = await authFetch(`${BASE_URL}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
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

  try {
    return { ok: true, payload: await response.json() };
  } catch {
    return { ok: false, error: "Failed to parse GraphQL response as JSON" };
  }
}

/**
 * Dispatch `createCodeEvaluator` and, when `datasetContext` is non-null,
 * chain `createDatasetCodeEvaluator`. The commit handler is the single owner
 * of dataset-context snapshot semantics — dispatch never reads live state.
 */
export async function dispatchCreateCodeEvaluator(
  input: CreateCodeEvaluatorInput,
  options: {
    datasetContext: PendingCodeEvaluatorCreateDatasetSnapshot | null;
    connectionIds: string[];
  }
): Promise<CreateCodeEvaluatorDispatchResult> {
  const outputConfigsVariable = buildOutputConfigsVariable(
    input.outputConfigs,
    input.name
  );

  const standaloneVariables = {
    input: {
      name: input.name,
      sourceCode: input.sourceCode,
      language: input.language,
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      sandboxConfigId: input.sandboxConfigId,
      inputMapping: input.inputMapping,
      ...(outputConfigsVariable.length > 0
        ? { outputConfigs: outputConfigsVariable }
        : {}),
    },
  };

  const standaloneResult = await postGraphQL(
    CREATE_CODE_EVALUATOR_MUTATION,
    standaloneVariables
  );
  if (!standaloneResult.ok) return standaloneResult;
  const standalonePayload =
    standaloneResult.payload as CreateCodeEvaluatorResponse;
  if (standalonePayload.errors && standalonePayload.errors.length > 0) {
    return {
      ok: false,
      error: formatGraphqlErrors(standalonePayload.errors),
    };
  }
  const evaluator = standalonePayload.data?.createCodeEvaluator?.evaluator;
  if (!evaluator) {
    return {
      ok: false,
      error: "createCodeEvaluator response missing evaluator payload",
    };
  }

  if (options.datasetContext === null) {
    return { ok: true, evaluator, datasetEvaluatorId: null };
  }

  const datasetVariables = {
    input: {
      datasetId: options.datasetContext.datasetNodeId,
      evaluatorId: evaluator.id,
      name: input.name,
      inputMapping: input.inputMapping,
      ...(outputConfigsVariable.length > 0
        ? { outputConfigs: outputConfigsVariable }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
    },
    ...(options.connectionIds.length > 0
      ? { connections: options.connectionIds }
      : {}),
  };

  const datasetResult = await postGraphQL(
    CREATE_DATASET_CODE_EVALUATOR_MUTATION,
    datasetVariables
  );
  if (!datasetResult.ok) return datasetResult;
  const datasetPayload =
    datasetResult.payload as CreateDatasetCodeEvaluatorResponse;
  if (datasetPayload.errors && datasetPayload.errors.length > 0) {
    return { ok: false, error: formatGraphqlErrors(datasetPayload.errors) };
  }
  const datasetEvaluator =
    datasetPayload.data?.createDatasetCodeEvaluator?.evaluator;
  if (!datasetEvaluator) {
    return {
      ok: false,
      error:
        "createDatasetCodeEvaluator response missing dataset evaluator payload",
    };
  }

  return {
    ok: true,
    evaluator,
    datasetEvaluatorId: datasetEvaluator.id,
  };
}

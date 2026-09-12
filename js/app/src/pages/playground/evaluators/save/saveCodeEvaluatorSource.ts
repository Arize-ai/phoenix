import { graphql } from "react-relay";
import type { Environment } from "relay-runtime";

import type { saveCodeEvaluatorSourceCodeVersionMutation } from "./__generated__/saveCodeEvaluatorSourceCodeVersionMutation.graphql";
import type { saveCodeEvaluatorSourcePatchCodeMutation } from "./__generated__/saveCodeEvaluatorSourcePatchCodeMutation.graphql";
import { commitEvaluatorMutation } from "./commitEvaluatorMutation";
import type { SaveEvaluatorSlotRequest } from "./types";

/**
 * Writes the slot's code, mapping and outputs to the shared code evaluator.
 * Sandbox rebinding lives on patchCodeEvaluator; a version row carries no
 * sandbox. Rebinding validates the source in the sandbox, so only on change.
 * The server skips the version when the source matches the current tip.
 */
export async function updateSharedCodeEvaluator(
  environment: Environment,
  request: SaveEvaluatorSlotRequest,
  evaluatorId: string
) {
  const code = request.preview.inlineCodeEvaluator;

  if (!code) return;
  await commitEvaluatorMutation<saveCodeEvaluatorSourcePatchCodeMutation>(
    environment,
    patchCodeMutation,
    {
      input: {
        id: evaluatorId,
        name: request.name,
        description: request.description,
        inputMapping: request.inputMapping,
        outputConfigs: code.outputConfigs,
        ...(request.sandboxConfigId !== request.initialSandboxConfigId
          ? { sandboxConfigId: request.sandboxConfigId }
          : {}),
      },
    }
  );
  await commitEvaluatorMutation<saveCodeEvaluatorSourceCodeVersionMutation>(
    environment,
    codeVersionMutation,
    { input: { codeEvaluatorId: evaluatorId, sourceCode: code.sourceCode } }
  );
}

const patchCodeMutation = graphql`
  mutation saveCodeEvaluatorSourcePatchCodeMutation(
    $input: PatchCodeEvaluatorInput!
  ) {
    patchCodeEvaluator(input: $input) {
      evaluator {
        id
      }
    }
  }
`;

const codeVersionMutation = graphql`
  mutation saveCodeEvaluatorSourceCodeVersionMutation(
    $input: CreateCodeEvaluatorVersionInput!
  ) {
    createCodeEvaluatorVersion(input: $input) {
      evaluator {
        id
      }
    }
  }
`;

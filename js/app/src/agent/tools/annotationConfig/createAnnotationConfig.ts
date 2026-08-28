import { commitMutation, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { createAnnotationConfigAssociateMutation } from "./__generated__/createAnnotationConfigAssociateMutation.graphql";
import type { createAnnotationConfigToolMutation } from "./__generated__/createAnnotationConfigToolMutation.graphql";
import { buildAnnotationConfigInput } from "./buildAnnotationConfigInput";
import type {
  AnnotationConfigDraft,
  AnnotationConfigWriteApplyResult,
} from "./types";

type CreatedConfig = { configId: string; name: string } | { error: string };

function commitCreateAnnotationConfigMutation(
  draft: AnnotationConfigDraft
): Promise<CreatedConfig> {
  return new Promise((resolve) => {
    commitMutation<createAnnotationConfigToolMutation>(RelayEnvironment, {
      mutation: graphql`
        mutation createAnnotationConfigToolMutation(
          $input: CreateAnnotationConfigInput!
        ) {
          createAnnotationConfig(input: $input) {
            annotationConfig {
              __typename
              ... on CategoricalAnnotationConfig {
                id
                name
              }
              ... on ContinuousAnnotationConfig {
                id
                name
              }
              ... on FreeformAnnotationConfig {
                id
                name
              }
            }
          }
        }
      `,
      variables: {
        input: { annotationConfig: buildAnnotationConfigInput(draft) },
      },
      onCompleted: (response, errors) => {
        const message = errors?.find((error) => error.message)?.message;
        if (message) {
          resolve({ error: message });
          return;
        }
        const config = response.createAnnotationConfig.annotationConfig;
        if (config.__typename === "%other") {
          resolve({ error: "Unexpected annotation config type in response." });
          return;
        }
        resolve({ configId: config.id, name: config.name });
      },
      onError: (error) => resolve({ error: error.message }),
    });
  });
}

function commitAssociateAnnotationConfigToProjectMutation(
  projectId: string,
  annotationConfigId: string
): Promise<{ ok: true } | { error: string }> {
  return new Promise((resolve) => {
    commitMutation<createAnnotationConfigAssociateMutation>(RelayEnvironment, {
      mutation: graphql`
        mutation createAnnotationConfigAssociateMutation(
          $input: [AddAnnotationConfigToProjectInput!]!
        ) {
          addAnnotationConfigToProject(input: $input) {
            project {
              id
            }
          }
        }
      `,
      variables: { input: [{ projectId, annotationConfigId }] },
      onCompleted: (_response, errors) => {
        const message = errors?.find((error) => error.message)?.message;
        resolve(message ? { error: message } : { ok: true });
      },
      onError: (error) => resolve({ error: error.message }),
    });
  });
}

/**
 * Create an annotation config and, when a projectId is supplied, associate it
 * with that project. Runs outside React, so it uses the singleton Relay
 * environment. If the config is created but the association fails, report
 * success with a caveat so the model does not recreate the (now existing)
 * config — it should associate it separately instead.
 */
export async function commitCreateAnnotationConfig(
  draft: AnnotationConfigDraft,
  projectId: string | null
): Promise<AnnotationConfigWriteApplyResult> {
  if (draft.type === "categorical" && !draft.values?.length) {
    return {
      ok: false,
      error:
        "A categorical annotation config requires at least one label in `values`.",
    };
  }
  const created = await commitCreateAnnotationConfigMutation(draft);
  if ("error" in created) {
    return { ok: false, error: created.error };
  }
  if (projectId) {
    const associated = await commitAssociateAnnotationConfigToProjectMutation(
      projectId,
      created.configId
    );
    if ("error" in associated) {
      return {
        ok: true,
        output: `Created annotation config "${created.name}" (it now exists), but associating it with the project failed: ${associated.error}. Associate it separately rather than creating the config again.`,
      };
    }
    return {
      ok: true,
      output: `Created annotation config "${created.name}" and associated it with the project.`,
    };
  }
  return {
    ok: true,
    output: `Created annotation config "${created.name}".`,
  };
}

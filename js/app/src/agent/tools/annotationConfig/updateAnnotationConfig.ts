import { commitMutation, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { updateAnnotationConfigToolMutation } from "./__generated__/updateAnnotationConfigToolMutation.graphql";
import { buildAnnotationConfigInput } from "./buildAnnotationConfigInput";
import type {
  AnnotationConfigDraft,
  AnnotationConfigWriteApplyResult,
} from "./types";

/**
 * Replace an existing annotation config in full (the server `updateAnnotationConfig`
 * mutation overwrites the whole config). Runs outside React, so it uses the
 * singleton Relay environment.
 */
export function commitUpdateAnnotationConfig(
  configId: string,
  draft: AnnotationConfigDraft
): Promise<AnnotationConfigWriteApplyResult> {
  if (draft.type === "categorical" && !draft.values?.length) {
    return Promise.resolve({
      ok: false,
      error:
        "A categorical annotation config requires at least one label in `values`.",
    });
  }
  return new Promise((resolve) => {
    commitMutation<updateAnnotationConfigToolMutation>(RelayEnvironment, {
      mutation: graphql`
        mutation updateAnnotationConfigToolMutation(
          $input: UpdateAnnotationConfigInput!
        ) {
          updateAnnotationConfig(input: $input) {
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
        input: {
          id: configId,
          annotationConfig: buildAnnotationConfigInput(draft),
        },
      },
      onCompleted: (response, errors) => {
        const message = errors?.find((error) => error.message)?.message;
        if (message) {
          resolve({ ok: false, error: message });
          return;
        }
        const config = response.updateAnnotationConfig.annotationConfig;
        const name = config.__typename === "%other" ? draft.name : config.name;
        resolve({ ok: true, output: `Updated annotation config "${name}".` });
      },
      onError: (error) => resolve({ ok: false, error: error.message }),
    });
  });
}

import { graphql, useFragment } from "react-relay";

import { useTimeFormatters } from "@phoenix/hooks";

import type { useModelCostManifestDescription_query$key } from "./__generated__/useModelCostManifestDescription_query.graphql";

/**
 * Describes when the built-in model prices were generated, or returns null
 * until a model cost manifest has been applied.
 */
export function useModelCostManifestDescription(
  queryRef: useModelCostManifestDescription_query$key
): string | null {
  const { dateFormatter } = useTimeFormatters();
  const { modelCostManifest } = useFragment(
    graphql`
      fragment useModelCostManifestDescription_query on Query {
        modelCostManifest {
          generatedAt
        }
      }
    `,
    queryRef
  );
  if (modelCostManifest == null) {
    return null;
  }
  const date = dateFormatter(new Date(modelCostManifest.generatedAt));
  return `Built-in prices from ${date}`;
}

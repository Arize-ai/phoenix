import { graphql, useFragment } from "react-relay";

import { useTimeFormatters } from "@phoenix/hooks";

import type {
  ModelCostManifestSource,
  useModelCostManifestDescription_query$key,
} from "./__generated__/useModelCostManifestDescription_query.graphql";

const SOURCE_LABELS: Partial<Record<ModelCostManifestSource, string>> = {
  BUNDLED: "bundled",
  REMOTE: "fetched",
};

/**
 * Describes when the built-in model prices were generated and where they came from,
 * or returns null until a model cost manifest has been applied.
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
          source
        }
      }
    `,
    queryRef
  );
  if (modelCostManifest == null) {
    return null;
  }
  const date = dateFormatter(new Date(modelCostManifest.generatedAt));
  const sourceLabel = SOURCE_LABELS[modelCostManifest.source];
  return sourceLabel
    ? `Built-in prices from ${date} (${sourceLabel})`
    : `Built-in prices from ${date}`;
}

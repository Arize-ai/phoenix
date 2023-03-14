import { EmbeddingUMAPQuery$data } from "./__generated__/EmbeddingUMAPQuery.graphql";

export type UMAPPointsEntry = NonNullable<
  EmbeddingUMAPQuery$data["embedding"]["UMAPPoints"]
>["data"][number];

/**
 * A shared interface of a single model event
 */
export interface ModelEvent {
  id: string;
  linkToData: string | null;
  rawData: string | null;
  predictionLabel: string | null;
  actualLabel: string | null;
  readonly dimensions: readonly {
    dimension: {
      name: string;
      type: string;
    };
    value: string;
  }[];
}

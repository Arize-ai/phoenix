import { EmbeddingUMAPQuery$data } from "./__generated__/EmbeddingUMAPQuery.graphql";
import { PointSelectionPanelContentQuery$data } from "./__generated__/PointSelectionPanelContentQuery.graphql";

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
  predictionId: string | null;
  predictionLabel: string | null;
  actualLabel: string | null;
  readonly dimensions: readonly {
    dimension: {
      name: string;
      type: string;
    };
    value: string | null;
  }[];
  /**
   * the LLM prompt that was used to generate this event
   */
  prompt: string | null;
  /**
   * the LLM response
   */
  response: string | null;
}

export type EventsList =
  PointSelectionPanelContentQuery$data["model"]["primaryDataset"]["events"];

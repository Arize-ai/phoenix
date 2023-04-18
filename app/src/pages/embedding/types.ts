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
  predictionLabel: string | null;
  actualLabel: string | null;
  readonly dimensions: readonly {
    dimension: {
      name: string;
      type: string;
    };
    value: string | null;
  }[];
  promptAndResponse?: PromptResponse;
}

export type EventsList =
  PointSelectionPanelContentQuery$data["model"]["primaryDataset"]["events"];

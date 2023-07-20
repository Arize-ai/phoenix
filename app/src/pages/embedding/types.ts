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
  predictionScore: number | null;
  actualLabel: string | null;
  actualScore: number | null;
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
  /**
   * Retrievals from a corpus (e.x. a vector store)
   */
  retrievedDocuments: RetrievalDocument[];
}

export interface RetrievalDocument {
  id: string;
  /**
   * The content of the retrieved corpus document
   */
  text: string;
  /**
   * How relevant the document was during retrieval
   */
  relevance: number | null;
}

export type EventsList =
  PointSelectionPanelContentQuery$data["model"]["primaryDataset"]["events"];

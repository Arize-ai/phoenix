import { EmbeddingUMAPQuery$data } from "./__generated__/EmbeddingUMAPQuery.graphql";

export type UMAPPointsEntry = NonNullable<
  EmbeddingUMAPQuery$data["embedding"]["UMAPPoints"]
>["data"][number];

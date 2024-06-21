import { useParams } from "react-router";

export function useEmbeddingDimensionId(): string {
  const { embeddingDimensionId } = useParams();
  if (!embeddingDimensionId)
    throw new Error("Missing embeddingDimensionId in URL params");
  return embeddingDimensionId;
}

import { withSpan, traceChain } from "@arizeai/openinference-core";

declare const vectorStore: {
  similaritySearch(q: string, k: number): Promise<string[]>;
};

// Declared CHAIN, but this is document retrieval.
export const retrieveDocuments = withSpan(
  async (query: string) => vectorStore.similaritySearch(query, 5),
  { name: "vector-search", kind: "CHAIN" }
);

// Declared CHAIN (via wrapper name) and really is a pipeline.
export const pipeline = traceChain(
  async (query: string) => {
    const docs = await retrieveDocuments(query);
    return docs.join("\n");
  },
  { name: "rag-pipeline" }
);

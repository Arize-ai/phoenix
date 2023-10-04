export {};

declare global {
  interface Window {
    Config: {
      hasCorpus: boolean;
      UMAP: {
        minDist: number;
        nNeighbors: number;
        nSamples: number;
      };
    };
  }
}

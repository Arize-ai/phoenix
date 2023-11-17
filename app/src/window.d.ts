export {};

declare global {
  interface Window {
    Config: {
      // basename for the app. This can be the proxy path for
      // Remote notebooks like SageMaker
      basename: string;
      hasCorpus: boolean;
      UMAP: {
        minDist: number;
        nNeighbors: number;
        nSamples: number;
      };
    };
  }
}

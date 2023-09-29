export {};

declare global {
  interface Window {
    Config: {
      hasCorpus: boolean;
      minDist: number;
      nNeighbors: number;
      nSamples: number;
    };
  }
}

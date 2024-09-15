export {};

type OAuthIdp = {
  id: string;
  displayName: string;
};

declare global {
  interface Window {
    Config: {
      // basename for the app. This can be the proxy path for
      // Remote notebooks like SageMaker
      basename: string;
      platformVersion: string;
      hasInferences: boolean;
      hasCorpus: boolean;
      UMAP: {
        minDist: number;
        nNeighbors: number;
        nSamples: number;
      };
      authenticationEnabled: boolean;
      oAuthIdps: OAuthIdp[];
    };
  }
}

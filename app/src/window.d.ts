export {};

type OAuth2Idp = {
  name: string;
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
      basicAuthDisabled: boolean;
      oAuth2Idps: OAuth2Idp[];
      managementUrl?: string | null;
    };
  }
}

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
      ldapEnabled: boolean;
      /**
       * Marker string prefix for LDAP users without email.
       * Used to hide placeholder emails in UI.
       * Only present when LDAP is enabled and email attribute is empty.
       */
      nullEmailMarkerPrefix?: string | null;
      /**
       * Whether manual LDAP user creation is enabled.
       * False when PHOENIX_LDAP_ATTR_EMAIL is empty (no email to enter).
       */
      ldapManualUserCreationEnabled: boolean;
      managementUrl?: string | null;
      supportEmail?: string | null;
      hasDbThreshold: boolean;
      /**
       * Mapping of auth error codes to user-friendly messages.
       * Passed from the backend to ensure single source of truth.
       */
      authErrorMessages: Record<string, string>;
    };
  }
}

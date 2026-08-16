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
      authenticationEnabled: boolean;
      basicAuthDisabled: boolean;
      oAuth2Idps: OAuth2Idp[];
      ldapEnabled: boolean;
      /**
       * Whether manual LDAP user creation is enabled.
       * False when PHOENIX_LDAP_ATTR_EMAIL is empty (no email to enter).
       */
      ldapManualUserCreationEnabled: boolean;
      managementUrl?: string | null;
      supportEmail?: string | null;
      hasDbThreshold: boolean;
      agentAssistantDisabled: boolean;
      /**
       * Whether the server-side bash tool is disabled
       * at the deployment level. When true, the subagents setting is hidden.
       */
      agentBashDisabled: boolean;
      /**
       * Whether the in-process MCP server is mounted at /mcp
       * on this deployment.
       */
      mcpServerEnabled: boolean;
      /**
       * Whether the MCP server presents the code-mode tool surface
       * (discovery tools plus a sandboxed execute tool).
       */
      mcpCodeModeEnabled: boolean;
      /**
       * Mapping of auth error codes to user-friendly messages.
       * Passed from the backend to ensure single source of truth.
       */
      authErrorMessages: Record<string, string>;
    };
  }
}

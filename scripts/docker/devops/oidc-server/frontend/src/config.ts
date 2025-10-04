/**
 * Simple hardcoded configuration for /oidc base path
 */

export interface AppConfig {
  basePath: string;
  apiBase: string;
}

/**
 * Hardcoded configuration - /oidc handled by Traefik, internal routes have no prefix
 */
export const config: AppConfig = {
  basePath: "/oidc", // For browser URLs
  apiBase: "/oidc/api", // For browser API calls
};

/**
 * Helper for debugging
 */
export const debugConfig = () => {
  console.log("🔧 Config:", {
    basePath: config.basePath,
    apiBase: config.apiBase,
  });
};

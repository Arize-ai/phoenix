import { BASE_URL } from "@phoenix/config";
import type { EnvVar } from "@phoenix/pages/project/integrationDefinitions";

import { HOSTED_PHOENIX_URL } from "../hosting";

export function getEnvironmentVariables({
  isAuthEnabled,
  isHosted,
  apiKey,
  extraEnvVars,
}: {
  isAuthEnabled: boolean;
  isHosted: boolean;
  apiKey?: string;
  extraEnvVars?: readonly EnvVar[];
}): string {
  const apiKeyValue = apiKey || "<your-api-key>";
  let vars: string;
  if (isHosted) {
    vars = `PHOENIX_CLIENT_HEADERS='api_key=${apiKeyValue}'\nPHOENIX_COLLECTOR_ENDPOINT='${HOSTED_PHOENIX_URL}'`;
  } else if (isAuthEnabled) {
    vars = `PHOENIX_API_KEY='${apiKeyValue}'\nPHOENIX_COLLECTOR_ENDPOINT='${BASE_URL}'`;
  } else {
    vars = `PHOENIX_COLLECTOR_ENDPOINT='${BASE_URL}'`;
  }
  if (extraEnvVars?.length) {
    vars += "\n" + extraEnvVars.map((v) => `${v.name}='${v.value}'`).join("\n");
  }
  return vars;
}

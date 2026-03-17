import { BASE_URL } from "@phoenix/config";

import { HOSTED_PHOENIX_URL } from "../hosting";

export function getEnvironmentVariables({
  isAuthEnabled,
  isHosted,
  apiKey,
}: {
  isAuthEnabled: boolean;
  isHosted: boolean;
  apiKey?: string;
}): string {
  const apiKeyValue = apiKey || "<your-api-key>";
  if (isHosted) {
    return `PHOENIX_CLIENT_HEADERS='api_key=${apiKeyValue}'\nPHOENIX_COLLECTOR_ENDPOINT='${HOSTED_PHOENIX_URL}'`;
  } else if (isAuthEnabled) {
    return `PHOENIX_API_KEY='${apiKeyValue}'\nPHOENIX_COLLECTOR_ENDPOINT='${BASE_URL}'`;
  }
  return `PHOENIX_COLLECTOR_ENDPOINT='${BASE_URL}'`;
}

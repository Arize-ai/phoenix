/**
 * Utility functions for constructing URLs to Phoenix resources
 */

/**
 * Get the base URL for Phoenix web UI
 * @param baseUrl The base URL of the Phoenix API
 * @returns The base URL for the Phoenix web UI
 */
function getWebBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  // Ensure the pathname ends with a trailing slash for proper path concatenation
  // Without this, the URL constructor treats the last segment as a file and replaces it
  if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
  }
  return url.toString();
}

/**
 * Get the URL to view a specific experiment in the Phoenix web UI
 * @param params - The parameters for generating the experiment URL
 * @param params.baseUrl - The base URL of the Phoenix API
 * @param params.datasetId - The ID of the dataset
 * @param params.experimentId - The ID of the experiment
 * @returns The URL to view the experiment
 */
export function getExperimentUrl({
  baseUrl,
  datasetId,
  experimentId,
}: {
  baseUrl: string;
  datasetId: string;
  experimentId: string;
}): string {
  const url = new URL(`datasets/${datasetId}/compare`, getWebBaseUrl(baseUrl));
  url.searchParams.set("experimentId", experimentId);
  return url.toString();
}

/**
 * Get the URL to view experiments for a dataset in the Phoenix web UI
 * @param params - The parameters for generating the dataset experiments URL
 * @param params.baseUrl - The base URL of the Phoenix API
 * @param params.datasetId - The ID of the dataset
 * @returns The URL to view dataset experiments
 */
export function getDatasetExperimentsUrl({
  baseUrl,
  datasetId,
}: {
  baseUrl: string;
  datasetId: string;
}): string {
  const url = new URL(
    `datasets/${datasetId}/experiments`,
    getWebBaseUrl(baseUrl)
  );
  return url.toString();
}

/**
 * Get the URL to view a dataset in the Phoenix web UI
 * @param params - The parameters for generating the dataset URL
 * @param params.baseUrl - The base URL of the Phoenix API
 * @param params.datasetId - The ID of the dataset
 * @returns The URL to view the dataset
 */
export function getDatasetUrl({
  baseUrl,
  datasetId,
}: {
  baseUrl: string;
  datasetId: string;
}): string {
  const url = new URL(`datasets/${datasetId}/examples`, getWebBaseUrl(baseUrl));
  return url.toString();
}

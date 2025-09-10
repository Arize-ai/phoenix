/**
 * Utility functions for constructing URLs to Phoenix resources
 */

/**
 * Get the base URL for Phoenix web UI
 * @param baseUrl The base URL of the Phoenix API
 * @returns The base URL for the Phoenix web UI
 */
function getWebBaseUrl(baseUrl: string): string {
  return new URL(baseUrl).toString();
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
  return `${getWebBaseUrl(baseUrl)}datasets/${datasetId}/compare?experimentId=${experimentId}`;
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
  return `${getWebBaseUrl(baseUrl)}datasets/${datasetId}/experiments`;
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
  return `${getWebBaseUrl(baseUrl)}datasets/${datasetId}/examples`;
}

/**
 * Utility functions for constructing URLs to Phoenix resources
 */

/**
 * Get the base URL for Phoenix web UI
 * @param baseUrl The base URL of the Phoenix API
 * @returns The base URL for the Phoenix web UI
 */
export function getWebBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
}

/**
 * Get the URL to view a specific experiment in the Phoenix web UI
 * @param baseUrl The base URL of the Phoenix API
 * @param datasetId The ID of the dataset
 * @param experimentId The ID of the experiment
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
 * @param baseUrl The base URL of the Phoenix API
 * @param datasetId The ID of the dataset
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
 * @param baseUrl The base URL of the Phoenix API
 * @param datasetId The ID of the dataset
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

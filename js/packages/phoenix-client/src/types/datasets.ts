import { Node } from "./core";

/**
 * A dataset can be identified by its datasetId, datasetName, or datasetVersionId
 */
export type DatasetSelector = { datasetId: string } | { datasetName: string };

/**
 * Parameters for selecting a specific version of a dataset
 */
export interface DatasetVersionSelector {
  dataset: DatasetSelector;
  versionId?: string;
}

/**
 * Overview information about a dataset
 */
export interface DatasetInfo extends Node {
  name: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Information about a dataset version
 */
export interface DatasetVersionInfo extends Node {
  description?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * A dataset's examples
 */
export interface DatasetExamples<
  InputType = Record<string, unknown>,
  OutputType = unknown,
> {
  examples: ExampleWithId<InputType, OutputType>[];
  /**
   * The version ID of the dataset examples
   */
  versionId: string;
}

/**
 * An example is a record to feed into an AI task
 */
export interface Example<
  InputType = Record<string, unknown>,
  OutputType = Record<string, unknown> | null | undefined,
> {
  input: InputType;
  output?: OutputType;
  metadata?: Record<string, unknown> | null;
}

/**
 * An example that has been synced to the server
 */
export interface ExampleWithId<InputType, OutputType>
  extends Example<InputType, OutputType>,
    Node {
  updatedAt: Date;
}

/**
 * A dataset is a collection of examples for an AI task
 */
export interface Dataset<
  InputType = Record<string, unknown>,
  OutputType = unknown,
> extends DatasetInfo,
    DatasetExamples<InputType, OutputType>,
    Node {}

/**
 * A dataset with its version information
 */
export interface DatasetWithVersion<InputType, OutputType>
  extends Dataset<InputType, OutputType> {
  versionInfo: DatasetVersionInfo;
}

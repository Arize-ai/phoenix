import { Node } from "./core";

/**
 * A dataset can be identified by its datasetId
 * TODO: add support for datasetVersionId via discriminated union
 */
export type DatasetSelector = { datasetId: string } | { datasetName: string };

/**
 * Overview information about a dataset
 */
export interface DatasetInfo extends Node {
  name: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * A dataset's examples
 */
export interface DatasetExamples {
  examples: ExampleWithId[];
  /**
   * The version ID of the dataset examples
   */
  versionId: string;
}

/**
 * An example is a record to feed into an AI task
 */
export interface Example {
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

/**
 * An example that has been synced to the server
 */
export interface ExampleWithId extends Example, Node {
  updatedAt: Date;
}

/**
 * A dataset is a collection of examples for an AI task
 */
export interface Dataset extends DatasetInfo, DatasetExamples, Node {}

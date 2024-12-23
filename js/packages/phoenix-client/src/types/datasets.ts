import { Node } from "./core";

/**
 * An example is a record to feed into an AI task
 */
export interface Example extends Node {
  id: string;
  updatedAt: Date;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

/**
 * A dataset is a collection of examples for an AI task
 */
export interface Dataset extends Node {
  id: string;
  name: string;
  versionId: string;
  examples: Example[];
}

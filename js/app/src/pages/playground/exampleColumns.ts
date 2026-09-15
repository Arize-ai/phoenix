import type { VisibilityState } from "@tanstack/react-table";

import { isStringKeyedObject } from "@phoenix/typeUtils";

/**
 * The dataset example's own columns of the playground table, in table order.
 * Each can be hidden; the task columns are what the table is for and stay.
 */
export const EXAMPLE_COLUMNS = ["input", "output", "metadata"] as const;

export type ExampleColumn = (typeof EXAMPLE_COLUMNS)[number];

/** Column labels as the table's headers spell them. */
export const EXAMPLE_COLUMN_LABELS: Record<ExampleColumn, string> = {
  input: "input",
  output: "reference output",
  metadata: "metadata",
};

/** Where an example keeps its annotations, expected outputs included. */
export const ANNOTATIONS_KEY = "annotations";

export type DisplayedMetadata = {
  /** The metadata as the cell shows it. */
  value: unknown;
  /** True when the `annotations` key was left out. */
  isHidingAnnotations: boolean;
};

/**
 * Expected outputs live under the metadata's `annotations` key as bookkeeping
 * for the evaluator cells, which show them in their own band. The metadata
 * cell leaves that key out so the column shows what the example says about
 * itself; the example details show the whole value.
 */
export function getDisplayedMetadata(metadata: unknown): DisplayedMetadata {
  if (!isStringKeyedObject(metadata) || !(ANNOTATIONS_KEY in metadata)) {
    return { value: metadata, isHidingAnnotations: false };
  }

  const value = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => key !== ANNOTATIONS_KEY)
  );

  return { value, isHidingAnnotations: true };
}

/** True when the metadata holds something besides annotations. */
export function hasDisplayableMetadata(metadata: unknown): boolean {
  return (
    isStringKeyedObject(metadata) &&
    Object.keys(metadata).some((key) => key !== ANNOTATIONS_KEY)
  );
}

/**
 * Which example columns show. Metadata starts hidden unless a loaded example
 * has some: a column of empty objects says nothing. Once someone toggles a
 * column, their stored choice wins.
 */
export function getExampleColumnVisibility({
  hasMetadata,
  storedVisibility,
}: {
  hasMetadata: boolean;
  storedVisibility: VisibilityState;
}): VisibilityState {
  return { metadata: hasMetadata, ...storedVisibility };
}

import type { VisibilityState } from "@tanstack/react-table";

import type { PlaygroundTaskKind } from "@phoenix/store/playground/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";

/**
 * The dataset example's own columns of the playground table, in table order.
 * Each can be hidden; the task columns are what the table is for and stay.
 */
export const EXAMPLE_COLUMNS = ["input", "output", "metadata"] as const;

export type ExampleColumn = (typeof EXAMPLE_COLUMNS)[number];

/**
 * Column labels as the table's headers spell them. The example's output is
 * the reference a prompt task's output is judged against, but for an
 * evaluator task it is the output being judged, so the label follows the
 * page's kind of task.
 */
export function getExampleColumnLabels(
  taskKind: PlaygroundTaskKind
): Record<ExampleColumn, string> {
  return {
    input: "input",
    output: taskKind === "evaluator" ? "output" : "reference output",
    metadata: "metadata",
  };
}

/** Where an example keeps its annotations, expected outputs included. */
export const ANNOTATIONS_KEY = "annotations";

export type MetadataDisplayOptions = {
  /**
   * Leave the `annotations` key out. It holds the expected outputs, which the
   * evaluator cells already show; the experiment settings turn this off.
   */
  hideAnnotations: boolean;
};

export type DisplayedMetadata = {
  /** The metadata as the cell shows it. */
  value: unknown;
  /** True when the `annotations` key was left out. */
  isHidingAnnotations: boolean;
};

/**
 * The example's metadata as the metadata cell shows it: whole, or without the
 * `annotations` key so the column shows what the example says about itself.
 */
export function getDisplayedMetadata(
  metadata: unknown,
  { hideAnnotations }: MetadataDisplayOptions
): DisplayedMetadata {
  if (
    !hideAnnotations ||
    !isStringKeyedObject(metadata) ||
    !(ANNOTATIONS_KEY in metadata)
  ) {
    return { value: metadata, isHidingAnnotations: false };
  }

  const value = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => key !== ANNOTATIONS_KEY)
  );

  return { value, isHidingAnnotations: true };
}

/** True when the metadata cell would show something. */
export function hasDisplayableMetadata(
  metadata: unknown,
  { hideAnnotations }: MetadataDisplayOptions
): boolean {
  return (
    isStringKeyedObject(metadata) &&
    Object.keys(metadata).some(
      (key) => !hideAnnotations || key !== ANNOTATIONS_KEY
    )
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

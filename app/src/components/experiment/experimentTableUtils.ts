/**
 * Utilities for calculating heights in experiment tables.
 * Used by both PlaygroundDatasetExamplesTable and ExperimentCompareTable
 * to ensure consistent row sizing in virtualized tables.
 */

/**
 * Base height for primary content area in experiment table cells (pixels)
 */
export const CELL_PRIMARY_CONTENT_HEIGHT = 300;

/**
 * Height of a single annotation item (pixels)
 */
export const ANNOTATION_ITEM_HEIGHT = 32;

/**
 * Base height of annotation list container (padding + border)
 * 16px padding (8px top + 8px bottom) + 1px border
 */
export const ANNOTATION_LIST_BASE_HEIGHT = 17;

/**
 * Height of cell header/top section (pixels)
 */
export const CELL_TOP_HEIGHT = 40;

/**
 * Calculate the total height of an annotation list based on item count
 */
export function calculateAnnotationListHeight(annotationCount: number): number {
  if (annotationCount === 0) return 0;
  return ANNOTATION_LIST_BASE_HEIGHT + annotationCount * ANNOTATION_ITEM_HEIGHT;
}

/**
 * Calculate estimated row height for virtualized experiment tables
 */
export function calculateEstimatedRowHeight(annotationCount: number): number {
  return (
    CELL_TOP_HEIGHT +
    CELL_PRIMARY_CONTENT_HEIGHT +
    calculateAnnotationListHeight(annotationCount)
  );
}

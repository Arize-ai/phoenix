const DEFAULT_COLLAPSED_CHIP_WIDTH_PX = 88;
const DEFAULT_SELECTED_CHIP_MIN_WIDTH_PX = 180;
const DEFAULT_OVERFLOW_TRIGGER_WIDTH_PX = 56;

/**
 * Splits the picker's experiments into chips and an overflow menu for the
 * width at hand. Chips keep their order; the selected experiment is always a
 * chip, taking the last chip slot when it would otherwise overflow.
 * @param params.experimentIds - the compared experiments, in display order
 * @param params.selectedExperimentId - the experiment the lane shows
 * @param params.availableWidth - the picker's width in pixels; null before it is measured
 */
export function partitionPickerExperiments({
  experimentIds,
  selectedExperimentId,
  availableWidth,
  collapsedChipWidth = DEFAULT_COLLAPSED_CHIP_WIDTH_PX,
  selectedChipMinWidth = DEFAULT_SELECTED_CHIP_MIN_WIDTH_PX,
  overflowTriggerWidth = DEFAULT_OVERFLOW_TRIGGER_WIDTH_PX,
}: {
  experimentIds: readonly string[];
  selectedExperimentId: string;
  availableWidth: number | null;
  /** Width of an unselected chip: radio, swatch and sequence number */
  collapsedChipWidth?: number;
  /** The least width the selected chip needs to show part of its name */
  selectedChipMinWidth?: number;
  /** Width of the `+N` menu trigger */
  overflowTriggerWidth?: number;
}): { chipExperimentIds: string[]; overflowExperimentIds: string[] } {
  if (availableWidth == null) {
    return { chipExperimentIds: [...experimentIds], overflowExperimentIds: [] };
  }
  const widthOfAllChips =
    selectedChipMinWidth + (experimentIds.length - 1) * collapsedChipWidth;
  if (widthOfAllChips <= availableWidth) {
    return { chipExperimentIds: [...experimentIds], overflowExperimentIds: [] };
  }
  const collapsedChipCount = Math.max(
    Math.floor(
      (availableWidth - selectedChipMinWidth - overflowTriggerWidth) /
        collapsedChipWidth
    ),
    0
  );
  const chipCount = collapsedChipCount + 1;
  const leadingExperimentIds = experimentIds.slice(0, chipCount);
  const chipExperimentIds = leadingExperimentIds.includes(selectedExperimentId)
    ? leadingExperimentIds
    : [...leadingExperimentIds.slice(0, chipCount - 1), selectedExperimentId];
  return {
    chipExperimentIds,
    overflowExperimentIds: experimentIds.filter(
      (experimentId) => !chipExperimentIds.includes(experimentId)
    ),
  };
}

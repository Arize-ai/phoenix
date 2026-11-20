/**
 * The labels a picker's new selection stands for. The picker lists one page
 * of labels, so attached labels beyond it are kept from the current
 * selection rather than looked up in the page; newly checked labels follow,
 * in list order.
 */
export function mergeLabelSelection<Label extends { id: string }>({
  selectedLabels,
  labels,
  ids,
}: {
  /**
   * The labels attached now.
   */
  selectedLabels: readonly Label[];
  /**
   * The labels the picker lists.
   */
  labels: readonly Label[];
  /**
   * The ids the picker has checked.
   */
  ids: ReadonlySet<string>;
}): Label[] {
  const keptLabels = selectedLabels.filter((label) => ids.has(label.id));
  const keptIds = new Set(keptLabels.map((label) => label.id));
  const addedLabels = labels.filter(
    (label) => ids.has(label.id) && !keptIds.has(label.id)
  );
  return [...keptLabels, ...addedLabels];
}

/**
 * Describes pending example edits for a confirmation prompt, e.g.
 * "3 unsaved changes to the dataset examples".
 */
export function describeUnsavedExampleChanges({
  count,
}: {
  count: number;
}): string {
  return `${count} unsaved change${count === 1 ? "" : "s"} to the dataset examples`;
}

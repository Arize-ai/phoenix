/**
 * Checks whether the URL needs the applied filter condition written back to
 * it. A link that drops the search string, such as the dataset breadcrumb,
 * leaves the table filtered and the URL without the condition. A condition the
 * URL still carries is left alone, even one the server rejected, so it stays
 * editable after a reload.
 */
export function shouldRestoreFilterConditionParam({
  urlCondition,
  appliedCondition,
}: {
  urlCondition: string;
  appliedCondition: string;
}): boolean {
  return urlCondition === "" && appliedCondition !== "";
}

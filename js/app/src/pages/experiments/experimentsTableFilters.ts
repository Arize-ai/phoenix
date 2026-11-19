/** The search text and filter condition the experiments table last asked for. */
export type ExperimentsTableFilters = {
  searchText: string;
  filterCondition: string;
};

/**
 * Returns the refetch variables for the experiments table. Relay fills any
 * variable a refetch omits from the page query, not from the previous refetch,
 * so every refetch passes both filters.
 */
export function getExperimentsRefetchVariables({
  searchText,
  filterCondition,
}: ExperimentsTableFilters) {
  return {
    filterCondition: searchText || null,
    experimentFilterCondition: filterCondition || null,
  };
}

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

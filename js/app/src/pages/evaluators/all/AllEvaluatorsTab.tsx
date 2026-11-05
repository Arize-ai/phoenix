import { css } from "@emotion/react";
import type { SortingState } from "@tanstack/react-table";
import { Suspense, useState } from "react";

import { DebouncedSearch, View } from "@phoenix/components";
import { TableSkeleton } from "@phoenix/components/table";
import {
  ALL_EVALUATORS_DEFAULT_SORTING,
  AllEvaluatorsTable,
} from "@phoenix/pages/evaluators/all/AllEvaluatorsTable";
import { SearchBarSkeleton } from "@phoenix/pages/evaluators/SearchBarSkeleton";

const pageCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const tableScrollCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
`;

/**
 * The Evaluators page's All evaluators tab: every project evaluator and every dataset
 * evaluator in one list.
 */
export function AllEvaluatorsTab() {
  const [filter, setFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>(
    ALL_EVALUATORS_DEFAULT_SORTING
  );
  return (
    <div css={pageCSS}>
      <View
        padding="size-100"
        flex="none"
        borderBottomWidth="thin"
        borderBottomColor="default"
      >
        <DebouncedSearch
          aria-label="Search evaluators, projects, or datasets"
          placeholder="Search evaluators, projects, or datasets"
          defaultValue={filter}
          onChange={setFilter}
        />
      </View>
      <div css={tableScrollCSS}>
        <Suspense fallback={<TableSkeleton rowCount="fill" />}>
          <AllEvaluatorsTable
            filter={filter}
            sorting={sorting}
            onSortingChange={setSorting}
          />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * The tab while the page loads, laid out as the loaded tab is: the search
 * bar over the table.
 */
export function AllEvaluatorsTabSkeleton() {
  return (
    <div css={pageCSS}>
      <SearchBarSkeleton hasDivider />
      <div css={tableScrollCSS}>
        <TableSkeleton rowCount="fill" />
      </div>
    </div>
  );
}

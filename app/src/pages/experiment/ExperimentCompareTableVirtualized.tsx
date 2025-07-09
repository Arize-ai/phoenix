import React, { ReactNode, useMemo, useRef, useState } from "react";
import { faker } from "@faker-js/faker";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { ExperimentCompareTableVirtualized_comparisons$key, ExperimentCompareTableVirtualized_comparisons$data } from "./__generated__/ExperimentCompareTableVirtualized_comparisons.graphql";
import { useSearchParams } from "react-router";
import { graphql, usePaginationFragment } from "react-relay";
import type { ExperimentCompareTableVirtualizedQuery } from "./__generated__/ExperimentCompareTableVirtualizedQuery.graphql";

type ExampleCompareTableProps = {
  query: ExperimentCompareTableVirtualized_comparisons$key;
  datasetId: string;
  baselineExperimentId: string;
  compareExperimentIds: string[];
  /**
   * Whether to display the full text of the text fields
   */
  displayFullText: boolean;
};

type ExperimentInfoMap = Record<
  string,
  | {
      name: string;
      sequenceNumber: number;
      metadata: object;
      projectId: string | null;
    }
  | undefined
>;

type TableRow =
  ExperimentCompareTableVirtualized_comparisons$data["compareExperiments"]["edges"][number]["comparison"] & {
    id: string;
    input: unknown;
    referenceOutput: unknown;
    runComparisonMap: Record<
      string,
      ExperimentCompareTableVirtualized_comparisons$data["compareExperiments"]["edges"][number]["comparison"]["runComparisonItems"][number]
    >;
  };

const randomNumber = (min: number, max: number) =>
  faker.number.int({ min, max });

const sentences = new Array(10000)
  .fill(true)
  .map(() => faker.lorem.sentence(randomNumber(20, 70)));

export function ExperimentCompareTable(props: ExampleCompareTableProps) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const {
    datasetId,
    baselineExperimentId,
    compareExperimentIds,
    displayFullText,
  } = props;
  const [filterCondition, setFilterCondition] = useState("");
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<
      ExperimentCompareTableVirtualizedQuery,
      ExperimentCompareTableVirtualized_comparisons$key
    >(
      graphql`
        fragment ExperimentCompareTableVirtualized_comparisons on Query
        @refetchable(queryName: "ExperimentCompareTableVirtualizedQuery")
        @argumentDefinitions(
          first: { type: "Int", defaultValue: 50 }
          after: { type: "String", defaultValue: null }
          baselineExperimentId: { type: "ID!" }
          compareExperimentIds: { type: "[ID!]!" }
          datasetId: { type: "ID!" }
          filterCondition: { type: "String", defaultValue: null }
        ) {
          compareExperiments(
            first: $first
            after: $after
            baselineExperimentId: $baselineExperimentId
            compareExperimentIds: $compareExperimentIds
            filterCondition: $filterCondition
          ) @connection(key: "ExperimentCompareTable_compareExperiments") {
            edges {
              comparison: node {
                example {
                  id
                  revision {
                    input
                    referenceOutput: output
                  }
                }
                runComparisonItems {
                  experimentId
                  runs {
                    id
                    output
                    error
                    startTime
                    endTime
                    trace {
                      traceId
                      projectId
                    }
                    costSummary {
                      total {
                        tokens
                        cost
                      }
                    }
                    annotations {
                      edges {
                        annotation: node {
                          id
                          name
                          score
                          label
                          annotatorKind
                          explanation
                          trace {
                            traceId
                            projectId
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          dataset: node(id: $datasetId) {
            id
            ... on Dataset {
              experiments {
                edges {
                  experiment: node {
                    id
                    name
                    sequenceNumber
                    metadata
                    project {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      `,
      props.query
    );
  const experimentInfoById = useMemo(() => {
    return (
      data.dataset?.experiments?.edges.reduce((acc, edge) => {
        acc[edge.experiment.id] = {
          ...edge.experiment,
          projectId: edge.experiment?.project?.id || null,
        };
        return acc;
      }, {} as ExperimentInfoMap) || {}
    );
  }, [data]);
  const tableData: TableRow[] = useMemo(
    () =>
      data.compareExperiments.edges.map((edge) => {
        const comparison = edge.comparison;
        const runComparisonMap = comparison.runComparisonItems.reduce(
          (acc, item) => {
            acc[item.experimentId] = item;
            return acc;
          },
          {} as Record<
            string,
            ExperimentCompareTableVirtualized_comparisons$data["compareExperiments"]["edges"][number]["comparison"]["runComparisonItems"][number]
          >
        );
        return {
          ...comparison,
          id: comparison.example.id,
          input: comparison.example.revision.input,
          referenceOutput: comparison.example.revision.referenceOutput,
          runComparisonMap,
        };
      }),
    [data]
  );


  const parentRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(true);

  const count = sentences.length;
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    enabled
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div>
      <button
        onClick={() => {
          virtualizer.scrollToIndex(0);
        }}
      >
        scroll to the top
      </button>
      <span style={{ padding: "0 4px" }} />
      <button
        onClick={() => {
          virtualizer.scrollToIndex(count / 2);
        }}
      >
        scroll to the middle
      </button>
      <span style={{ padding: "0 4px" }} />
      <button
        onClick={() => {
          virtualizer.scrollToIndex(count - 1);
        }}
      >
        scroll to the end
      </button>
      <span style={{ padding: "0 4px" }} />
      <button
        onClick={() => {
          setEnabled((prev) => !prev);
        }}
      >
        turn {enabled ? "off" : "on"} virtualizer
      </button>
      <hr />
      <div
        ref={parentRef}
        className="List"
        style={{
          height: 400,
          width: 400,
          overflowY: "auto",
          contain: "strict",
        }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${items[0]?.start ?? 0}px)`,
            }}
          >
            {items.map((virtualRow) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={
                  virtualRow.index % 2 ? "ListItemOdd" : "ListItemEven"
                }
              >
                <div style={{ padding: "10px 0" }}>
                  <div>Row {virtualRow.index}</div>
                  <div>{sentences[virtualRow.index]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}



import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

import {
  Card,
  ColorSwatch,
  CopyToClipboardButton,
  Dialog,
  DialogTrigger,
  Empty,
  Flex,
  Heading,
  Popover,
  PopoverArrow,
  View,
} from "@phoenix/components";
import { AnnotationDetailsContent } from "@phoenix/components/annotation/AnnotationDetailsContent";
import { JSONBlock } from "@phoenix/components/code";
import { useExperimentColors } from "@phoenix/components/experiment";
import { resizeHandleCSS } from "@phoenix/components/resize";
import {
  ExperimentCompareDetailsQuery,
  ExperimentCompareDetailsQuery$data,
} from "@phoenix/pages/experiment/__generated__/ExperimentCompareDetailsQuery.graphql";

import { ExperimentAnnotationButton } from "./ExperimentAnnotationButton";
import { ExperimentRunMetadata } from "./ExperimentRunMetadata";

type ExperimentCompareDetailsProps = {
  datasetId: string;
  datasetExampleId: string;
  datasetVersionId: string;
  baseExperimentId: string;
  compareExperimentIds: string[];
};

type Experiment = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

type ExperimentRun = NonNullable<
  ExperimentCompareDetailsQuery$data["example"]["experimentRuns"]
>["edges"][number]["run"];

export function ExperimentCompareDetails({
  datasetId,
  datasetExampleId,
  datasetVersionId,
  baseExperimentId,
  compareExperimentIds,
}: ExperimentCompareDetailsProps) {
  const experimentIds = [baseExperimentId, ...compareExperimentIds];
  const exampleData = useLazyLoadQuery<ExperimentCompareDetailsQuery>(
    graphql`
      query ExperimentCompareDetailsQuery(
        $datasetId: ID!
        $datasetExampleId: ID!
        $datasetVersionId: ID!
        $experimentIds: [ID!]!
      ) {
        example: node(id: $datasetExampleId) {
          ... on DatasetExample {
            revision(datasetVersionId: $datasetVersionId) {
              input
              referenceOutput: output
            }
            experimentRuns(experimentIds: $experimentIds, first: 120) {
              edges {
                run: node {
                  id
                  latencyMs
                  experimentId
                  output
                  error
                  costSummary {
                    total {
                      cost
                      tokens
                    }
                  }
                  annotations {
                    edges {
                      annotation: node {
                        id
                        name
                        label
                        score
                      }
                    }
                  }
                }
              }
            }
          }
        }
        dataset: node(id: $datasetId) {
          ... on Dataset {
            experiments(filterIds: $experimentIds) {
              edges {
                experiment: node {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `,
    {
      datasetId,
      datasetExampleId,
      datasetVersionId,
      experimentIds,
    }
  );

  const input = exampleData.example.revision?.input;
  const referenceOutput = exampleData.example.revision?.referenceOutput;
  const experimentRuns = exampleData.example.experimentRuns?.edges;
  const experiments = exampleData.dataset.experiments?.edges;

  const experimentsById = useMemo(() => {
    return experiments?.reduce(
      (acc, edge) => {
        acc[edge.experiment.id] = edge.experiment;
        return acc;
      },
      {} as Record<string, Experiment>
    );
  }, [experiments]);

  const experimentRunsByExperimentId = useMemo(() => {
    return experimentRuns?.reduce(
      (acc, run) => {
        acc[run.run.experimentId] = [
          ...(acc[run.run.experimentId] || []),
          run.run,
        ];
        return acc;
      },
      {} as Record<string, ExperimentRun[]>
    );
  }, [experimentRuns]);

  return (
    <PanelGroup direction="vertical" autoSaveId="example-compare-panel-group">
      <Suspense>
        <Panel defaultSize={35}>
          <div
            css={css`
              overflow: auto;
              height: 100%;
            `}
          >
            <View overflow="hidden" padding="size-200">
              <Flex direction="row" gap="size-200" flex="1 1 auto">
                <View width="50%">
                  <Card
                    title="Input"
                    extra={
                      <CopyToClipboardButton text={JSON.stringify(input)} />
                    }
                  >
                    <View maxHeight="300px" overflow="auto">
                      <JSONBlock value={JSON.stringify(input, null, 2)} />
                    </View>
                  </Card>
                </View>
                <View width="50%">
                  <Card
                    title="Reference Output"
                    extra={
                      <CopyToClipboardButton
                        text={JSON.stringify(referenceOutput)}
                      />
                    }
                  >
                    <View maxHeight="300px" overflow="auto">
                      <JSONBlock
                        value={JSON.stringify(referenceOutput, null, 2)}
                      />
                    </View>
                  </Card>
                </View>
              </Flex>
            </View>
          </div>
        </Panel>
        <PanelResizeHandle css={resizeHandleCSS} />
        <Panel defaultSize={65}>
          <Flex direction="column" height="100%">
            <View
              paddingStart="size-200"
              paddingEnd="size-200"
              paddingTop="size-100"
              paddingBottom="size-100"
              borderBottomColor="dark"
              borderBottomWidth="thin"
              flex="none"
            >
              <Heading level={2}>Experiments</Heading>
            </View>
            <div
              css={css`
                overflow-y: auto;
                height: 100%;
                padding: var(--ac-global-dimension-static-size-200);
              `}
            >
              <ul
                css={css`
                  display: flex;
                  flex-direction: row;
                  flex-wrap: none;
                  gap: var(--ac-global-dimension-static-size-200);
                `}
              >
                {experimentIds?.map((experimentId, index) => {
                  const experiment = experimentsById?.[experimentId];
                  if (!experiment) {
                    return null;
                  }
                  return (
                    <li
                      key={experimentId}
                      css={css`
                        // Make them all the same size
                        flex: 1 1 0px;
                      `}
                    >
                      <ExperimentItem
                        experiment={experiment}
                        experimentRuns={
                          experimentRunsByExperimentId?.[experimentId] || []
                        }
                        index={index}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          </Flex>
        </Panel>
      </Suspense>
    </PanelGroup>
  );
}

const experimentItemCSS = css`
  border: 1px solid var(--ac-global-border-color-dark);
  border-radius: var(--ac-global-rounding-small);
  box-shadow: 0px 8px 8px rgba(0 0 0 / 0.05);
  min-width: 500px;
`;

/**
 * Shows a single experiment's output and annotations
 */
function ExperimentItem({
  experiment,
  experimentRuns,
  index,
}: {
  experiment: Experiment;
  experimentRuns: ExperimentRun[];
  index: number;
}) {
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();
  const color =
    index === 0 ? baseExperimentColor : getExperimentColor(index - 1);

  const hasExperimentResult = experimentRuns.length > 0;
  return (
    <div css={experimentItemCSS}>
      <View paddingX="size-200" paddingTop="size-200">
        <Flex direction="row" gap="size-100" alignItems="center">
          <ColorSwatch color={color} shape="circle" />
          <Heading weight="heavy" level={3}>
            {experiment?.name ?? ""}
          </Heading>{" "}
        </Flex>
      </View>
      {!hasExperimentResult ? <Empty message="No Run" /> : null}
      <ul>
        {experimentRuns.map((run, index) => (
          <li key={index}>
            <div
              css={css`
                border-bottom: 1px solid var(--ac-global-border-color-default);
                display: flex;
                flex-direction: column;
                gap: var(--ac-global-dimension-size-100);
              `}
            >
              <View paddingX="size-200" paddingTop="size-100">
                <ExperimentRunMetadata {...run} />
              </View>
              <ul
                css={css`
                  padding: 0 var(--ac-global-dimension-size-100)
                    var(--ac-global-dimension-size-100)
                    var(--ac-global-dimension-size-100);
                `}
              >
                {run.annotations?.edges.map((edge) => (
                  <li key={edge.annotation.id}>
                    <DialogTrigger>
                      <ExperimentAnnotationButton
                        annotation={edge.annotation}
                      />
                      <Popover placement="top">
                        <PopoverArrow />
                        <Dialog style={{ width: 400 }}>
                          <View padding="size-200">
                            <AnnotationDetailsContent
                              annotation={edge.annotation}
                            />
                          </View>
                        </Dialog>
                      </Popover>
                    </DialogTrigger>
                  </li>
                ))}
              </ul>
            </div>
            <View>
              {run.error ? (
                <View padding="size-200">{run.error}</View>
              ) : (
                <JSONBlockWithCopy value={run.output} />
              )}
            </View>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JSONBlockWithCopy({ value }: { value: unknown }) {
  const strValue = JSON.stringify(value, null, 2);
  return (
    <div
      css={css`
        position: relative;
        & button {
          position: absolute;
          top: var(--ac-global-dimension-size-100);
          right: var(--ac-global-dimension-size-100);
          z-index: 10000;
          display: none;
        }
        &:hover button {
          display: block;
        }
      `}
    >
      <CopyToClipboardButton text={strValue} />
      <JSONBlock value={strValue} />
    </div>
  );
}

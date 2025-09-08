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

import { ExperimentAnnotationButton } from "./ExperimentAnnotationButton";
import type { ExperimentInfoMap, TableRow } from "./ExperimentCompareTable";
import { ExperimentRunMetadata } from "./ExperimentRunMetadata";

// TODO: this is an anti-pattern but right now the components are coupled.
// This will be re-factored to encapsulated.
type ExperimentCompareDetailsProps = {
  selectedExample: TableRow;
  experimentInfoById: ExperimentInfoMap;
};

export function ExperimentCompareDetails({
  selectedExample,
  experimentInfoById,
}: ExperimentCompareDetailsProps) {
  return (
    <PanelGroup direction="vertical" autoSaveId="example-compare-panel-group">
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
                    <CopyToClipboardButton
                      text={JSON.stringify(
                        selectedExample.example.revision.input
                      )}
                    />
                  }
                >
                  <View maxHeight="300px" overflow="auto">
                    <JSONBlock
                      value={JSON.stringify(
                        selectedExample.example.revision.input,
                        null,
                        2
                      )}
                    />
                  </View>
                </Card>
              </View>
              <View width="50%">
                <Card
                  title="Reference Output"
                  extra={
                    <CopyToClipboardButton
                      text={JSON.stringify(
                        selectedExample.example.revision.referenceOutput
                      )}
                    />
                  }
                >
                  <View maxHeight="300px" overflow="auto">
                    <JSONBlock
                      value={JSON.stringify(
                        selectedExample.example.revision.referenceOutput,
                        null,
                        2
                      )}
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
              {selectedExample.runComparisonItems.map((runItem, index) => {
                const experiment = experimentInfoById[runItem.experimentId];
                return (
                  <li
                    key={runItem.experimentId}
                    css={css`
                      // Make them all the same size
                      flex: 1 1 0px;
                    `}
                  >
                    <ExperimentItem
                      experiment={experiment}
                      runItem={runItem}
                      index={index}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </Flex>
      </Panel>
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
  runItem,
  index,
}: {
  experiment: ExperimentInfoMap[string];
  runItem: TableRow["runComparisonItems"][number];
  index: number;
}) {
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();
  const color =
    index === 0 ? baseExperimentColor : getExperimentColor(index - 1);

  const hasExperimentResult = runItem.runs.length > 0;
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
        {runItem.runs.map((run, index) => (
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

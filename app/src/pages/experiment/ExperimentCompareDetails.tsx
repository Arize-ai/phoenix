import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

import {
  Card,
  CopyToClipboardButton,
  Flex,
  Heading,
  View,
  ViewSummaryAside,
} from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { JSONBlock } from "@phoenix/components/code";
import { SequenceNumberToken } from "@phoenix/components/experiment";
import { resizeHandleCSS } from "@phoenix/components/resize";

import type { ExperimentInfoMap, TableRow } from "./ExperimentCompareTable";

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
                  extra={<CopyToClipboardButton text={JSON.stringify({})} />}
                >
                  <View maxHeight="300px" overflow="auto">
                    <JSONBlock value={JSON.stringify({})} />
                  </View>
                </Card>
              </View>
              <View width="50%">
                <Card
                  title="Reference Output"
                  extra={<CopyToClipboardButton text={JSON.stringify({})} />}
                >
                  <View maxHeight="300px" overflow="auto">
                    <JSONBlock value={JSON.stringify({}, null, 2)} />
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
              {selectedExample.runComparisonItems.map((runItem) => {
                const experiment = experimentInfoById[runItem.experimentId];
                return (
                  <li key={runItem.experimentId}>
                    <View
                      borderWidth="thin"
                      borderColor="light"
                      borderRadius="medium"
                    >
                      <Flex direction="row" gap="size-100">
                        <Heading>{experiment?.name ?? ""}</Heading>{" "}
                        <SequenceNumberToken
                          sequenceNumber={experiment?.sequenceNumber ?? 0}
                        />
                      </Flex>
                      <ul>
                        {runItem.runs.map((run, index) => (
                          <li key={index}>
                            <Flex direction="row">
                              <View flex>
                                {run.error ? (
                                  <View padding="size-200">{run.error}</View>
                                ) : (
                                  <JSONBlock
                                    value={JSON.stringify(run.output, null, 2)}
                                  />
                                )}
                              </View>
                              <ViewSummaryAside width="size-3000">
                                <ul
                                  css={css`
                                    margin-top: var(
                                      --ac-global-dimension-static-size-100
                                    );
                                    display: flex;
                                    flex-direction: column;
                                    justify-content: flex-start;
                                    align-items: flex-end;
                                    gap: var(
                                      --ac-global-dimension-static-size-100
                                    );
                                  `}
                                >
                                  {run.annotations?.edges.map((edge) => (
                                    <li key={edge.annotation.id}>
                                      <AnnotationLabel
                                        annotation={edge.annotation}
                                      />
                                    </li>
                                  ))}
                                </ul>
                              </ViewSummaryAside>
                            </Flex>
                          </li>
                        ))}
                      </ul>
                    </View>
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

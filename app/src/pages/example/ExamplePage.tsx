import React, { useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useNavigate, useParams } from "react-router";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import {
  Button,
  Card,
  CardProps,
  Dialog,
  DialogContainer,
  Flex,
  Heading,
  View,
} from "@arizeai/components";

import { CopyToClipboardButton } from "@phoenix/components";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { useTheme } from "@phoenix/contexts";

import type { ExamplePageQuery } from "./__generated__/ExamplePageQuery.graphql";
import { EditExampleButton } from "./EditExampleButton";
import { ExampleExperimentRunsTable } from "./ExampleExperimentRunsTable";

/**
 * A page that shows the details of a dataset example.
 */
export function ExamplePage() {
  const { datasetId, exampleId } = useParams();
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<ExamplePageQuery>(
    graphql`
      query ExamplePageQuery($exampleId: GlobalID!) {
        example: node(id: $exampleId) {
          ... on DatasetExample {
            id
            latestRevision: revision {
              input
              output
              metadata
            }
            span {
              context {
                spanId
                traceId
              }
              project {
                id
              }
            }
          }
          ...ExampleExperimentRunsTableFragment
        }
      }
    `,
    { exampleId: exampleId as string },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const revision = useMemo(() => {
    const revision = data.example.latestRevision;
    return {
      input: JSON.stringify(revision?.input, null, 2),
      output: JSON.stringify(revision?.output, null, 2),
      metadata: JSON.stringify(revision?.metadata, null, 2),
    };
  }, [data]);
  const sourceSpanInfo = useMemo(() => {
    const sourceSpan = data.example.span;
    if (!sourceSpan) {
      return null;
    }
    return {
      spanId: sourceSpan.context.spanId,
      traceId: sourceSpan.context.traceId,
      projectId: sourceSpan.project.id,
    };
  }, [data]);
  const { input, output, metadata } = revision;
  const navigate = useNavigate();
  return (
    <DialogContainer
      type="slideOver"
      isDismissable
      onDismiss={() => navigate(`/datasets/${datasetId}/examples`)}
    >
      <Dialog
        size="XL"
        title={`Example: ${exampleId}`}
        extra={
          <Flex direction="row" gap="size-100">
            {sourceSpanInfo ? (
              <Button
                variant="default"
                size="compact"
                onClick={() => {
                  navigate(
                    `/projects/${sourceSpanInfo.projectId}/traces/${sourceSpanInfo.traceId}?selectedSpanId=${sourceSpanInfo.spanId}`
                  );
                }}
              >
                View Source Span
              </Button>
            ) : null}
            <EditExampleButton
              exampleId={exampleId as string}
              currentRevision={revision}
              onCompleted={() => {
                setFetchKey((key) => key + 1);
              }}
            />
          </Flex>
        }
      >
        <PanelGroup direction="vertical" autoSaveId="example-panel-group">
          <Panel defaultSize={200}>
            <div
              css={css`
                overflow-y: auto;
                height: 100%;
              `}
            >
              <Flex direction="row" justifyContent="center">
                <View
                  width="900px"
                  paddingStart="auto"
                  paddingEnd="auto"
                  paddingTop="size-200"
                  paddingBottom="size-200"
                >
                  <Flex direction="column" gap="size-200">
                    <Card
                      title="Input"
                      {...defaultCardProps}
                      extra={<CopyToClipboardButton text={input} />}
                    >
                      <JSONBlock>{input}</JSONBlock>
                    </Card>
                    <Card
                      title="Output"
                      {...defaultCardProps}
                      extra={<CopyToClipboardButton text={output} />}
                    >
                      <JSONBlock>{output}</JSONBlock>
                    </Card>
                    <Card
                      title="Metadata"
                      {...defaultCardProps}
                      extra={<CopyToClipboardButton text={metadata} />}
                    >
                      <JSONBlock>{metadata}</JSONBlock>
                    </Card>
                  </Flex>
                </View>
              </Flex>
            </div>
          </Panel>
          <PanelResizeHandle css={resizeHandleCSS} />
          <Panel defaultSize={100}>
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
                <Heading level={3}>Experiment Runs</Heading>
              </View>
              <ExampleExperimentRunsTable example={data.example} />
            </Flex>
          </Panel>
        </PanelGroup>
      </Dialog>
    </DialogContainer>
  );
}

const defaultCardProps: Partial<CardProps> = {
  backgroundColor: "light",
  borderColor: "light",
  variant: "compact",
  collapsible: true,
  bodyStyle: {
    padding: 0,
  },
};

/**
 * A block of JSON content that is not editable.
 */
export function JSONBlock({ children }: { children: string }) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? undefined : nord;
  // We need to make sure that the content can actually be displayed
  // As JSON as we cannot fully trust the backend to always send valid JSON
  const { value, mimeType } = useMemo(() => {
    try {
      // Attempt to pretty print the JSON. This may fail if the JSON is invalid.
      // E.g. sometimes it contains NANs due to poor JSON.dumps in the backend
      return {
        value: JSON.stringify(JSON.parse(children), null, 2),
        mimeType: "json" as const,
      };
    } catch (e) {
      // Fall back to string
      return { value: children, mimeType: "text" as const };
    }
  }, [children]);
  if (mimeType === "json") {
    return (
      <CodeMirror
        value={value}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          bracketMatching: true,
          syntaxHighlighting: true,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
        extensions={[json(), EditorView.lineWrapping]}
        editable={false}
        theme={codeMirrorTheme}
        css={codeMirrorCSS}
      />
    );
  } else {
    return <PreBlock>{value}</PreBlock>;
  }
}

function PreBlock({ children }: { children: string }) {
  return (
    <pre
      css={css`
        white-space: pre-wrap;
        padding: 0;
      `}
    >
      {children}
    </pre>
  );
}

const codeMirrorCSS = css`
  .cm-content {
    padding: var(--ac-global-dimension-static-size-200) 0;
  }
  .cm-editor,
  .cm-gutters {
    background-color: transparent;
  }
`;

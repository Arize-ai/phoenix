import React, { useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate, useParams } from "react-router";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import {
  Card,
  CardProps,
  Dialog,
  DialogContainer,
  Flex,
  View,
} from "@arizeai/components";

import { CopyToClipboardButton } from "@phoenix/components";
import { useTheme } from "@phoenix/contexts";

import type { DatasetExamplePageQuery } from "./__generated__/DatasetExamplePageQuery.graphql";
import { EditDatasetExampleButton } from "./EditDatasetExampleButton";

/**
 * A page that shows the details of a dataset example.
 */
export function DatasetExamplePage() {
  const { datasetId, exampleId } = useParams();
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<DatasetExamplePageQuery>(
    graphql`
      query DatasetExamplePageQuery($exampleId: GlobalID!) {
        example: node(id: $exampleId) {
          ... on DatasetExample {
            id
            latestRevision: revision {
              input
              output
              metadata
            }
          }
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
  const { input, output, metadata } = revision;
  const navigate = useNavigate();
  return (
    <DialogContainer
      type="slideOver"
      isDismissable
      onDismiss={() => navigate(`/datasets/${datasetId}`)}
    >
      <Dialog
        size="XL"
        title={`Example: ${exampleId}`}
        extra={
          <EditDatasetExampleButton
            exampleId={exampleId as string}
            currentRevision={revision}
            onCompleted={() => {
              setFetchKey((key) => key + 1);
            }}
          />
        }
      >
        <div
          css={css`
            overflow-y: auto;
            padding: var(--ac-global-dimension-size-400);
          `}
        >
          <Flex direction="row" justifyContent="center">
            <View width="900px" paddingStart="auto" paddingEnd="auto">
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

import { Suspense, useCallback, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { python } from "@codemirror/lang-python";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import {
  Dialog,
  DialogContainer,
  Download,
  List,
  ListItem,
} from "@arizeai/components";

import {
  Alert,
  Button,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Icon,
  Icons,
  Loading,
  View,
} from "@phoenix/components";
import { usePointCloudContext, useTheme } from "@phoenix/contexts";

import { ExportSelectionButtonExportsQuery } from "./__generated__/ExportSelectionButtonExportsQuery.graphql";
import { ExportSelectionButtonMutation } from "./__generated__/ExportSelectionButtonMutation.graphql";

type ExportInfo = {
  fileName: string;
};

const EXPORTS_CODE_SNIPPET = `import phoenix as px

exports = px.active_session().exports
dataframe = exports[-1]
dataframe`;

const codeMirrorCSS = css`
  .cm-content {
    padding: var(--ac-global-dimension-static-size-100);
  }
`;
function CodeBlock({ value }: { value: string }) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;
  return (
    <CodeMirror
      value={value}
      basicSetup={false}
      extensions={[python()]}
      editable={false}
      theme={codeMirrorTheme}
      css={codeMirrorCSS}
    />
  );
}

export function ExportSelectionButton() {
  const selectedEventIds = usePointCloudContext(
    (state) => state.selectedEventIds
  );

  const [commit, isInFlight] = useMutation<ExportSelectionButtonMutation>(
    graphql`
      mutation ExportSelectionButtonMutation($eventIds: [ID!]!) {
        exportEvents(eventIds: $eventIds) {
          fileName
        }
      }
    `
  );
  const [exportInfo, setExportInfo] = useState<ExportInfo | null>(null);
  const onPress = useCallback(() => {
    commit({
      variables: {
        eventIds: [...selectedEventIds],
      },
      onCompleted: (data) => {
        setExportInfo(data.exportEvents);
      },
    });
  }, [commit, selectedEventIds]);

  return (
    <>
      <Button
        size="S"
        leadingVisual={
          <Icon
            svg={
              isInFlight ? <Icons.LoadingOutline /> : <Icons.DownloadOutline />
            }
          />
        }
        aria-label="Export selection / cluster"
        isDisabled={isInFlight}
        onPress={onPress}
      >
        {isInFlight ? "Exporting" : "Export"}
      </Button>
      <DialogContainer
        type="slideOver"
        isDismissable
        onDismiss={() => setExportInfo(null)}
      >
        {exportInfo != null && (
          <Dialog title="Cluster Exports" size="M">
            <Alert
              variant="success"
              banner
              title="Export succeeded"
              extra={
                <Button
                  variant="success"
                  size="S"
                  onPress={() => {
                    window.open(
                      `/exports?filename=${exportInfo.fileName}`,
                      "_self"
                    );
                  }}
                >
                  Download
                </Button>
              }
            ></Alert>
            <div
              css={css`
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: flex-start;
                padding: 16px;
                gap: 16px;
              `}
            >
              <p
                css={css`
                  margin: 0;
                  flex: 1 1 auto;
                `}
              >
                You can retrieve your export in your notebook via
              </p>
              <View
                borderColor="light"
                borderWidth="thin"
                borderRadius="medium"
              >
                <CodeBlock value={EXPORTS_CODE_SNIPPET} />
              </View>
            </div>
            <DisclosureGroup defaultExpandedKeys={["all-exports"]}>
              <Disclosure id="all-exports">
                <DisclosureTrigger>Latest Exports</DisclosureTrigger>
                <DisclosurePanel>
                  <Suspense fallback={<Loading />}>
                    <ExportsList />
                  </Suspense>
                </DisclosurePanel>
              </Disclosure>
            </DisclosureGroup>
          </Dialog>
        )}
      </DialogContainer>
    </>
  );
}

function ExportsList() {
  const data = useLazyLoadQuery<ExportSelectionButtonExportsQuery>(
    graphql`
      query ExportSelectionButtonExportsQuery {
        model {
          exportedFiles {
            fileName
          }
        }
      }
    `,
    {},
    {
      fetchPolicy: "network-only",
    }
  );
  return (
    <List>
      {data.model.exportedFiles.map((fileInfo, index) => (
        <ListItem key={index}>
          <div
            css={css`
              display: flex;
              flex-direction: row;
              justify-content: space-between;
              align-items: center;
            `}
          >
            {fileInfo.fileName}
            <Button
              size="S"
              aria-label="Download"
              variant="default"
              leadingVisual={<Icon svg={<Download />} />}
              onPress={() => {
                window.open(`/exports?filename=${fileInfo.fileName}`, "_self");
              }}
            />
          </div>
        </ListItem>
      ))}
    </List>
  );
}

import React, { Suspense, useCallback, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { css } from "@emotion/react";

import {
  Accordion,
  AccordionItem,
  Alert,
  Button,
  Dialog,
  DialogContainer,
  Download,
  Icon,
  List,
  ListItem,
} from "@arizeai/components";

import { Loading } from "@phoenix/components";
import { usePointCloudContext } from "@phoenix/contexts";

import { ExportSelectionButtonExportsQuery } from "./__generated__/ExportSelectionButtonExportsQuery.graphql";
import { ExportSelectionButtonMutation } from "./__generated__/ExportSelectionButtonMutation.graphql";

type ExportInfo = {
  fileName: string;
};

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
  const onClick = useCallback(() => {
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
        variant="default"
        size="compact"
        icon={<Icon svg={<Download />} />}
        aria-label="Export selection / cluster"
        loading={isInFlight}
        onClick={onClick}
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
                  size="compact"
                  onClick={() => {
                    window.open(
                      `/exports?filename=${exportInfo.fileName}`,
                      "_self"
                    );
                  }}
                >
                  Download
                </Button>
              }
            >
              <div
                css={css`
                  display: flex;
                  flex-direction: row;
                  justify-content: space-between;
                  align-items: center;
                  button {
                    flex: none;
                  }
                `}
              >
                <p
                  css={css`
                    margin: 0;
                    flex: 1 1 auto;
                  `}
                >
                  <span>
                    You can retrieve your export in your notebook via{" "}
                  </span>
                  <b>px.active_session().exports</b>
                </p>
              </div>
            </Alert>
            <Accordion>
              <AccordionItem id="all-exports" title="Latest Exports">
                <Suspense fallback={<Loading />}>
                  <ExportsList />
                </Suspense>
              </AccordionItem>
            </Accordion>
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
              size="compact"
              aria-label="Download"
              variant="default"
              icon={<Icon svg={<Download />} />}
              onClick={() => {
                window.open(`/exports?filename=${fileInfo.fileName}`, "_self");
              }}
            />
          </div>
        </ListItem>
      ))}
    </List>
  );
}

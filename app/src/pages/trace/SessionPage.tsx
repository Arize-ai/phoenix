import React from "react";
import { useLoaderData, useNavigate, useParams } from "react-router";

import { Dialog, DialogContainer } from "@arizeai/components";

import { sessionLoaderQuery$data } from "./__generated__/sessionLoaderQuery.graphql";
import { SessionDetails } from "./SessionDetails";

/**
 * A component that shows the details of a session
 */
export function SessionPage() {
  const loaderData = useLoaderData() as sessionLoaderQuery$data;
  const { sessionId, projectId } = useParams();
  const navigate = useNavigate();
  return (
    <DialogContainer
      type="slideOver"
      isDismissable
      onDismiss={() => navigate(`/projects/${projectId}`)}
    >
      <Dialog
        size="fullscreen"
        title={`Session ID: ${loaderData.session?.sessionId ?? "--"}`}
      >
        <SessionDetails sessionId={sessionId as string} />
      </Dialog>
    </DialogContainer>
  );
}

import React from "react";
import { useNavigate, useParams } from "react-router";

import { Dialog, DialogContainer } from "@arizeai/components";

import { SessionDetails } from "./SessionDetails";

/**
 * A component that shows the details of a session
 */
export function SessionPage() {
  const { sessionId, projectId } = useParams();
  const navigate = useNavigate();
  return (
    <DialogContainer
      type="slideOver"
      isDismissable
      onDismiss={() => navigate(`/projects/${projectId}`)}
    >
      <Dialog size="fullscreen" title="Session Details">
        <SessionDetails sessionId={sessionId as string} />
      </Dialog>
    </DialogContainer>
  );
}

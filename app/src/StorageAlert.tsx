import { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Alert } from "@phoenix/components";

import { StorageAlertQuery } from "./__generated__/StorageAlertQuery.graphql";

const storageAlertQuery = graphql`
  query StorageAlertQuery {
    serverStatus {
      insufficientStorage
    }
  }
`;

export function StorageAlert() {
  const data = useLazyLoadQuery<StorageAlertQuery>(storageAlertQuery, {});

  const [dismissed, setDismissed] = useState(false);
  const insufficientStorage = data.serverStatus.insufficientStorage;

  if (!insufficientStorage || dismissed) {
    return null;
  }

  return (
    <Alert
      variant="danger"
      banner
      dismissable
      onDismissClick={() => setDismissed(true)}
    >
      Due to insufficient storage, most operations are restricted.
      {window.Config.supportEmail && (
        <>
          {" Contact "}
          <a href={`mailto:${window.Config.supportEmail}`}>
            {window.Config.supportEmail}
          </a>
          {" for assistance."}
        </>
      )}
    </Alert>
  );
}

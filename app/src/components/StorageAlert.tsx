import { startTransition, useCallback, useEffect, useState } from "react";
import { fetchQuery, graphql, useRelayEnvironment } from "react-relay";

import { Alert } from "@phoenix/components";
import { useInterval } from "@phoenix/hooks/useInterval";

import { StorageAlertQuery } from "./__generated__/StorageAlertQuery.graphql";

const storageAlertQuery = graphql`
  query StorageAlertQuery {
    serverStatus {
      insufficientStorage
    }
  }
`;

/**
 * Check server status every minute
 */
const POLL_INTERVAL_MS = 60000;

export function StorageAlert() {
  const [insufficientStorage, setInsufficientStorage] =
    useState<boolean>(false);
  const environment = useRelayEnvironment();

  // Get support email from static config instead of GraphQL
  const supportEmail = window.Config.supportEmail;

  const pollServerStatus = useCallback(async () => {
    try {
      const data = await fetchQuery<StorageAlertQuery>(
        environment,
        storageAlertQuery,
        {}
      ).toPromise();
      if (data) {
        startTransition(() => {
          setInsufficientStorage(data.serverStatus.insufficientStorage);
        });
      }
    } catch {
      // Silently handle query errors
    }
  }, [environment]);

  useInterval(pollServerStatus, POLL_INTERVAL_MS);

  // Check immediately on mount
  useEffect(() => {
    pollServerStatus();
  }, [pollServerStatus]);

  if (!insufficientStorage) {
    return null;
  }

  return (
    <Alert variant="danger" banner>
      Due to insufficient storage, most operations are restricted.
      {supportEmail && (
        <>
          {" Contact "}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          {" for assistance."}
        </>
      )}
    </Alert>
  );
}

import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Alert } from "@phoenix/components";

import type { PublicEncryptionKeyWarningQuery } from "./__generated__/PublicEncryptionKeyWarningQuery.graphql";

export function PublicEncryptionKeyWarning({ banner }: { banner?: boolean }) {
  return (
    // Keep settings mounted while the warning query is pending.
    <Suspense fallback={null}>
      <PublicEncryptionKeyWarningAlert banner={banner} />
    </Suspense>
  );
}

const publicEncryptionKeyWarningQuery = graphql`
  query PublicEncryptionKeyWarningQuery {
    serverStatus {
      databaseEncryptionKeyIsPublic
    }
  }
`;

function PublicEncryptionKeyWarningAlert({ banner }: { banner?: boolean }) {
  const data = useLazyLoadQuery<PublicEncryptionKeyWarningQuery>(
    publicEncryptionKeyWarningQuery,
    {},
    { fetchPolicy: "store-or-network" }
  );
  if (data.serverStatus.databaseEncryptionKeyIsPublic !== true) {
    return null;
  }
  return (
    <Alert
      variant="warning"
      title="Configure encryption for saved credentials"
      banner={banner}
    >
      PHOENIX_SECRET is not set. Saved credentials use a default encryption key,
      so anyone with a copy of the database can decrypt them. Set PHOENIX_SECRET
      on the server to protect saved credentials; existing credentials will need
      to be entered again.
    </Alert>
  );
}

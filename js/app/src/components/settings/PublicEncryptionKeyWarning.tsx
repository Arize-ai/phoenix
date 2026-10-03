import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Alert } from "@phoenix/components";

import type { PublicEncryptionKeyWarningQuery } from "./__generated__/PublicEncryptionKeyWarningQuery.graphql";

/**
 * Warns that credentials saved here are encrypted with a publicly known key.
 *
 * Shown only when `serverStatus.databaseEncryptionKeyIsPublic` is true. Admins,
 * and every viewer when authentication is disabled, receive that boolean; other
 * viewers receive null. The query is `store-or-network` inside a suspense
 * boundary with an empty fallback, so a pending response leaves the surrounding
 * form mounted.
 *
 * Place wherever a credential is about to be saved. Without PHOENIX_SECRET the
 * encryption key is derived from an empty value, so anyone with a copy of the
 * database can decrypt saved credentials.
 */
export function PublicEncryptionKeyWarning({ banner }: { banner?: boolean }) {
  return (
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
      title="Saved credentials are not protected"
      banner={banner}
    >
      PHOENIX_SECRET is not set, so credentials saved here are encrypted with a
      publicly known key. Anyone with a copy of the database can read them. Set
      PHOENIX_SECRET on the server to protect them; credentials saved before
      then will need to be entered again.
    </Alert>
  );
}

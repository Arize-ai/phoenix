import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Card, Loading, View } from "@phoenix/components";

import type { OAuth2GrantsCardQuery } from "./__generated__/OAuth2GrantsCardQuery.graphql";
import { OAuth2GrantsTable } from "./OAuth2GrantsTable";

function OAuth2GrantsCardContent() {
  const query = useLazyLoadQuery<OAuth2GrantsCardQuery>(
    graphql`
      query OAuth2GrantsCardQuery {
        ...OAuth2GrantsTableFragment
      }
    `,
    {},
    { fetchPolicy: "network-only" }
  );

  return <OAuth2GrantsTable query={query} />;
}

export function OAuth2GrantsCard() {
  return (
    <Card
      titleSeparator={false}
      title="Authorized Applications"
      subTitle="Applications users have granted access to via OAuth2. Revoking disables the application's tokens immediately."
    >
      <Suspense
        fallback={
          <View padding="size-100">
            <Loading />
          </View>
        }
      >
        <OAuth2GrantsCardContent />
      </Suspense>
    </Card>
  );
}

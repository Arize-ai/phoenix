import React, { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  Icon,
  Icons,
  TabbedCard,
  TabPane,
  Tabs,
} from "@arizeai/components";

import { Loading } from "@phoenix/components";

import { APIKeysCardQuery } from "./__generated__/APIKeysCardQuery.graphql";
import { SystemAPIKeysTable } from "./SystemAPIKeysTable";

function APIKeysCardContent() {
  const query = useLazyLoadQuery<APIKeysCardQuery>(
    graphql`
      query APIKeysCardQuery {
        ...SystemAPIKeysTableFragment
      }
    `,
    {}
  );

  return (
    <Tabs>
      <TabPane title="System Keys" name="System Keys">
        <SystemAPIKeysTable query={query} />
      </TabPane>
      <TabPane title="User Keys" name="User Keys">
        <p>Create API Key</p>
      </TabPane>
    </Tabs>
  );
}

export function APIKeysCard() {
  return (
    <TabbedCard
      title="API Keys"
      variant="compact"
      extra={
        <Button
          variant="default"
          size="compact"
          icon={<Icon svg={<Icons.PlusCircleOutline />} />}
        >
          System Key
        </Button>
      }
    >
      <Suspense fallback={<Loading />}>
        <APIKeysCardContent />
      </Suspense>
    </TabbedCard>
  );
}

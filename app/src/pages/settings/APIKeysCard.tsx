import React, { ReactNode, Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  DialogContainer,
  Icon,
  Icons,
  TabbedCard,
  TabPane,
  Tabs,
} from "@arizeai/components";

import { Loading } from "@phoenix/components";

import { APIKeysCardQuery } from "./__generated__/APIKeysCardQuery.graphql";
import { CreateSystemAPIKeyDialog } from "./CreateSystemAPIKeyDialog";
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
  const [dialog, setDialog] = useState<ReactNode>(null);
  const showCreateSystemAPIKeyDialog = () => {
    setDialog(<CreateSystemAPIKeyDialog />);
  };
  return (
    <div>
      <TabbedCard
        title="API Keys"
        variant="compact"
        extra={
          <Button
            variant="default"
            size="compact"
            icon={<Icon svg={<Icons.PlusCircleOutline />} />}
            onClick={showCreateSystemAPIKeyDialog}
          >
            System Key
          </Button>
        }
      >
        <Suspense fallback={<Loading />}>
          <APIKeysCardContent />
        </Suspense>
      </TabbedCard>
      <DialogContainer onDismiss={() => setDialog(null)}>
        {dialog}
      </DialogContainer>
    </div>
  );
}

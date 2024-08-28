import React, { ReactNode, Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Alert,
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  TabbedCard,
  TabPane,
  Tabs,
  TextField,
  View,
} from "@arizeai/components";

import { CopyToClipboardButton, Loading } from "@phoenix/components";

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
        <p>Coming Soon</p>
      </TabPane>
    </Tabs>
  );
}

export function APIKeysCard() {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const showOneTimeAPIKeyDialog = (jwt: string) => {
    setDialog(<OneTimeAPIKeyDialog jwt={jwt} />);
  };
  const showCreateSystemAPIKeyDialog = () => {
    setDialog(
      <CreateSystemAPIKeyDialog onSystemKeyCreated={showOneTimeAPIKeyDialog} />
    );
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
        <Suspense
          fallback={
            <View padding="size-e00">
              <Loading />
            </View>
          }
        >
          <APIKeysCardContent />
        </Suspense>
      </TabbedCard>
      <DialogContainer
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </div>
  );
}

/**
 * Displays the key one time for the user to copy.
 */
function OneTimeAPIKeyDialog(props: { jwt: string }) {
  const { jwt } = props;
  return (
    <Dialog title="New API Key Created" isDismissable>
      <Alert variant="success" banner>
        You have successfully created a new API key. The API key will only be
        displayed once below. Please copy and save it in a secure location.
      </Alert>
      <div
        css={css`
          padding: var(--ac-global-dimension-size-200);
          .ac-field {
            width: 100%;
          }
        `}
      >
        <Flex direction="row" gap="size-100" alignItems="end">
          <TextField label="API Key" isReadOnly value={jwt} minWidth="100%" />
          <CopyToClipboardButton text={jwt} size="normal" />
        </Flex>
      </div>
    </Dialog>
  );
}

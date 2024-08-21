import React, { ReactNode, Suspense, useState } from "react";

import {
  Button,
  Card,
  DialogContainer,
  Icon,
  Icons,
} from "@arizeai/components";

import { Loading } from "@phoenix/components";

import { NewUserDialog } from "./NewUserDialog";
import { UsersTable } from "./UsersTable";

export function UsersCard() {
  const [dialog, setDialog] = useState<ReactNode>(null);

  return (
    <Card
      title="Users"
      variant="compact"
      bodyStyle={{ padding: 0 }}
      extra={
        <Button
          onClick={() => {
            setDialog(<NewUserDialog />);
          }}
          variant="default"
          size="compact"
          icon={<Icon svg={<Icons.PlusCircleOutline />} />}
        >
          Create User
        </Button>
      }
    >
      <Suspense fallback={<Loading />}>
        <UsersTable />
      </Suspense>
      <DialogContainer
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </Card>
  );
}

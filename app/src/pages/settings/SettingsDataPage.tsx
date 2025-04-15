import React from "react";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Card } from "@arizeai/components";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  Modal,
  View,
} from "@phoenix/components";

import { RetentionPoliciesTable } from "./RetentionPoliciesTable";
import { settingsDataPageLoader } from "./settingsDataPageLoader";

export function SettingsDataPage() {
  const loaderData = useLoaderData<typeof settingsDataPageLoader>();
  invariant(loaderData, "loaderData is required");

  return (
    <Card
      title="Retention Policies"
      bodyStyle={{ padding: 0 }}
      variant="compact"
      extra={
        <DialogTrigger>
          <Button size="S" leadingVisual={<Icon svg={<Icons.PlusOutline />} />}>
            New Policy
          </Button>
          <Modal>
            <Dialog>
              <Heading slot="title">New Retention Policy</Heading>
              <View padding="size-100" borderTopWidth="thin" borderColor="dark">
                <Flex direction="row" justifyContent="end" gap="size-100">
                  <Button size="S" slot="close">
                    Cancel
                  </Button>
                  <Button size="S">Create</Button>
                </Flex>
              </View>
            </Dialog>
          </Modal>
        </DialogTrigger>
      }
    >
      <RetentionPoliciesTable query={loaderData} />
    </Card>
  );
}

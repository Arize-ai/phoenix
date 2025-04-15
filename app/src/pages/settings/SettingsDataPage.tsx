import React from "react";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Form,
  Heading,
  Icon,
  Icons,
  Input,
  Label,
  Modal,
  NumberField,
  Text,
  TextField,
  View,
} from "@phoenix/components";

import { RetentionPoliciesTable } from "./RetentionPoliciesTable";
import { RetentionPolicyForm } from "./RetentionPolicyForm";
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
              <RetentionPolicyForm />
            </Dialog>
          </Modal>
        </DialogTrigger>
      }
    >
      <RetentionPoliciesTable query={loaderData} />
    </Card>
  );
}

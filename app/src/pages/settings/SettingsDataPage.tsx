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
              <View padding="size-200">
                <p>
                  A retention policy can be defined so that either a certain
                  number of traces or traces for a certain amount of time is
                  retained in certain projects.
                </p>
                <p>
                  Once a retention policy is defined, you can associate multiple
                  projects to the same policy.
                </p>
                <Flex direction="row" gap="size-100">
                  <Form
                    css={css`
                      flex: 1 1 auto;
                    `}
                  >
                    <NumberField
                      step={100}
                      css={{
                        minWidth: "100%",
                      }}
                      size="S"
                      defaultValue={0}
                    >
                      <Label>Number of Traces</Label>
                      <Input />
                      <Text slot="description">
                        The number of traces that will be kept
                      </Text>
                    </NumberField>
                    <NumberField
                      step={100}
                      css={{
                        minWidth: "100%",
                      }}
                      size="S"
                      defaultValue={400}
                    >
                      <Label>Number of Days</Label>
                      <Input />
                      <Text slot="description">
                        The number of days that will be kept
                      </Text>
                    </NumberField>
                    <TextField
                      name="explanation"
                      size="S"
                      defaultValue="0 0 * * 0"
                    >
                      <Label>Schedule</Label>
                      <Input />
                      <Text slot="description">
                        A cron expression for the day of the week
                      </Text>
                    </TextField>
                  </Form>
                  <View width="300px" padding="size-200">
                    <Heading level={2}>Retention Policy</Heading>
                    <Text color="text-700">
                      This policy will delete traces that are older than 100
                      days.
                    </Text>
                  </View>
                </Flex>
              </View>
              <View
                paddingY="size-100"
                paddingX="size-200"
                borderTopWidth="thin"
                borderColor="dark"
              >
                <Flex direction="row" justifyContent="end" gap="size-100">
                  <Button size="S" slot="close">
                    Cancel
                  </Button>
                  <Button size="S" variant="primary">
                    Create
                  </Button>
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

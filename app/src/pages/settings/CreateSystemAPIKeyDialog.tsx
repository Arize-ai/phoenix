import React from "react";
import { Form } from "react-router-dom";

import { Button, Dialog, Flex, TextField, View } from "@arizeai/components";

export function CreateSystemAPIKeyDialog() {
  return (
    <Dialog title="Create System Key">
      <Form>
        <TextField label="Name" />
        <TextField label="Description" />
        <TextField label="Expires At" type="datetime" />
        <View padding="size-100" borderColor="dark">
          <Flex direction="row" gap="size-100" alignItems="end">
            <Button variant="primary" type="submit">
              Create
            </Button>
          </Flex>
        </View>
      </Form>
    </Dialog>
  );
}

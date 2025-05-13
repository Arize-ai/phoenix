import { useState } from "react";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Card } from "@arizeai/components";

import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Icon,
  Icons,
  Modal,
} from "@phoenix/components";
import { CanManageRetentionPolicy } from "@phoenix/components/auth";

import { CreateRetentionPolicy } from "./CreateRetentionPolicy";
import { RetentionPoliciesTable } from "./RetentionPoliciesTable";
import { settingsDataPageLoader } from "./settingsDataPageLoader";

export function SettingsDataPage() {
  const [fetchKey, setFetchKey] = useState(0);
  const loaderData = useLoaderData<typeof settingsDataPageLoader>();
  invariant(loaderData, "loaderData is required");

  return (
    <Card
      title="Retention Policies"
      bodyStyle={{ padding: 0 }}
      variant="compact"
      extra={
        <CanManageRetentionPolicy>
          <DialogTrigger>
            <Button
              size="S"
              leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
            >
              New Policy
            </Button>
            <Modal>
              <Dialog>
                {({ close }) => (
                  <>
                    <Heading slot="title">New Retention Policy</Heading>
                    <CreateRetentionPolicy
                      onCreate={() => {
                        setFetchKey(fetchKey + 1);
                        close();
                      }}
                    />
                  </>
                )}
              </Dialog>
            </Modal>
          </DialogTrigger>
        </CanManageRetentionPolicy>
      }
    >
      <RetentionPoliciesTable query={loaderData} fetchKey={fetchKey} />
    </Card>
  );
}

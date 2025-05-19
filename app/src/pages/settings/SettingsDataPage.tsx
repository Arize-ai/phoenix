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
  const loaderData = useLoaderData<typeof settingsDataPageLoader>();
  invariant(loaderData, "loaderData is required");
  const queryId = loaderData.__id;
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
                      queryId={queryId}
                      onCreate={() => {
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
      <RetentionPoliciesTable query={loaderData} />
    </Card>
  );
}

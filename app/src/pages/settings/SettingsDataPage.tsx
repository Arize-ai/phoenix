import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Card } from "@arizeai/components";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
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
            <ModalOverlay>
              <Modal>
                <Dialog>
                  {({ close }) => (
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>New Retention Policy</DialogTitle>
                        <DialogTitleExtra>
                          <DialogCloseButton slot="close" />
                        </DialogTitleExtra>
                      </DialogHeader>
                      <CreateRetentionPolicy
                        queryId={queryId}
                        onCreate={() => {
                          close();
                        }}
                      />
                    </DialogContent>
                  )}
                </Dialog>
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
        </CanManageRetentionPolicy>
      }
    >
      <RetentionPoliciesTable query={loaderData} />
    </Card>
  );
}

import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  Button,
  Card,
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
import {
  SettingsDataLoaderType,
  settingsDataPageLoaderGql,
} from "./settingsDataPageLoader";

export function SettingsDataPage() {
  const loaderData = useLoaderData<SettingsDataLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery(settingsDataPageLoaderGql, loaderData);
  return (
    <Card
      title="Retention Policies"
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
      <RetentionPoliciesTable query={data} />
    </Card>
  );
}

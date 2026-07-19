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

import type { settingsDataPageLoaderQuery } from "./__generated__/settingsDataPageLoaderQuery.graphql";
import { CreateRetentionPolicy } from "./CreateRetentionPolicy";
import { RetentionPoliciesTable } from "./RetentionPoliciesTable";
import type { SettingsDataLoaderType } from "./settingsDataPageLoader";
import { settingsDataPageLoaderGql } from "./settingsDataPageLoader";
import { SettingsDocumentationHelp } from "./SettingsDocumentationHelp";

export function SettingsDataPage() {
  const loaderData = useLoaderData<SettingsDataLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery<settingsDataPageLoaderQuery>(
    settingsDataPageLoaderGql,
    loaderData
  );
  return (
    <Card
      title="Retention Policies"
      titleExtra={
        <SettingsDocumentationHelp topic="dataRetention">
          Automatically purge project traces by age or trace count on a
          configurable schedule.
        </SettingsDocumentationHelp>
      }
      extra={
        <CanManageRetentionPolicy>
          <DialogTrigger>
            <Button
              size="S"
              variant="primary"
              leadingVisual={<Icon svg={<Icons.Plus />} />}
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

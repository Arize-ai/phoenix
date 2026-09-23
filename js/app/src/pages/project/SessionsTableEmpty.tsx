import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  View,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { usePreferencesContext } from "@phoenix/contexts";

import { PythonSessionsGuide } from "./PythonSessionsGuide";
import { TypeScriptSessionsGuide } from "./TypeScriptSessionsGuide";

function SetupSessionsDialog() {
  const { programmingLanguage, setProgrammingLanguage } = usePreferencesContext(
    (state) => ({
      programmingLanguage: state.programmingLanguage,
      setProgrammingLanguage: state.setProgrammingLanguage,
    })
  );
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set up Sessions for this Project</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-400" overflow="auto">
          <View paddingBottom="size-100">
            <CodeLanguageRadioGroup
              language={programmingLanguage}
              onChange={setProgrammingLanguage}
            />
          </View>
          {programmingLanguage === "Python" ? (
            <PythonSessionsGuide />
          ) : (
            <TypeScriptSessionsGuide />
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
}

export function SessionsTableEmpty() {
  return (
    <TableEmptyWrap>
      <EmptyState
        graphic={<EmptyStateGraphic variant="session" />}
        description="No sessions found for this project"
        action={{
          type: "strip",
          items: [
            {
              kind: "node",
              node: (
                <DialogTrigger>
                  <Button size="S">Set up Sessions</Button>
                  <ViewportModalOverlay>
                    <ViewportModal size="L">
                      <SetupSessionsDialog />
                    </ViewportModal>
                  </ViewportModalOverlay>
                </DialogTrigger>
              ),
            },
          ],
        }}
      />
    </TableEmptyWrap>
  );
}

import { useState } from "react";

import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Modal,
  ModalOverlay,
  View,
} from "@phoenix/components";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { PythonProjectGuide } from "@phoenix/components/project/PythonProjectGuide";
import { TypeScriptProjectGuide } from "@phoenix/components/project/TypeScriptProjectGuide";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { usePreferencesContext } from "@phoenix/contexts";

function SetupProjectDialog({ projectName }: { projectName: string }) {
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
          <DialogTitle>Send Traces to this Project</DialogTitle>
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
            <PythonProjectGuide projectName={projectName} />
          ) : (
            <TypeScriptProjectGuide projectName={projectName} />
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectTableEmpty({ projectName }: { projectName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <TableEmptyWrap>
      <EmptyState
        graphic={<EmptyStateGraphic variant="trace" />}
        description="No traces found that match the selected filters"
        action={{
          type: "strip",
          items: [
            {
              kind: "button",
              children: "Get Started",
              onPress: () => setIsOpen(true),
            },
          ],
        }}
      />
      <ModalOverlay isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal variant="slideover" size="L">
          <SetupProjectDialog projectName={projectName} />
        </Modal>
      </ModalOverlay>
    </TableEmptyWrap>
  );
}

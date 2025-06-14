import { useState } from "react";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  View,
} from "@phoenix/components";
import { CodeLanguage, CodeLanguageRadioGroup } from "@phoenix/components/code";

import { PythonSessionsGuide } from "./PythonSessionsGuide";
import { TypeScriptSessionsGuide } from "./TypeScriptSessionsGuide";

function SetupSessionsDialog({ onDismiss }: { onDismiss: () => void }) {
  const [language, setLanguage] = useState<CodeLanguage>("Python");
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup Sessions for this Project</DialogTitle>
          <DialogTitleExtra>
            <Button
              size="S"
              data-testid="dialog-close-button"
              leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
              onPress={onDismiss}
              type="button"
              variant="default"
            />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-400" overflow="auto">
          <View paddingBottom="size-100">
            <CodeLanguageRadioGroup
              language={language}
              onChange={setLanguage}
            />
          </View>
          {language === "Python" ? (
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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <tbody className="is-empty">
      <tr>
        <td
          colSpan={100}
          css={css`
            text-align: center;
            padding: var(--ac-global-dimension-size-300)
              var(--ac-global-dimension-size-300) !important;
          `}
        >
          <Flex direction="column" gap="size-200" alignItems="center">
            No sessions found for this project
            <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
              <Button
                leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
              >
                Setup Sessions
              </Button>
              <ModalOverlay>
                <Modal
                  variant="slideover"
                  size="L"
                  css={css`
                    width: 70vw !important;
                  `}
                >
                  <SetupSessionsDialog onDismiss={() => setIsOpen(false)} />
                </Modal>
              </ModalOverlay>
            </DialogTrigger>
          </Flex>
        </td>
      </tr>
    </tbody>
  );
}

import { useState } from "react";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogCloseButton,
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

function SetupSessionsDialog() {
  const [language, setLanguage] = useState<CodeLanguage>("Python");
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup Sessions for this Project</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
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
            <DialogTrigger>
              <Button
                leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
              >
                Setup Sessions
              </Button>
              <ModalOverlay>
                <Modal variant="slideover" size="L">
                  <SetupSessionsDialog />
                </Modal>
              </ModalOverlay>
            </DialogTrigger>
          </Flex>
        </td>
      </tr>
    </tbody>
  );
}

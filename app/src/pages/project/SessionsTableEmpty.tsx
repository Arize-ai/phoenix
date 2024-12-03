import React, { ReactNode, useState } from "react";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  View,
} from "@arizeai/components";

import { CodeLanguage, CodeLanguageRadioGroup } from "@phoenix/components/code";

import { PythonSessionsGuide } from "./PythonSessionsGuide";

export function SessionsTableEmpty() {
  const [dialog, setDialog] = useState<ReactNode | null>(null);
  const [language, setLanguage] = useState<CodeLanguage>("Python");
  const onGettingStartedClick = () => {
    setDialog(
      <Dialog title="Setup Sessions" size="L">
        <View padding="size-400" overflow="auto">
          <View paddingBottom="size-100">
            <CodeLanguageRadioGroup
              language={language}
              onChange={setLanguage}
            />
          </View>
          {language === "Python" ? <PythonSessionsGuide /> : "coming soon"}
        </View>
      </Dialog>
    );
  };

  return (
    <tbody className="is-empty">
      <tr>
        <td
          colSpan={100}
          css={(theme) => css`
            text-align: center;
            padding: ${theme.spacing.margin24}px ${theme.spacing.margin24}px !important;
          `}
        >
          <Flex direction="column" gap="size-200" alignItems="center">
            No sessions found for this project
            <Button
              variant="default"
              icon={<Icon svg={<Icons.PlayCircleOutline />} />}
              onClick={onGettingStartedClick}
            >
              Setup Sessions
            </Button>
          </Flex>
        </td>
      </tr>
      <DialogContainer
        onDismiss={() => setDialog(null)}
        isDismissable
        type="slideOver"
      >
        {dialog}
      </DialogContainer>
    </tbody>
  );
}

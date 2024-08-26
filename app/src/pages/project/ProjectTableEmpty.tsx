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
import { PythonProjectGuide } from "@phoenix/components/project/PythonProjectGuide";
import { TypeScriptProjectGuide } from "@phoenix/components/project/TypeScriptProjectGuide";

function SetupProjectDialog({ projectName }: { projectName: string }) {
  const [language, setLanguage] = useState<CodeLanguage>("Python");
  return (
    <Dialog title="Send Traces to this Project" size="L">
      <View padding="size-400" overflow="auto">
        <View paddingBottom="size-100">
          <CodeLanguageRadioGroup language={language} onChange={setLanguage} />
        </View>
        {language === "Python" ? (
          <PythonProjectGuide projectName={projectName} />
        ) : (
          <TypeScriptProjectGuide projectName={projectName} />
        )}
      </View>
    </Dialog>
  );
}

export function ProjectTableEmpty({ projectName }: { projectName: string }) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const onGettingStartedClick = () => {
    setDialog(<SetupProjectDialog projectName={projectName} />);
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
            No traces found for this project
            <Button
              variant="default"
              icon={<Icon svg={<Icons.PlayCircleOutline />} />}
              onClick={onGettingStartedClick}
            >
              Get Started
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

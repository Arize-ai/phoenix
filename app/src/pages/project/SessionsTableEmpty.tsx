import { ReactNode, useState } from "react";
import { css } from "@emotion/react";

import { Dialog, DialogContainer } from "@arizeai/components";

import { Button, Flex, Icon, Icons, View } from "@phoenix/components";
import { CodeLanguage, CodeLanguageRadioGroup } from "@phoenix/components/code";

import { PythonSessionsGuide } from "./PythonSessionsGuide";
import { TypeScriptSessionsGuide } from "./TypeScriptSessionsGuide";

function SetupSessionsDialog() {
  const [language, setLanguage] = useState<CodeLanguage>("Python");
  return (
    <Dialog title="Setup Sessions for this Project" size="L">
      <View padding="size-400" overflow="auto">
        <View paddingBottom="size-100">
          <CodeLanguageRadioGroup language={language} onChange={setLanguage} />
        </View>
        {language === "Python" ? (
          <PythonSessionsGuide />
        ) : (
          <TypeScriptSessionsGuide />
        )}
      </View>
    </Dialog>
  );
}
export function SessionsTableEmpty() {
  const [dialog, setDialog] = useState<ReactNode | null>(null);

  const onGettingStartedPress = () => {
    setDialog(<SetupSessionsDialog />);
  };

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
            <Button
              leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
              onPress={onGettingStartedPress}
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

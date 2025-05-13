import { ReactNode, useState } from "react";
import { css } from "@emotion/react";

import { Dialog, DialogContainer } from "@arizeai/components";

import { Button, Flex, Icon, Icons, View } from "@phoenix/components";
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
  const onGettingStartedPress = () => {
    setDialog(<SetupProjectDialog projectName={projectName} />);
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
            No traces found that match the selected filters
            <Button
              variant="default"
              leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
              onPress={onGettingStartedPress}
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

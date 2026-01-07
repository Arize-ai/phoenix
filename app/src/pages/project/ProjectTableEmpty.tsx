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
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { PythonProjectGuide } from "@phoenix/components/project/PythonProjectGuide";
import { TypeScriptProjectGuide } from "@phoenix/components/project/TypeScriptProjectGuide";
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
  return (
    <>
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
              <DialogTrigger>
                <Button
                  variant="default"
                  leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
                >
                  Get Started
                </Button>
                <ModalOverlay>
                  <Modal variant="slideover" size="L">
                    <SetupProjectDialog projectName={projectName} />
                  </Modal>
                </ModalOverlay>
              </DialogTrigger>
            </Flex>
          </td>
        </tr>
      </tbody>
    </>
  );
}

import { useState } from "react";
import { css } from "@emotion/react";

import {
  Button,
  ButtonProps,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  ExternalLink,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import { CodeLanguage, CodeLanguageRadioGroup } from "@phoenix/components/code";
import { TypeScriptProjectGuide } from "@phoenix/components/project/TypeScriptProjectGuide";

import { PythonProjectGuide } from "../../components/project/PythonProjectGuide";

const PHOENIX_OTEL_DOC_LINK =
  "https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing";

type NewProjectButtonProps = {
  variant?: ButtonProps["variant"];
};
export function NewProjectButton({ variant }: NewProjectButtonProps) {
  return (
    <div>
      <DialogTrigger>
        <Button
          leadingVisual={<Icon svg={<Icons.GridOutline />} />}
          size="S"
          variant={variant}
        >
          New Project
        </Button>
        <ModalOverlay>
          <Modal
            variant="slideover"
            size="L"
            css={css`
              width: 70vw !important;
            `}
          >
            <NewProjectDialog />
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </div>
  );
}

function NewProjectDialog() {
  const [language, setLanguage] = useState<CodeLanguage>("Python");
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Project</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-400" overflow="auto">
          <View paddingBottom="size-200">
            <CodeLanguageRadioGroup
              language={language}
              onChange={setLanguage}
            />
          </View>
          <View paddingBottom="size-100">
            <Text>
              Projects are created when you log your first trace via
              OpenTelemetry. See the{" "}
              <ExternalLink href={PHOENIX_OTEL_DOC_LINK}>
                documentation
              </ExternalLink>{" "}
              for a complete guide.
            </Text>
          </View>
          {language === "Python" ? (
            <PythonProjectGuide />
          ) : (
            <TypeScriptProjectGuide />
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
}

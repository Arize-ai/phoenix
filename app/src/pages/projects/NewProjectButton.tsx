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
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import { TypeScriptProjectGuide } from "@phoenix/components/project/TypeScriptProjectGuide";
import { ManualProjectGuide } from "@phoenix/pages/projects/ManualProjectGuide";

import { PythonProjectGuide } from "../../components/project/PythonProjectGuide";

type NewProjectButtonProps = {
  variant?: ButtonProps["variant"];
};
const PHOENIX_OTEL_DOC_LINK =
  "https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing";

function TraceBasedProjectGuideIntro() {
  return (
    <Text>
      Projects are created when you log your first trace via OpenTelemetry. See
      the{" "}
      <ExternalLink href={PHOENIX_OTEL_DOC_LINK}>documentation</ExternalLink>{" "}
      for a complete guide.
    </Text>
  );
}
export function NewProjectButton({ variant }: NewProjectButtonProps) {
  return (
    <div>
      <DialogTrigger>
        <Button
          leadingVisual={<Icon svg={<Icons.GridOutline />} />}
          size="M"
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
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Project</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <Tabs>
          <TabList>
            <Tab id="python">Python</Tab>
            <Tab id="typescript">TypeScript</Tab>
            <Tab id="manual">Manual</Tab>
          </TabList>
          <TabPanel id="python">
            <View padding="size-200" overflow="auto">
              <TraceBasedProjectGuideIntro />
              <PythonProjectGuide />
            </View>
          </TabPanel>
          <TabPanel id="typescript">
            <View padding="size-200" overflow="auto">
              <TraceBasedProjectGuideIntro />
              <TypeScriptProjectGuide />
            </View>
          </TabPanel>
          <TabPanel id="manual">
            <View padding="size-200" overflow="auto">
              <ManualProjectGuide />
            </View>
          </TabPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

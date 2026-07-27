import { Suspense, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Modal,
  ModalOverlay,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import type { TextDiffStyle } from "@phoenix/components/diff";
import { DiffStyleToggle, TextDiff } from "@phoenix/components/diff";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import {
  instanceToPromptVersion,
  promptVersionToInstance,
} from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { getInstancePromptParamsFromStore } from "@phoenix/pages/playground/playgroundPromptUtils";
import {
  chatPromptVersionInputToConfigText,
  chatPromptVersionInputToTemplateText,
} from "@phoenix/pages/playground/promptVersionInputDiffText";
import type { PlaygroundInstance } from "@phoenix/store/playground";

import type { PromptDiffButtonQuery } from "./__generated__/PromptDiffButtonQuery.graphql";

type PromptDiffButtonProps = {
  instanceId: number;
};

/**
 * A button that opens a git-like diff of the playground instance's current
 * (possibly unsaved) state against the prompt version it was loaded from.
 * Renders nothing when the instance is not linked to a saved prompt.
 */
export function PromptDiffButton({ instanceId }: PromptDiffButtonProps) {
  const prompt = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === instanceId)?.prompt
  );
  if (prompt == null) {
    return null;
  }
  return (
    <DialogTrigger>
      <TooltipTrigger delay={0}>
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.GitBranch />} />}
          aria-label="View changes against the saved prompt version"
          data-testid="prompt-diff-button"
        />
        <Tooltip>
          <TooltipArrow />
          View changes against the saved prompt version
        </Tooltip>
      </TooltipTrigger>
      <ModalOverlay>
        <Modal size="L">
          <PromptDiffDialog
            instanceId={instanceId}
            promptId={prompt.id}
            promptName={prompt.name}
            promptVersionId={prompt.version}
            promptVersionTag={prompt.tag}
          />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

type PromptDiffDialogProps = {
  instanceId: number;
  promptId: string;
  promptName: string;
  promptVersionId: string;
  promptVersionTag: string | null;
};

function PromptDiffDialog(props: PromptDiffDialogProps) {
  const [diffStyle, setDiffStyle] = useState<TextDiffStyle>("unified");
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Changes to ${props.promptName}`}</DialogTitle>
          <DialogTitleExtra>
            <DiffStyleToggle value={diffStyle} onChange={setDiffStyle} />
            <DialogCloseButton />
          </DialogTitleExtra>
        </DialogHeader>
        <Suspense fallback={<Loading />}>
          <PromptDiffDialogContent {...props} diffStyle={diffStyle} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

function PromptDiffDialogContent({
  instanceId,
  promptId,
  promptName,
  promptVersionId,
  promptVersionTag,
  diffStyle,
}: PromptDiffDialogProps & { diffStyle: TextDiffStyle }) {
  const store = usePlaygroundStore();
  const data = useLazyLoadQuery<PromptDiffButtonQuery>(
    graphql`
      query PromptDiffButtonQuery($versionId: ID!) {
        version: node(id: $versionId) {
          __typename
          ... on PromptVersion {
            templateFormat
            ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
          }
        }
      }
    `,
    { versionId: promptVersionId },
    { fetchPolicy: "store-and-network" }
  );

  const diff = useMemo(() => {
    const versionNode =
      data.version?.__typename === "PromptVersion" ? data.version : null;
    if (versionNode == null) {
      return null;
    }
    // Convert the saved version through the same instance -> prompt version
    // input pipeline used by the save flow so both sides of the diff are
    // serialized identically.
    const savedInstance: PlaygroundInstance = {
      ...promptVersionToInstance({
        promptId,
        promptName,
        promptVersionRef: versionNode,
        promptVersionTag,
      }),
      id: -1,
    };
    const savedInput = instanceToPromptVersion({
      instance: savedInstance,
      templateFormat: versionNode.templateFormat,
    });
    if (savedInput == null) {
      return null;
    }
    const { promptInput: currentInput } = getInstancePromptParamsFromStore(
      instanceId,
      store
    );
    return {
      oldTemplateText: chatPromptVersionInputToTemplateText(savedInput),
      newTemplateText: chatPromptVersionInputToTemplateText(currentInput),
      oldConfigText: chatPromptVersionInputToConfigText(savedInput),
      newConfigText: chatPromptVersionInputToConfigText(currentInput),
    };
  }, [data.version, instanceId, promptId, promptName, promptVersionTag, store]);

  if (diff == null) {
    return (
      <View padding="size-200">
        <Alert variant="danger">
          The saved prompt version could not be loaded for comparison.
        </Alert>
      </View>
    );
  }

  return (
    <View padding="size-200" overflow="auto" flex="1 1 auto">
      <Flex direction="column" gap="size-200">
        <Flex direction="column" gap="size-100">
          <Text weight="heavy">Prompt</Text>
          <TextDiff
            oldText={diff.oldTemplateText}
            newText={diff.newTemplateText}
            fileName="prompt.txt"
            diffStyle={diffStyle}
          />
        </Flex>
        <Flex direction="column" gap="size-100">
          <Text weight="heavy">Model Configuration</Text>
          <TextDiff
            oldText={diff.oldConfigText}
            newText={diff.newConfigText}
            fileName="model-configuration.json"
            diffStyle={diffStyle}
          />
        </Flex>
      </Flex>
    </View>
  );
}

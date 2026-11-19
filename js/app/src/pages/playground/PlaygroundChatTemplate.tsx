import { Flex } from "@phoenix/components";
import {
  AddMessageButton,
  ChatTemplateFooter,
  ChatTemplateMessages,
} from "@phoenix/components/playground/template";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import {
  AddResponseFormatButton,
  AddToolButton,
} from "./PlaygroundChatTemplateButtons";
import { PlaygroundResponseFormat } from "./PlaygroundResponseFormat";
import { PlaygroundTools } from "./PlaygroundTools";

/**
 * A playground task's chat template: its messages, plus the tools and
 * response format the task sends with them.
 */
export function PlaygroundChatTemplate({
  playgroundInstanceId,
  availablePaths,
  appendedMessagesPath,
}: {
  playgroundInstanceId: number;
  availablePaths: string[] | undefined;
  appendedMessagesPath?: string | null;
}) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((candidate) => candidate.id === playgroundInstanceId)
  );
  if (!instance) {
    throw new Error(`Playground instance ${playgroundInstanceId} not found`);
  }
  const hasTools = instance.tools.length > 0;
  const hasResponseFormat = instance.model.responseFormat != null;
  return (
    <>
      <ChatTemplateMessages
        playgroundInstanceId={playgroundInstanceId}
        availablePaths={availablePaths}
        appendedMessagesPath={appendedMessagesPath}
      />
      <ChatTemplateFooter>
        <AddResponseFormatButton instanceId={playgroundInstanceId} />
        <AddToolButton instanceId={playgroundInstanceId} />
        <AddMessageButton instanceId={playgroundInstanceId} />
      </ChatTemplateFooter>
      {hasTools || hasResponseFormat ? (
        <Flex direction="column" gap="size-100">
          {hasTools ? (
            <PlaygroundTools playgroundInstanceId={playgroundInstanceId} />
          ) : null}
          {hasResponseFormat ? (
            <PlaygroundResponseFormat
              playgroundInstanceId={playgroundInstanceId}
            />
          ) : null}
        </Flex>
      ) : null}
    </>
  );
}

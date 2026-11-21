import type { ReactNode } from "react";

import { Button, Flex, Icon, Icons, View } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { generateMessageId } from "@phoenix/store";

const FOOTER_MIN_HEIGHT = 32;

/**
 * The row of actions below a chat template's messages.
 */
export function ChatTemplateFooter({ children }: { children: ReactNode }) {
  return (
    <View paddingTop="size-100" paddingBottom="size-100">
      <Flex
        direction="row"
        justifyContent="end"
        gap="size-100"
        minHeight={FOOTER_MIN_HEIGHT}
      >
        {children}
      </Flex>
    </View>
  );
}

/**
 * Appends an empty user message to an instance's chat template.
 */
export function AddMessageButton({ instanceId }: { instanceId: number }) {
  const addMessage = usePlaygroundContext((state) => state.addMessage);
  return (
    <Button
      aria-label="add message"
      size="S"
      leadingVisual={<Icon svg={<Icons.Plus />} />}
      onPress={() => {
        addMessage({
          playgroundInstanceId: instanceId,
          messages: [
            {
              id: generateMessageId(),
              role: "user",
              content: "",
            },
          ],
        });
      }}
    >
      Message
    </Button>
  );
}

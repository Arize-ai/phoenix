import { ReactNode, useState } from "react";
import { css } from "@emotion/react";

import { Dialog, DialogContainer, EmptyGraphic } from "@arizeai/components";

import {
  Button,
  ExternalLink,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";

export function SpanAnnotationsEmpty() {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const onGettingStartedPress = () => {
    setDialog(
      <Dialog title="Span Annotations" isDismissable>
        <View padding="size-200">
          <p
            css={css`
              margin: 0 0 var(--ac-global-dimension-size-100) 0;
            `}
          >
            Annotations are pivotal for tracking and improving the performance
            of your application. Phoenix allows for both LLM and HUMAN
            annotations.
          </p>
          <ExternalLink href="https://docs.arize.com/phoenix/tracing/concepts-tracing/how-to-evaluate-traces">
            View annotation documentation
          </ExternalLink>
        </View>
      </Dialog>
    );
  };
  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-100" alignItems="center">
        <EmptyGraphic graphicKey="documents" />
        <Text>No annotations for this span</Text>
        <Button
          variant="default"
          size={"S"}
          onPress={onGettingStartedPress}
          leadingVisual={<Icon svg={<Icons.Edit2Outline />} />}
        >
          How to Annotate
        </Button>
      </Flex>
      <DialogContainer onDismiss={() => setDialog(null)} isDismissable>
        {dialog}
      </DialogContainer>
    </View>
  );
}

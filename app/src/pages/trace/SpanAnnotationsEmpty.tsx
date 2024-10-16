import React, { ReactNode, useState } from "react";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogContainer,
  EmptyGraphic,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@arizeai/components";

import { ExternalLink } from "@phoenix/components";

export function SpanAnnotationsEmpty() {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const onGettingStartedClick = () => {
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
    <View padding={"size-200"}>
      <Flex direction="column" gap="size-100" alignItems="center">
        <EmptyGraphic graphicKey="documents" />
        <Text>No annotations for this span</Text>
        <Button
          variant="default"
          size={"compact"}
          onClick={onGettingStartedClick}
          icon={<Icon svg={<Icons.Edit2Outline />} />}
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

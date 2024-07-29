import React, { ReactNode, useState } from "react";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  View,
} from "@arizeai/components";

import { ExternalLink } from "@phoenix/components";

export function ProjectTableEmpty() {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const onGettingStartedClick = () => {
    setDialog(
      <Dialog title="Getting Started with Traces" isDismissable>
        <View padding="size-200">
          <p
            css={css`
              margin: 0 0 var(--ac-global-dimension-size-100) 0;
            `}
          >
            To get started with traces, you will need to setup tracing in your
            application. Phoenix uses OpenTelemetry to collect traces and has
            various integrations with orchestration frameworks, SDKs, and
            languages. To get started, consult the documentation.
          </p>
          <ExternalLink href="https://docs.arize.com/phoenix/tracing/how-to-tracing">
            View tracing documentation
          </ExternalLink>
        </View>
      </Dialog>
    );
  };
  return (
    <tbody className="is-empty">
      <tr>
        <td
          colSpan={100}
          css={(theme) => css`
            text-align: center;
            padding: ${theme.spacing.margin24}px ${theme.spacing.margin24}px !important;
          `}
        >
          <Flex direction="column" gap="size-200" alignItems="center">
            No traces found for this project
            <Button
              variant="default"
              icon={<Icon svg={<Icons.PlayCircleOutline />} />}
              onClick={onGettingStartedClick}
            >
              Get Started
            </Button>
          </Flex>
        </td>
      </tr>
      <DialogContainer onDismiss={() => setDialog(null)}>
        {dialog}
      </DialogContainer>
    </tbody>
  );
}

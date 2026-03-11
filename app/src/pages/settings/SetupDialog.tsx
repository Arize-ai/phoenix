import { css } from "@emotion/react";

import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Text,
  View,
} from "@phoenix/components";

import type { SettingsSandboxPageQuery } from "./__generated__/SettingsSandboxPageQuery.graphql";

type AdapterInfo =
  SettingsSandboxPageQuery["response"]["sandboxBackends"][number];

const monoCSS = css`
  font-family: var(--global-font-family-mono, monospace);
  font-size: var(--global-font-size-xs);
`;

export function SetupDialog({ adapter }: { adapter: AdapterInfo }) {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup: {adapter.label}</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Flex direction="column" gap="size-100">
            {adapter.setupInstructions.map((step, i) => (
              <Flex key={i} direction="row" gap="size-100" alignItems="start">
                <Text size="S" color="text-500" flex="none">
                  {i + 1}.
                </Text>
                <Text
                  size="S"
                  css={step.startsWith("pip install") ? monoCSS : undefined}
                  color="text-700"
                >
                  {step}
                </Text>
              </Flex>
            ))}
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}

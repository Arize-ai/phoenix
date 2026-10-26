import type { ReactNode } from "react";
import { Heading } from "react-aria-components";

import { Flex, Text, View } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";

export type PromptDetailsAsideProps = {
  description?: string | null;
  metadata?: unknown;
  /**
   * The button that edits the description and metadata
   */
  editButton: ReactNode;
  /**
   * The button that edits the labels
   */
  labelConfigButton: ReactNode;
  labels: ReactNode;
  latestVersions: ReactNode;
};

/**
 * The sidebar of a prompt or decision detail page: description, labels,
 * metadata, and the latest versions.
 */
export function PromptDetailsAside({
  description,
  metadata,
  editButton,
  labelConfigButton,
  labels,
  latestVersions,
}: PromptDetailsAsideProps) {
  const hasDescription = Boolean(description);
  return (
    <View
      flex="none"
      width={400}
      height="100%"
      borderStartColor="default"
      borderStartWidth="thin"
    >
      <View padding="size-200" overflow="auto" height="100%">
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Heading level={3}>Description</Heading>
          {editButton}
        </Flex>
        {/* TODO: Add a markdown view here */}
        <Text color={hasDescription ? "text-900" : "text-700"}>
          {description || "No Description"}
        </Text>
        <section>
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Heading level={3}>Labels</Heading>
            {labelConfigButton}
          </Flex>
          {labels}
        </section>
        <section>
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Heading level={3}>Metadata</Heading>
            {editButton}
          </Flex>
          <JSONBlock
            value={metadata ? JSON.stringify(metadata, null, 2) : "{}"}
          />
        </section>
        <section>
          <Heading level={3}>Latest Versions</Heading>
          {latestVersions}
        </section>
      </View>
    </View>
  );
}

/**
 * The scrollable, centered main column of a prompt or decision detail page.
 */
export function PromptDetailsMainColumn({ children }: { children: ReactNode }) {
  return (
    <View
      height="100%"
      overflow="auto"
      width="100%"
      data-testid="scroll-container"
    >
      <View padding="size-200">
        <Flex
          direction="column"
          gap="size-200"
          marginStart="auto"
          marginEnd="auto"
          maxWidth={900}
        >
          {children}
        </Flex>
      </View>
    </View>
  );
}

import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  Flex,
  ListBox,
  Loading,
  Popover,
  Select,
  SelectItem,
  SelectValue,
  Text,
} from "@phoenix/components";
import { SelectChevronUpDownIcon } from "@phoenix/components/core/icon";

import type { PromptVersionCompareSelectQuery } from "./__generated__/PromptVersionCompareSelectQuery.graphql";

export type PromptVersionCompareSelectProps = {
  /**
   * The prompt whose versions can be compared
   */
  promptId: string;
  /**
   * The version currently being viewed. It is excluded from the list.
   */
  currentVersionId: string;
  /**
   * The version currently selected as the diff baseline
   */
  selectedVersionId: string;
  onChange: (versionId: string) => void;
};

/**
 * A select that picks the baseline prompt version to diff the current version
 * against.
 */
export function PromptVersionCompareSelect(
  props: PromptVersionCompareSelectProps
) {
  return (
    <Suspense fallback={<Loading size="S" />}>
      <PromptVersionCompareSelectContent {...props} />
    </Suspense>
  );
}

function PromptVersionCompareSelectContent({
  promptId,
  currentVersionId,
  selectedVersionId,
  onChange,
}: PromptVersionCompareSelectProps) {
  const data = useLazyLoadQuery<PromptVersionCompareSelectQuery>(
    graphql`
      query PromptVersionCompareSelectQuery($promptId: ID!) {
        prompt: node(id: $promptId) {
          ... on Prompt {
            promptVersions {
              edges {
                version: node {
                  id
                  sequenceNumber
                  description
                }
              }
            }
          }
        }
      }
    `,
    { promptId }
  );
  const versions = (data.prompt?.promptVersions?.edges ?? [])
    .map((edge) => edge.version)
    .filter((version) => version.id !== currentVersionId);
  return (
    <Select
      size="S"
      aria-label="Baseline version to compare against"
      selectedKey={selectedVersionId}
      onSelectionChange={(key) => {
        if (typeof key === "string") {
          onChange(key);
        }
      }}
      data-testid="prompt-version-compare-select"
    >
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox items={versions}>
          {(version) => (
            <SelectItem
              key={version.id}
              id={version.id}
              textValue={`v${version.sequenceNumber}`}
            >
              <Flex direction="row" gap="size-100" alignItems="center">
                <Text>{`v${version.sequenceNumber}`}</Text>
                {version.description ? (
                  <Text color="text-700" size="XS">
                    {version.description}
                  </Text>
                ) : null}
              </Flex>
            </SelectItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}

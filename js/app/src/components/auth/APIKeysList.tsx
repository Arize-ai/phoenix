import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text, View } from "@phoenix/components";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";

import { DeleteAPIKeyButton } from "./DeleteAPIKeyButton";

const apiKeysListCSS = css`
  list-style: none;
  margin: 0;
  padding: var(--global-dimension-size-200);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

const apiKeyCSS = css`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

const apiKeyIconCSS = css`
  flex: none;
  width: var(--global-dimension-size-450);
  height: var(--global-dimension-size-450);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--global-color-gray-100);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  color: var(--global-text-color-700);
`;

const apiKeyMetadataCSS = css`
  list-style: none;
  margin: var(--global-dimension-size-100) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-100);
`;

const metadataLabelCSS = css`
  display: block;
  color: var(--global-text-color-700);
  font-size: var(--global-font-size-xs);
`;

export type APIKeyListItem = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  expiresAt?: string | null;
};

export function APIKeysList({
  apiKeys,
  emptyDescription,
  isDeleting,
  onDelete,
}: {
  apiKeys: readonly APIKeyListItem[];
  emptyDescription: string;
  isDeleting?: boolean;
  onDelete: (apiKeyId: string) => void;
}) {
  const { fullTimeFormatter } = useTimeFormatters();

  if (apiKeys.length === 0) {
    return (
      <View padding="size-500">
        <EmptyState
          graphic={<EmptyStateGraphic variant="credential" />}
          title="No API keys"
          description={emptyDescription}
        />
      </View>
    );
  }

  return (
    <ul css={apiKeysListCSS}>
      {apiKeys.map((apiKey) => (
        <li key={apiKey.id} css={apiKeyCSS}>
          <div css={apiKeyIconCSS} aria-hidden="true">
            <Icon svg={<Icons.Key />} />
          </div>
          <div>
            <Flex direction="column" gap="size-50">
              <Text weight="heavy">{apiKey.name}</Text>
              {apiKey.description ? (
                <Text size="S" color="text-700">
                  {apiKey.description}
                </Text>
              ) : null}
            </Flex>
            <ul css={apiKeyMetadataCSS}>
              <li>
                <span css={metadataLabelCSS}>Created</span>
                <Text size="XS">
                  {fullTimeFormatter(new Date(apiKey.createdAt))}
                </Text>
              </li>
              <li>
                <span css={metadataLabelCSS}>Expires</span>
                <Text size="XS">
                  {apiKey.expiresAt
                    ? fullTimeFormatter(new Date(apiKey.expiresAt))
                    : "Never"}
                </Text>
              </li>
            </ul>
          </div>
          <DeleteAPIKeyButton
            apiKeyName={apiKey.name}
            isDisabled={isDeleting}
            handleDelete={() => onDelete(apiKey.id)}
            trigger="menu"
          />
        </li>
      ))}
    </ul>
  );
}

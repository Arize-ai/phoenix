import { formatRelative } from "date-fns/formatRelative";
import type { ReactNode } from "react";

import { Flex, Text, Token, View } from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { useCurrentTime } from "@phoenix/hooks";

export type VersionSummaryProps = {
  id: string;
  sequenceNumber: number;
  description?: string | null;
  createdAt: string;
  user?: {
    username: string;
    profilePictureUrl?: string | null;
  } | null;
  /**
   * The version's tags, already rendered
   */
  tags: ReactNode;
};

/**
 * A one-row summary of a prompt or decision version: its number, id,
 * description, tags, author, and age.
 */
export function VersionSummary({
  id,
  sequenceNumber,
  description,
  createdAt,
  user,
  tags,
}: VersionSummaryProps) {
  const { nowEpochMs } = useCurrentTime();
  return (
    <Flex direction="column" gap="size-50">
      <View width="100%">
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          width="100%"
        >
          <Flex direction="row" gap="size-100" alignItems="center">
            <Token color="var(--global-color-blue-900)">{sequenceNumber}</Token>
            <span>{id}</span>
          </Flex>
        </Flex>
      </View>
      <View
        data-testid="prompt-version-item-description"
        paddingStart="size-400"
      >
        <Flex direction="column" gap="size-100">
          <Truncate maxWidth={"100%"}>
            <Text color="text-700" size="XS">
              {description || "No Description"}
            </Text>
          </Truncate>
          <Flex
            justifyContent="space-between"
            alignItems="center"
            gap="size-100"
          >
            {tags}
            <Flex
              direction="row"
              gap="size-100"
              alignItems="center"
              flex="none"
            >
              {user && (
                <Flex direction="row" gap="size-50" alignItems="center">
                  <UserPicture
                    size={14}
                    name={user.username}
                    profilePictureUrl={user.profilePictureUrl}
                  />
                  <Text size="XS">{user.username}</Text>
                </Flex>
              )}
              <Text color="text-300" size="XS">
                {formatRelative(createdAt, nowEpochMs)}
              </Text>
            </Flex>
          </Flex>
        </Flex>
      </View>
    </Flex>
  );
}

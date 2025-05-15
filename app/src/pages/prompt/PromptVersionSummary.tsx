import { useFragment } from "react-relay";
import { formatRelative } from "date-fns/formatRelative";
import { graphql } from "relay-runtime";

import { Flex, Text, Token, View } from "@phoenix/components";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { Truncate } from "@phoenix/components/utility/Truncate";

import { PromptVersionSummaryFragment$key } from "./__generated__/PromptVersionSummaryFragment.graphql";
import { PromptVersionTagsList } from "./PromptVersionTagsList";

export function PromptVersionSummary(props: {
  promptVersion: PromptVersionSummaryFragment$key;
}) {
  const version = useFragment<PromptVersionSummaryFragment$key>(
    graphql`
      fragment PromptVersionSummaryFragment on PromptVersion {
        id
        description
        sequenceNumber
        createdAt
        user {
          id
          username
          profilePictureUrl
        }
        ...PromptVersionTagsList_data
      }
    `,
    props.promptVersion
  );

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
            <Token color="var(--ac-global-color-blue-900)">
              {version.sequenceNumber}
            </Token>
            <span>{`${version.id}`}</span>
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
              {version.description || "No Description"}
            </Text>
          </Truncate>
          <Flex
            justifyContent="space-between"
            alignItems="center"
            gap="size-100"
          >
            <PromptVersionTagsList promptVersion={version} />
            <Flex
              direction="row"
              gap="size-100"
              alignItems="center"
              flex="none"
            >
              {version.user && (
                <Flex direction="row" gap="size-50" alignItems="center">
                  <UserPicture
                    size={14}
                    name={version.user.username}
                    profilePictureUrl={version.user.profilePictureUrl}
                  />
                  <Text size="XS">{version.user.username}</Text>
                </Flex>
              )}
              <Text color="text-300" size="XS">
                {formatRelative(version.createdAt, Date.now())}
              </Text>
            </Flex>
          </Flex>
        </Flex>
      </View>
    </Flex>
  );
}

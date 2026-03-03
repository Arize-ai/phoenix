import { Flex, Heading, Text, View } from "@phoenix/components";

import type { StreamToggle_data$key } from "./__generated__/StreamToggle_data.graphql";
import { StreamToggle } from "./StreamToggle";

export function ProjectOnboardingWaitingForTraces({
  project,
}: {
  project: StreamToggle_data$key;
}) {
  return (
    <View padding="size-200" height="100%">
      <Flex direction="column" height="100%" width="100%">
        <Flex
          direction="row"
          justifyContent="end"
          alignItems="center"
          width="100%"
        >
          <StreamToggle project={project} />
        </Flex>
        <Flex
          direction="column"
          alignItems="center"
          justifyContent="center"
          gap="size-150"
          flex="1 1 auto"
        >
          <Heading level={2}>waiting for traces...</Heading>
          <Text color="text-700">TODO: new onboarding flow goes here</Text>
        </Flex>
      </Flex>
    </View>
  );
}

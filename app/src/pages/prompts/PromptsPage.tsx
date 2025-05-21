import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  Flex,
  Heading,
  Icon,
  Icons,
  LinkButton,
  View,
} from "@phoenix/components";
import { promptsLoader } from "@phoenix/pages/prompts/promptsLoader";

import { PromptsTable } from "./PromptsTable";

export function PromptsPage() {
  const loaderData = useLoaderData<typeof promptsLoader>();
  invariant(loaderData, "loaderData is required");
  return (
    <Flex direction="column" height="100%">
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="dark"
        flex="none"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Heading level={1}>Prompts</Heading>
          <LinkButton
            size="M"
            leadingVisual={<Icon svg={<Icons.MessageSquareOutline />} />}
            variant="primary"
            to="/playground"
          >
            Create Prompt
          </LinkButton>
        </Flex>
      </View>
      <PromptsTable query={loaderData} />
    </Flex>
  );
}

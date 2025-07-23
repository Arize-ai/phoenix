import { useState } from "react";
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

import { PromptsSearch } from "./PromptsSearch";
import { PromptsTable } from "./PromptsTable";

export function PromptsPage() {
  const [searchFilter, setSearchFilter] = useState("");
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
          gap="size-100"
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
      <View
        paddingStart="size-200"
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderBottomWidth="thin"
        borderBottomColor="grey-200"
        flex="none"
      >
        <PromptsSearch onChange={setSearchFilter} />
      </View>
      <PromptsTable query={loaderData} searchFilter={searchFilter} />
    </Flex>
  );
}

import { Flex, Text, View } from "@phoenix/components";
import { PythonBlock } from "@phoenix/components/code";
import { Empty } from "@phoenix/components/Empty";

import { PlaygroundQuery$data } from "./__generated__/PlaygroundQuery.graphql";

// The playground is disabled if no LLM provider client is installed on the server.
// This message is displayed until the user installs a provider for the server to use, and then restarts the server.
const NO_PROVIDER_MESSAGE = `
The playground is not available until an LLM provider client is installed on the server.
`;

const makeInstallString = (
  providers: NoInstalledProviderProps["availableProviders"]
) => `
# Installing one or more of the clients will enable the playground
${Array.from(
  providers.reduce((acc, curr) => {
    curr.dependencies.forEach((dep) => acc.add(dep));
    return acc;
  }, new Set<string>())
)
  .map((dep) => `pip install ${dep}`)
  .join("\n")}
`;

type NoInstalledProviderProps = {
  availableProviders: PlaygroundQuery$data["modelProviders"];
};

export const NoInstalledProvider = (props: NoInstalledProviderProps) => {
  return (
    <View height="100%" width="100%">
      <Flex
        direction="column"
        alignItems="center"
        justifyContent="center"
        gap="size-200"
      >
        <Empty message={NO_PROVIDER_MESSAGE} graphicKey="not found" size="L" />
        {/* display instructions for installing a provider and a link to the documentation */}
        <Text>The following clients are supported:</Text>
        <PythonBlock value={makeInstallString(props.availableProviders)} />
      </Flex>
    </View>
  );
};

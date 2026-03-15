import { css } from "@emotion/react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Card, Flex, ReadOnlyTextField, View } from "@phoenix/components";
import { CanManageRetentionPolicy, IsAdmin } from "@phoenix/components/auth";
import { BASE_URL, VERSION } from "@phoenix/config";
import type { settingsGeneralPageLoaderQuery } from "@phoenix/pages/settings/__generated__/settingsGeneralPageLoaderQuery.graphql";
import { APIKeysCard } from "@phoenix/pages/settings/APIKeysCard";
import { DBUsagePieChart } from "@phoenix/pages/settings/DBUsagePieChart";
import { GlobalRetentionPolicyCard } from "@phoenix/pages/settings/GlobalRetentionPolicyCard";
import type { settingsGeneralPageLoaderType } from "@phoenix/pages/settings/settingsGeneralPageLoader";
import { settingsGeneralPageLoaderGQL } from "@phoenix/pages/settings/settingsGeneralPageLoader";
import { UsersCard } from "@phoenix/pages/settings/UsersCard";

const formCSS = css`
  padding: var(--global-dimension-size-200);
`;

export function SettingsGeneralPage() {
  const loaderData = useLoaderData<settingsGeneralPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery<settingsGeneralPageLoaderQuery>(
    settingsGeneralPageLoaderGQL,
    loaderData
  );
  return (
    <Flex direction="column" gap="size-200" width="100%">
      <Flex direction="row" gap="size-200" alignItems="baseline">
        <View flex="2">
          <Card title="Platform Settings">
            <form css={formCSS}>
              <ReadOnlyTextField
                value={BASE_URL}
                label="Hostname"
                description="Connect to Phoenix over HTTP"
                copyable
              />
              <ReadOnlyTextField
                value={VERSION}
                label="Platform Version"
                description="The version of the Phoenix server"
                copyable
              />
              <ReadOnlyTextField
                value={`pip install "arize-phoenix==${VERSION}"`}
                label="Installation Instructions"
                description="The command to install the Phoenix Python package"
                copyable
              />
            </form>
          </Card>
        </View>
        <View flex="1" minWidth={280}>
          <Card title="Database Usage">
            <View padding="size-200">
              <DBUsagePieChart query={data} />
            </View>
          </Card>
        </View>
      </Flex>
      <IsAdmin>
        <APIKeysCard />
        <UsersCard />
      </IsAdmin>
      <CanManageRetentionPolicy>
        <GlobalRetentionPolicyCard />
      </CanManageRetentionPolicy>
    </Flex>
  );
}

import { css } from "@emotion/react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  Card,
  CopyField,
  CopyInput,
  Label,
  Text,
  View,
} from "@phoenix/components";
import { CanManageRetentionPolicy } from "@phoenix/components/auth";
import { PlatformVersionStatus } from "@phoenix/components/nav";
import { BASE_URL, VERSION } from "@phoenix/config";
import type { settingsGeneralPageLoaderQuery } from "@phoenix/pages/settings/__generated__/settingsGeneralPageLoaderQuery.graphql";
import { DBUsagePieChart } from "@phoenix/pages/settings/DBUsagePieChart";
import { GlobalRetentionPolicyCard } from "@phoenix/pages/settings/GlobalRetentionPolicyCard";
import type { settingsGeneralPageLoaderType } from "@phoenix/pages/settings/settingsGeneralPageLoader";
import { settingsGeneralPageLoaderGQL } from "@phoenix/pages/settings/settingsGeneralPageLoader";

const gridCSS = css`
  display: grid;
  // minmax(0, 1fr) lets the columns shrink below their content's min-content
  // width so a wide card can't blow the layout out past the viewport.
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--global-dimension-size-200);
  width: 100%;

  // Stack the side-by-side cards on narrow screens so they don't squeeze
  // their contents.
  @media (max-width: 700px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const fullWidthCSS = css`
  grid-column: 1 / -1;
`;

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
    <div css={gridCSS}>
      <Card title="Platform">
        <form css={formCSS}>
          <CopyField value={BASE_URL}>
            <Label>Hostname</Label>
            <CopyInput />
            <Text slot="description">Connect to Phoenix over HTTP</Text>
          </CopyField>
          <CopyField value={VERSION}>
            <Label>Platform Version</Label>
            <CopyInput />
            <Text slot="description">The version of the Phoenix server</Text>
          </CopyField>
          <PlatformVersionStatus />
        </form>
      </Card>
      <Card title="Database Usage">
        <View padding="size-200">
          <DBUsagePieChart query={data} />
        </View>
      </Card>
      <CanManageRetentionPolicy>
        <div css={fullWidthCSS}>
          <GlobalRetentionPolicyCard />
        </div>
      </CanManageRetentionPolicy>
    </div>
  );
}

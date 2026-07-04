import { css } from "@emotion/react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  Card,
  CopyField,
  CopyInput,
  ExternalLink,
  Label,
  Text,
  View,
} from "@phoenix/components";
import { CanManageRetentionPolicy, IsAdmin } from "@phoenix/components/auth";
import { BASE_URL, VERSION } from "@phoenix/config";
import { useLatestPhoenixVersion } from "@phoenix/hooks";
import {
  getPhoenixReleaseNotesUrl,
  isVersionNewer,
} from "@phoenix/utils/versionUtils";
import type { settingsGeneralPageLoaderQuery } from "@phoenix/pages/settings/__generated__/settingsGeneralPageLoaderQuery.graphql";
import { APIKeysCard } from "@phoenix/pages/settings/APIKeysCard";
import { DBUsagePieChart } from "@phoenix/pages/settings/DBUsagePieChart";
import { GlobalRetentionPolicyCard } from "@phoenix/pages/settings/GlobalRetentionPolicyCard";
import type { settingsGeneralPageLoaderType } from "@phoenix/pages/settings/settingsGeneralPageLoader";
import { settingsGeneralPageLoaderGQL } from "@phoenix/pages/settings/settingsGeneralPageLoader";
import { UsersCard } from "@phoenix/pages/settings/UsersCard";

const gridCSS = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--global-dimension-size-200);
  width: 100%;
`;

const fullWidthCSS = css`
  grid-column: 1 / -1;
`;

const formCSS = css`
  padding: var(--global-dimension-size-200);
`;

const versionStatusCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-static-size-100);
  margin-top: var(--global-dimension-static-size-100);
  font-size: var(--global-font-size-xs);
  line-height: var(--global-line-height-xs);
`;

/**
 * Shows how the running server version compares to the latest release on
 * PyPI. Renders nothing while the latest version is unknown or when the
 * server is up to date.
 */
function PlatformVersionStatus() {
  const latestVersion = useLatestPhoenixVersion();
  const isLagging =
    latestVersion != null &&
    isVersionNewer({ current: VERSION, latest: latestVersion });
  if (!isLagging) {
    return null;
  }
  return (
    <div css={versionStatusCSS} data-testid="platform-version-status">
      <Text size="XS" color="warning">
        A newer version of Phoenix is available (v{latestVersion}).
      </Text>
      <ExternalLink href={getPhoenixReleaseNotesUrl(latestVersion)}>
        View release notes
      </ExternalLink>
    </div>
  );
}

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
      <IsAdmin>
        <div css={fullWidthCSS}>
          <APIKeysCard />
        </div>
        <div css={fullWidthCSS}>
          <UsersCard />
        </div>
      </IsAdmin>
      <CanManageRetentionPolicy>
        <div css={fullWidthCSS}>
          <GlobalRetentionPolicyCard />
        </div>
      </CanManageRetentionPolicy>
    </div>
  );
}

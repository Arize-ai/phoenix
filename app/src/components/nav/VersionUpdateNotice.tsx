import { css } from "@emotion/react";

import {
  ExternalLink,
  Flex,
  Icon,
  IconButton,
  Icons,
  Text,
} from "@phoenix/components";
import { useLatestPhoenixVersion, usePersistedState } from "@phoenix/hooks";
import { isVersionNewer } from "@phoenix/utils/versionUtils";

export const LOCAL_STORAGE_DISMISSED_UPDATE_VERSION_KEY =
  "arize-phoenix-dismissed-update-version";

const versionUpdateNoticeCSS = css`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-static-size-50);
  padding: var(--global-dimension-static-size-150);
  margin-bottom: var(--global-dimension-static-size-100);
  background-color: var(--global-color-gray-200);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);

  .version-update-notice__dismiss {
    position: absolute;
    top: var(--global-dimension-static-size-50);
    right: var(--global-dimension-static-size-50);
  }

  .version-update-notice__link {
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
  }
`;

/**
 * A dismissable notice shown in the side nav when a newer version of Phoenix
 * has been published to PyPI. Dismissal is persisted to localStorage per
 * version, so the notice reappears only when an even newer version ships.
 * Renders as an `<li>` so it can sit directly inside the nav link list, or
 * nothing at all when there is no update to show.
 */
export function VersionUpdateNotice({ isExpanded }: { isExpanded: boolean }) {
  const latestVersion = useLatestPhoenixVersion();
  const [dismissedVersion, setDismissedVersion] = usePersistedState<
    string | null
  >(LOCAL_STORAGE_DISMISSED_UPDATE_VERSION_KEY, null);
  const currentVersion = window.Config.platformVersion;

  const hasNewerVersion =
    latestVersion != null &&
    isVersionNewer({ current: currentVersion, latest: latestVersion });
  const isDismissed = dismissedVersion === latestVersion;
  if (!isExpanded || !hasNewerVersion || isDismissed) {
    return null;
  }

  return (
    <li
      css={versionUpdateNoticeCSS}
      className="version-update-notice"
      aria-label="Phoenix update available"
      data-testid="version-update-notice"
    >
      <Flex direction="row" gap="size-75" alignItems="center">
        <Icon svg={<Icons.Rocket />} />
        <Text size="S" weight="heavy">
          Update available
        </Text>
      </Flex>
      <Text size="XS" color="text-700">
        Phoenix v{latestVersion} is now available.
      </Text>
      <span className="version-update-notice__link">
        <ExternalLink
          href={`https://github.com/Arize-ai/phoenix/releases/tag/arize-phoenix-v${latestVersion}`}
        >
          Release notes
        </ExternalLink>
      </span>
      <IconButton
        size="S"
        className="version-update-notice__dismiss"
        aria-label="Dismiss update notification"
        onPress={() => setDismissedVersion(latestVersion)}
      >
        <Icon svg={<Icons.Close />} />
      </IconButton>
    </li>
  );
}

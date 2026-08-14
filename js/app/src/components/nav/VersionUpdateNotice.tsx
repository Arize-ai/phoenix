import { css, keyframes } from "@emotion/react";

import {
  ExternalLink,
  Icon,
  IconButton,
  Icons,
  Text,
} from "@phoenix/components";
import { VERSION } from "@phoenix/config";
import { useViewerCanSeeVersionUpdates } from "@phoenix/contexts";
import { useLatestPhoenixVersion, usePersistedState } from "@phoenix/hooks";
import {
  getPhoenixReleaseNotesUrl,
  isVersionNewer,
  isVersionNewerBy,
} from "@phoenix/utils/versionUtils";

const LOCAL_STORAGE_DISMISSED_UPDATE_VERSION_KEY =
  "arize-phoenix-dismissed-update-version";

/**
 * How many minor versions behind the latest release the running server must
 * be before the notice appears. A new major version always shows the notice.
 * Minor releases ship too often for every one to be worth a nav banner.
 */
const MINOR_VERSIONS_BEHIND_THRESHOLD = 2;

/**
 * Whether this Phoenix instance is a managed/hosted deployment (e.g. Phoenix
 * Cloud). Managed deployments inject `window.Config.managementUrl` and upgrade
 * on their own cadence, which users cannot control — so surfacing an upgrade
 * notice there is misleading and actionable only by the operator, not the
 * viewer. We reuse the `managementUrl` heuristic (the same deployment-mode
 * signal used elsewhere, e.g. the sandbox trust warning) until a dedicated
 * server flag exists.
 */
function isManagedDeployment(): boolean {
  return Boolean(window.Config.managementUrl);
}

const versionUpdateNoticeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(var(--global-dimension-size-100)) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const versionUpdateNoticeCSS = css`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--global-dimension-size-100);
  box-sizing: border-box;
  min-width: 0;
  padding: var(--global-dimension-size-200);
  margin-bottom: var(--global-dimension-size-100);
  background-color: var(--global-color-gray-200);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  /* gentle, one-time entrance: a short delay so the card doesn't pop in with
     the nav, then a slow rise-and-fade with a decelerating ease. No looping
     animation — this card can sit in the nav indefinitely until dismissed,
     and a perpetual motion effect there would be distracting rather than
     inviting. */
  animation: ${versionUpdateNoticeIn} 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.15s
    both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  /* inverted monochrome tile — light-on-dark in dark mode, dark-on-light in
     light mode — to match the PXI glyph treatment */
  .version-update-notice__icon {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--global-dimension-size-400);
    height: var(--global-dimension-size-400);
    font-size: var(--global-font-size-l);
    color: var(--global-color-gray-100);
    background: linear-gradient(
      165deg,
      var(--global-color-gray-900),
      var(--global-color-gray-700)
    );
    border-radius: var(--global-rounding-medium);
  }

  .version-update-notice__content {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-25);
    min-width: 0;
  }

  .version-update-notice__description {
    overflow-wrap: anywhere;
  }

  .version-update-notice__link {
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
  }

  .version-update-notice__dismiss {
    position: absolute;
    top: var(--global-dimension-size-100);
    right: var(--global-dimension-size-100);
  }
`;

export type VersionUpdateNoticeItemProps = {
  /**
   * The newer Phoenix version that is available
   */
  latestVersion: string;
  /**
   * Called when the user dismisses the notice
   */
  onDismiss: () => void;
};

/**
 * Presentational version update card. Renders as an `<li>` so it can sit
 * directly inside the side nav link list.
 */
export function VersionUpdateNoticeItem({
  latestVersion,
  onDismiss,
}: VersionUpdateNoticeItemProps) {
  return (
    <li
      css={versionUpdateNoticeCSS}
      className="version-update-notice"
      aria-label="Phoenix update available"
      data-testid="version-update-notice"
    >
      <div className="version-update-notice__icon">
        <Icon svg={<Icons.Gift />} />
      </div>
      <div className="version-update-notice__content">
        <Text size="S" weight="heavy">
          Update available
        </Text>
        <Text
          size="XS"
          color="text-700"
          className="version-update-notice__description"
        >
          Phoenix v{latestVersion} is now available with new features and
          improvements.
        </Text>
      </div>
      <span className="version-update-notice__link">
        <ExternalLink href={getPhoenixReleaseNotesUrl(latestVersion)}>
          View release notes
        </ExternalLink>
      </span>
      <IconButton
        size="S"
        className="version-update-notice__dismiss"
        aria-label="Dismiss update notification"
        onPress={onDismiss}
      >
        <Icon svg={<Icons.Close />} />
      </IconButton>
    </li>
  );
}

/**
 * A dismissable notice shown in the side nav when the running Phoenix server
 * has fallen meaningfully behind the latest release on PyPI — at least
 * {@link MINOR_VERSIONS_BEHIND_THRESHOLD} minor versions, or any new major
 * version. Only admins see the notice, since they are the ones who can act on
 * it by upgrading the server. Dismissal is persisted to localStorage: the
 * notice stays hidden until the latest release pulls the same threshold ahead
 * of the dismissed version. Renders as an `<li>` so it can sit directly
 * inside the nav link list, or nothing at all when there is no update to
 * show. Never shown on managed deployments (see {@link isManagedDeployment}),
 * which upgrade on a cadence the viewer cannot control.
 */
export function VersionUpdateNotice({ isExpanded }: { isExpanded: boolean }) {
  const canSeeVersionUpdates = useViewerCanSeeVersionUpdates();
  const latestVersion = useLatestPhoenixVersion();
  const [dismissedVersion, setDismissedVersion] = usePersistedState<
    string | null
  >(LOCAL_STORAGE_DISMISSED_UPDATE_VERSION_KEY, null);

  const hasSignificantUpdate =
    latestVersion != null &&
    isVersionNewerBy({
      current: VERSION,
      latest: latestVersion,
      minorVersions: MINOR_VERSIONS_BEHIND_THRESHOLD,
    });
  const isDismissed =
    latestVersion != null &&
    dismissedVersion != null &&
    !isVersionNewerBy({
      current: dismissedVersion,
      latest: latestVersion,
      minorVersions: MINOR_VERSIONS_BEHIND_THRESHOLD,
    });
  if (
    isManagedDeployment() ||
    !canSeeVersionUpdates ||
    !isExpanded ||
    !hasSignificantUpdate ||
    isDismissed
  ) {
    return null;
  }

  return (
    <VersionUpdateNoticeItem
      latestVersion={latestVersion}
      onDismiss={() => setDismissedVersion(latestVersion)}
    />
  );
}

/**
 * Shows how the running server version compares to the latest release on
 * PyPI. Unlike {@link VersionUpdateNotice}, this is a pull surface the admin
 * visits deliberately (Settings > General), so it reports any newer version
 * — including a single minor or patch bump — rather than applying the nav
 * notice's two-minor-version threshold, which exists specifically to avoid
 * pushing a banner for every minor release. Only admins see this status, for
 * the same reason the nav notice is admin-only: they are the ones who can
 * act on it by upgrading the server. Renders nothing while the latest
 * version is unknown, when the server is up to date, or on managed
 * deployments (see {@link isManagedDeployment}), which upgrade on a cadence
 * the viewer cannot control.
 */
export function PlatformVersionStatus() {
  const canSeeVersionUpdates = useViewerCanSeeVersionUpdates();
  const latestVersion = useLatestPhoenixVersion();
  const isLagging =
    latestVersion != null &&
    isVersionNewer({ current: VERSION, latest: latestVersion });
  if (isManagedDeployment() || !canSeeVersionUpdates || !isLagging) {
    return null;
  }
  return (
    <Text color="warning" size="XS" data-testid="platform-version-status">
      A newer version of Phoenix is available (v{latestVersion}).{" "}
      <ExternalLink href={getPhoenixReleaseNotesUrl(latestVersion)}>
        View release notes
      </ExternalLink>
    </Text>
  );
}

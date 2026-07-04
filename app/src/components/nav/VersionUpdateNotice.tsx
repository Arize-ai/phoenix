import { css, keyframes } from "@emotion/react";

import {
  ExternalLink,
  Icon,
  IconButton,
  Icons,
  Text,
} from "@phoenix/components";
import { useViewerCanSeeVersionUpdates } from "@phoenix/contexts";
import { useLatestPhoenixVersion, usePersistedState } from "@phoenix/hooks";
import {
  getPhoenixReleaseNotesUrl,
  isVersionNewerBy,
} from "@phoenix/utils/versionUtils";

export const LOCAL_STORAGE_DISMISSED_UPDATE_VERSION_KEY =
  "arize-phoenix-dismissed-update-version";

/**
 * How many minor versions behind the latest release the running server must
 * be before the notice appears. A new major version always shows the notice.
 * Minor releases ship too often for every one to be worth a nav banner.
 */
const MINOR_VERSIONS_BEHIND_THRESHOLD = 2;

const versionUpdateNoticeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(var(--global-dimension-static-size-100)) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const versionUpdateNoticeSheenDrift = keyframes`
  from {
    opacity: 0.45;
    transform: translate3d(-6%, -6%, 0) rotate(-8deg);
  }
  to {
    opacity: 1;
    transform: translate3d(6%, 6%, 0) rotate(8deg);
  }
`;

const versionUpdateNoticeCSS = css`
  /* the sheen brightens with white in dark mode, where a strong wash reads as
     a glow; the same strength in light mode reads as a smudge of shadow, so
     the darkening wash is kept much fainter there */
  --version-update-notice-sheen-alpha-1: 0.3;
  --version-update-notice-sheen-alpha-2: 0.2;

  .theme--light & {
    --version-update-notice-sheen-alpha-1: 0.09;
    --version-update-notice-sheen-alpha-2: 0.06;
  }

  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--global-dimension-static-size-100);
  box-sizing: border-box;
  min-width: 0;
  padding: var(--global-dimension-static-size-200);
  margin-bottom: var(--global-dimension-static-size-100);
  overflow: hidden;
  background-color: var(--global-color-gray-200);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  /* gentle entrance: a short delay so the card doesn't pop in with the nav,
     then a slow rise-and-fade with a decelerating ease */
  animation: ${versionUpdateNoticeIn} 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.15s
    both;

  /* soft diffuse washes of the text gray over the card surface — an
     indistinct sheen rather than a distinct shape. The layer is oversized and
     slowly drifts (transform-only, so it stays on the compositor) to gently
     catch the eye. */
  &::before {
    content: "";
    position: absolute;
    inset: -50%;
    z-index: -1;
    background: radial-gradient(
        65% 50% at 75% 25%,
        rgba(
          var(--global-color-gray-900-rgb),
          var(--version-update-notice-sheen-alpha-1)
        ),
        transparent 60%
      ),
      radial-gradient(
        55% 45% at 25% 75%,
        rgba(
          var(--global-color-gray-900-rgb),
          var(--version-update-notice-sheen-alpha-2)
        ),
        transparent 55%
      );
    animation: ${versionUpdateNoticeSheenDrift} 4s ease-in-out infinite
      alternate;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;

    &::before {
      animation: none;
    }
  }

  /* inverted monochrome tile — light-on-dark in dark mode, dark-on-light in
     light mode — to match the PXI glyph treatment */
  .version-update-notice__icon {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--global-dimension-static-size-400);
    height: var(--global-dimension-static-size-400);
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
    gap: var(--global-dimension-static-size-25);
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
    top: var(--global-dimension-static-size-100);
    right: var(--global-dimension-static-size-100);
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
 * show.
 */
export function VersionUpdateNotice({ isExpanded }: { isExpanded: boolean }) {
  const canSeeVersionUpdates = useViewerCanSeeVersionUpdates();
  const latestVersion = useLatestPhoenixVersion();
  const [dismissedVersion, setDismissedVersion] = usePersistedState<
    string | null
  >(LOCAL_STORAGE_DISMISSED_UPDATE_VERSION_KEY, null);
  const currentVersion = window.Config.platformVersion;

  const hasSignificantUpdate =
    latestVersion != null &&
    isVersionNewerBy({
      current: currentVersion,
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

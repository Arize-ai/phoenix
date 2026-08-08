import { css, keyframes } from "@emotion/react";

import { Alert, Button, Heading, Text } from "@phoenix/components";
import { OAuth2ClientIcon } from "@phoenix/components/auth";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { Logo } from "@phoenix/components/nav/Logo";

export interface OAuth2ConsentCardProps {
  /**
   * Human-readable name of the application requesting access
   */
  clientName: string;
  /**
   * The OAuth2 client identifier. Shown (truncated) for third-party clients.
   */
  clientId?: string | null;
  /**
   * The email or username of the signed-in user
   */
  signedInAs: string;
  /**
   * Whether the client is a first-party (Phoenix-verified) application
   */
  isFirstParty?: boolean;
  /**
   * The redirect URI the browser will be sent to after a decision
   */
  redirectUri: string | null;
  /**
   * An error message from a failed authorization attempt
   */
  errorMessage?: string | null;
  /**
   * Whether the authorization request is missing required parameters
   */
  isMissingRequiredParams?: boolean;
  /**
   * Whether an authorization decision is being submitted
   */
  isSubmitting?: boolean;
  onApprove: () => void;
  onCancel: () => void;
}

const handoffCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--global-dimension-size-300);
`;

const handoffNodeCSS = css`
  flex: none;
  width: var(--global-dimension-size-700);
  height: var(--global-dimension-size-700);
  border-radius: var(--global-rounding-large);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--global-color-gray-100);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
`;

// The client hands off to the workspace, so the dashes march left to right.
const handoffDashKeyframes = keyframes`
  from {
    background-position-x: 0;
  }
  to {
    background-position-x: var(--global-dimension-size-100);
  }
`;

const handoffWireCSS = css`
  position: relative;
  width: var(--global-dimension-size-900);
  height: var(--global-border-size-thin);
  background-image: repeating-linear-gradient(
    to right,
    var(--global-border-color-default) 0,
    var(--global-border-color-default) var(--global-dimension-size-50),
    transparent var(--global-dimension-size-50),
    transparent var(--global-dimension-size-100)
  );
  animation: ${handoffDashKeyframes} 1.5s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const handoffBadgeCSS = css`
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  width: var(--global-dimension-size-300);
  height: var(--global-dimension-size-300);
  border-radius: var(--global-rounding-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--global-background-color-default);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  color: var(--global-text-color-700);
  font-size: var(--global-font-size-xs);
`;

const titleCSS = css`
  margin: 0;
  text-align: center;
  font-size: var(--global-font-size-l);
  line-height: 1.35;
  font-weight: 500;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
`;

const subtitleCSS = css`
  margin-top: var(--global-dimension-size-50);
  text-align: center;
  overflow-wrap: anywhere;
`;

const signedInAsCSS = css`
  color: var(--global-text-color-900);
`;

// Alerts default to 16px body copy which overwhelms the compact card —
// tighten them to small text within the consent flow
const compactAlertCSS = css`
  .alert__icon-title-wrap {
    h5,
    span,
    p {
      font-size: var(--global-font-size-s);
      line-height: 1.55;
    }
  }
`;

const alertsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  margin-top: var(--global-dimension-size-200);
  ${compactAlertCSS}
`;

// The list's top border is the card's only divider.
const permListCSS = css`
  list-style: none;
  margin: var(--global-dimension-size-300) 0 0;
  padding: var(--global-dimension-size-100) 0 0;
  border-top: var(--global-border-size-thin) solid
    var(--global-border-color-default);
`;

const permItemCSS = css`
  display: flex;
  gap: var(--global-dimension-size-150);
  align-items: flex-start;
  padding: var(--global-dimension-size-150) 0;
`;

// Descriptive, not affirmative — a checkmark here would read as access already granted.
const permIconCSS = css`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--global-text-color-700);
  font-size: var(--global-font-size-m);
  margin-top: var(--global-dimension-size-25);
`;

const noteCSS = css`
  margin-top: var(--global-dimension-size-200);
  display: flex;
  gap: var(--global-dimension-size-100);
  align-items: flex-start;
  color: var(--global-text-color-700);

  & > .icon-wrap {
    flex: none;
    font-size: var(--global-font-size-m);
    margin-top: var(--global-dimension-size-25);
  }
`;

const actionsCSS = css`
  margin-top: var(--global-dimension-size-300);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);

  & > button {
    width: 100%;
    justify-content: center;
  }
`;

const metaCSS = css`
  margin-top: var(--global-dimension-size-250);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  align-items: center;
  text-align: center;
`;

const monoCSS = css`
  font-family: var(--global-font-family-mono);
  color: var(--global-text-color-700);
  overflow-wrap: anywhere;
`;

function isLoopbackRedirect(redirectUri: string) {
  try {
    const url = new URL(redirectUri);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" ||
        url.hostname === "localhost" ||
        url.hostname === "::1" ||
        url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

function isPrivateUseRedirect(redirectUri: string) {
  try {
    const url = new URL(redirectUri);
    return url.protocol !== "http:" && url.protocol !== "https:";
  } catch {
    return false;
  }
}

function formatLoopbackRedirectDestination(redirectUri: string) {
  try {
    const url = new URL(redirectUri);
    return url.port ? `${url.hostname}:${url.port}` : url.hostname;
  } catch {
    return redirectUri;
  }
}

function formatHostedRedirectDestination(redirectUri: string) {
  try {
    return new URL(redirectUri).host;
  } catch {
    return redirectUri;
  }
}

function getClientIdSuffix(clientId: string) {
  return clientId.length > 8 ? clientId.slice(-8) : clientId;
}

/**
 * The consent ("handoff") card shown when an OAuth2 client asks for access.
 * Purely presentational — all data and decision handling comes in via props.
 */
export function OAuth2ConsentCard({
  clientName,
  clientId,
  signedInAs,
  isFirstParty = false,
  redirectUri,
  errorMessage,
  isMissingRequiredParams = false,
  isSubmitting = false,
  onApprove,
  onCancel,
}: OAuth2ConsentCardProps) {
  const isLoopback = redirectUri != null && isLoopbackRedirect(redirectUri);
  const isPrivateUse = redirectUri != null && isPrivateUseRedirect(redirectUri);
  const redirectDestination =
    redirectUri == null
      ? null
      : isLoopback
        ? formatLoopbackRedirectDestination(redirectUri)
        : formatHostedRedirectDestination(redirectUri);
  const isActionDisabled = isSubmitting || isMissingRequiredParams;
  return (
    <div>
      <div css={handoffCSS} aria-hidden="true">
        <OAuth2ClientIcon
          clientName={clientName}
          isFirstParty={isFirstParty}
          size="L"
        />
        <div css={handoffWireCSS}>
          <div css={handoffBadgeCSS}>
            <Icon svg={<Icons.Link2 />} />
          </div>
        </div>
        <div css={handoffNodeCSS}>
          <Logo size={32} />
        </div>
      </div>
      <Heading level={1} css={titleCSS}>
        Connect {clientName}
      </Heading>
      <Text elementType="p" size="S" color="text-700" css={subtitleCSS}>
        to your Phoenix workspace ·{" "}
        <span css={signedInAsCSS}>{signedInAs}</span>
      </Text>
      {!isFirstParty || errorMessage || isMissingRequiredParams ? (
        <div css={alertsCSS}>
          {!isFirstParty ? (
            <Alert variant="warning" title="Unverified application">
              This application is not verified by Phoenix. Only approve if you
              recognize it and started this authorization flow.
            </Alert>
          ) : null}
          {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}
          {isMissingRequiredParams ? (
            <Alert variant="danger">
              This authorization request is missing required parameters.
            </Alert>
          ) : null}
        </div>
      ) : null}
      <ul css={permListCSS}>
        <li css={permItemCSS}>
          <div css={permIconCSS} aria-hidden="true">
            <Icon svg={<Icons.Eye />} />
          </div>
          <div>
            <Text elementType="p" size="S" weight="heavy">
              View your data
            </Text>
            <Text elementType="p" size="XS" color="text-700">
              Projects, traces, datasets, prompts, and experiments
            </Text>
          </div>
        </li>
        <li css={permItemCSS}>
          <div css={permIconCSS} aria-hidden="true">
            <Icon svg={<Icons.Edit2 />} />
          </div>
          <div>
            <Text elementType="p" size="S" weight="heavy">
              Make changes on your behalf
            </Text>
            <Text elementType="p" size="XS" color="text-700">
              Create, modify, and delete with your permissions
            </Text>
          </div>
        </li>
      </ul>
      {isLoopback ? (
        <div css={noteCSS}>
          <Icon svg={<Icons.Shield />} aria-hidden="true" />
          <Text size="XS" color="text-700">
            Only approve if you started this request from an application on this
            device.
          </Text>
        </div>
      ) : null}
      <div css={actionsCSS}>
        <Button
          variant="primary"
          onPress={onApprove}
          isDisabled={isActionDisabled}
        >
          {isSubmitting ? "Authorizing…" : "Approve access"}
        </Button>
        <Button onPress={onCancel} isDisabled={isActionDisabled}>
          Cancel
        </Button>
      </div>
      <div css={metaCSS}>
        {redirectUri != null ? (
          <Text size="XS" color="text-500">
            Redirects to{" "}
            {isPrivateUse ? (
              <>
                an application on this device (
                <code css={monoCSS}>{redirectUri}</code>)
              </>
            ) : (
              <>
                <span css={monoCSS}>{redirectDestination}</span>
                {isLoopback ? " · this machine" : null}
              </>
            )}
          </Text>
        ) : null}
        <Text size="XS" color="text-500">
          Revoke anytime in Settings
        </Text>
        {!isFirstParty && clientId ? (
          <Text size="XS" color="text-500">
            Client ID: <code css={monoCSS}>{getClientIdSuffix(clientId)}</code>
          </Text>
        ) : null}
      </div>
    </div>
  );
}

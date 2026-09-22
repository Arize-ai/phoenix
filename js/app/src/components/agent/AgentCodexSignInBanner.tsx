import { css } from "@emotion/react";
import { Link as RouterLink } from "react-router";

import { Alert, Text } from "@phoenix/components";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

const bannerCSS = css`
  padding: 0 var(--global-dimension-size-100) var(--global-dimension-size-100);
`;

/**
 * A Codex session can outlive the browser that signed in (or be opened from
 * another one); sends without a token are rejected, so point at the sign-in
 * before the user types.
 */
export function AgentCodexSignInBanner({
  modelMenuValue,
}: {
  modelMenuValue: ModelMenuValue;
}) {
  const isSignedIn = useAgentContext((state) => state.codexAuth != null);
  if (
    modelMenuValue.customProvider ||
    modelMenuValue.provider !== "OPENAI_CODEX" ||
    isSignedIn
  ) {
    return null;
  }
  return (
    <div css={bannerCSS}>
      <Alert variant="warning" banner>
        <Text size="S">
          This chat uses a ChatGPT subscription, but this browser is not signed
          in to ChatGPT.{" "}
          <RouterLink to="/settings/agents">Sign in under Settings</RouterLink>{" "}
          or pick another model.
        </Text>
      </Alert>
    </div>
  );
}

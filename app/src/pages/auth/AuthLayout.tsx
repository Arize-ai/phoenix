import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";

import { View } from "@phoenix/components";

/**
 * The bordered card that frames auth page content (login, consent, etc.)
 */
export function AuthCard({ children }: PropsWithChildren) {
  return (
    <View
      borderColor="default"
      borderWidth="thin"
      width="size-5000"
      maxWidth="100%"
      padding="size-400"
      backgroundColor="gray-75"
      borderRadius="medium"
    >
      {children}
    </View>
  );
}

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <main
      css={css`
        width: 100%;
        height: 100dvh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        position: relative;
        isolation: isolate;

        /* A faint dot grid that fades out from behind the card */
        &::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background-image: radial-gradient(
            var(--global-border-color-default) var(--global-border-size-thin),
            transparent var(--global-border-size-thin)
          );
          background-size: var(--global-dimension-size-300)
            var(--global-dimension-size-300);
          mask-image: radial-gradient(
            90% 70% at 50% 35%,
            black 0%,
            transparent 100%
          );
        }
      `}
    >
      <div
        css={css`
          flex: 1;
          display: flex;
          padding: var(--global-dimension-size-400)
            var(--global-dimension-size-200);
        `}
      >
        <div
          css={css`
            margin: auto;
            width: 100%;
            display: flex;
            justify-content: center;
          `}
        >
          <AuthCard>{children}</AuthCard>
        </div>
      </div>
      <footer
        css={css`
          display: flex;
          justify-content: center;
          padding: var(--global-dimension-size-400);
          gap: var(--global-dimension-size-200);
          flex: none;
          a {
            color: var(--global-text-color-700);
            transition: color 0.2s ease-in-out;
            text-decoration: none;
            &:hover {
              color: var(--global-text-color-900);
              text-decoration: underline;
            }
          }
        `}
      >
        <a href="https://arize.com/docs/phoenix">Documentation</a>|
        <a href="https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g">
          Community
        </a>
        |<a href="https://twitter.com/ArizePhoenix">X</a>|
        <a href="https://www.linkedin.com/showcase/113218220">LinkedIn</a>|
        <a href="https://github.com/Arize-ai/phoenix">GitHub</a>|
        <a href="https://github.com/Arize-ai/phoenix/releases">{`arize-phoenix v${window.Config.platformVersion}`}</a>
      </footer>
    </main>
  );
}

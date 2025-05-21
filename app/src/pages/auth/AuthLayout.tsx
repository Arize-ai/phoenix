import { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { View } from "@phoenix/components";

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <main
      css={css`
        padding-top: 200px;
        width: 100%;
        height: 100vh;
        overflow: hidden;
        background: radial-gradient(
          90% 60% at 50% 30%,
          rgba(5, 145, 193, 0.4) 0%,
          transparent 100%
        );
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-sizing: border-box;
      `}
    >
      <View
        borderColor="light"
        borderWidth="thin"
        width="size-5000"
        padding="size-400"
        backgroundColor="dark"
        marginStart="auto"
        marginEnd="auto"
        borderRadius="medium"
        overflow="auto"
      >
        {children}
      </View>
      <footer
        css={css`
          display: flex;
          justify-content: center;
          padding: var(--ac-global-dimension-size-400);
          gap: var(--ac-global-dimension-size-200);
          a {
            color: var(--ac-global-text-color-700);
            transition: color 0.2s ease-in-out;
            text-decoration: none;
            &:hover {
              color: var(--ac-global-text-color-900);
              text-decoration: underline;
            }
          }
        `}
      >
        <a href="https://docs.arize.com/phoenix">Documentation</a>|
        <a href="https://arize-ai.slack.com/join/shared_invite/zt-2w57bhem8-hq24MB6u7yE_ZF_ilOYSBw#/shared-invite/email">
          Community
        </a>
        |<a href="https://twitter.com/ArizePhoenix">Social</a>|
        <a href="https://github.com/Arize-ai/phoenix">GitHub</a>|
        <a href="https://github.com/Arize-ai/phoenix/releases">{`arize-phoenix v${window.Config.platformVersion}`}</a>
      </footer>
    </main>
  );
}

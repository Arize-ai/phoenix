import React from "react";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import { LogoutButton } from "./LogoutButton";

const profilePageCSS = css`
  overflow-y: auto;
`;

const profilePageInnerCSS = css`
  padding: var(--ac-global-dimension-size-400);
  max-width: 800px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
`;

export function ProfilePage() {
  return (
    <main css={profilePageCSS}>
      <div css={profilePageInnerCSS}>
        <Card title="Profile" extra={<LogoutButton />} variant="compact">
          Profile goes here
        </Card>
      </div>
    </main>
  );
}

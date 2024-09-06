import React from "react";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Button, Card, Flex, Form, TextField } from "@arizeai/components";

import { useViewer } from "@phoenix/contexts/ViewerContext";

import { ViewerAPIKeys } from "./ViewerAPIKeys";

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
  const { viewer } = useViewer();

  if (!viewer) {
    return null;
  }
  const navigate = useNavigate();
  return (
    <main css={profilePageCSS}>
      <div css={profilePageInnerCSS}>
        {/* TODO(auth): Change username, etc. */}

        <Flex direction="column" gap="size-200">
          <Card
            title="Profile"
            variant="compact"
            extra={
              <Button
                variant="default"
                size="compact"
                onClick={() => {
                  navigate("/reset-password");
                }}
              >
                Reset Password
              </Button>
            }
          >
            <Form>
              <TextField label="email" value={viewer.email} isReadOnly />
              <TextField
                label="username"
                value={viewer.username || ""}
                isReadOnly
              />
              <TextField
                label="role"
                value={viewer.role.name || ""}
                isReadOnly
              />
            </Form>
          </Card>
          <ViewerAPIKeys viewer={viewer} />
        </Flex>
      </div>
    </main>
  );
}

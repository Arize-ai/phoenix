import React from "react";
import { css } from "@emotion/react";

import { Alert, Dialog, Flex, TextField } from "@arizeai/components";

import { CopyToClipboardButton } from "../CopyToClipboardButton";

/**
 * Displays the key one time for the user to copy.
 */
export function OneTimeAPIKeyDialog(props: { jwt: string }) {
  const { jwt } = props;
  return (
    <Dialog title="New API Key Created" isDismissable>
      <Alert variant="success" banner>
        You have successfully created a new API key. The API key will only be
        displayed once below. Please copy and save it in a secure location.
      </Alert>
      <div
        css={css`
          padding: var(--ac-global-dimension-size-200);
          .ac-field {
            width: 100%;
          }
        `}
      >
        <Flex direction="row" gap="size-100" alignItems="end">
          <TextField label="API Key" isReadOnly value={jwt} minWidth="100%" />
          <CopyToClipboardButton text={jwt} size="normal" />
        </Flex>
      </div>
    </Dialog>
  );
}

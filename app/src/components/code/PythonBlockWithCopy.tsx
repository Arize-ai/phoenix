import React from "react";
import { css } from "@emotion/react";

import { CopyToClipboardButton } from "../CopyToClipboardButton";

import { PythonBlock } from "./PythonBlock";

export function PythonBlockWithCopy(props: { value: string }) {
  const { value } = props;
  return (
    <div
      className="python-code-block"
      css={css`
        position: relative;
        .copy-to-clipboard-button {
          position: absolute;
          top: var(--ac-global-dimension-size-100);
          right: var(--ac-global-dimension-size-100);
          z-index: 1;
        }
      `}
    >
      <CopyToClipboardButton text={value} />
      <PythonBlock value={value} />
    </div>
  );
}

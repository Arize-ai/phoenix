import React, { CSSProperties } from "react";
import { css } from "@emotion/react";

const truncateCSS = css`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

export const Truncate = ({
  children,
  maxWidth,
}: {
  children: React.ReactNode;
  maxWidth: CSSProperties["maxWidth"];
}) => {
  return (
    <div css={truncateCSS} style={{ maxWidth }}>
      {children}
    </div>
  );
};
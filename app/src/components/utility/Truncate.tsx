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
  title,
}: {
  children: React.ReactNode;
  maxWidth: CSSProperties["maxWidth"];
  title?: string;
}) => {
  return (
    <div css={truncateCSS} style={{ maxWidth }} title={title}>
      {children}
    </div>
  );
};

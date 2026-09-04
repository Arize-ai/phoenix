import { css } from "@emotion/react";
import type { CSSProperties } from "react";
import React from "react";

/** The single-line half of {@link Truncate}, for composing into a cell or table rule */
export const truncateSingleCSS = css`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

const truncateMulti = css`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export const Truncate = ({
  children,
  maxWidth,
  title,
  maxLines,
}: {
  children: React.ReactNode;
  maxWidth?: CSSProperties["maxWidth"];
  title?: string;
  /**
   * Number of lines before truncation. Default 1.
   */
  maxLines?: number;
}) => {
  const isMultiLine = (maxLines ?? 0) > 1;

  return (
    <div
      css={isMultiLine ? truncateMulti : truncateSingleCSS}
      style={{
        maxWidth,
        ...(isMultiLine && { WebkitLineClamp: maxLines }),
      }}
      title={title}
    >
      {children}
    </div>
  );
};

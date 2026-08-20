import { css } from "@emotion/react";

const lineClampCSS = (lines: number) => css`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: ${lines};
  overflow: hidden;
  text-overflow: ellipsis;
`;

export function LineClamp({
  children,
  lines,
}: {
  children: React.ReactNode;
  lines: number;
}) {
  return <div css={lineClampCSS(lines)}>{children}</div>;
}

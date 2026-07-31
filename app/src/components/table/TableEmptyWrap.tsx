import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";

export function TableEmptyWrap({
  children,
  colSpan = 100,
}: PropsWithChildren<{ colSpan?: number }>) {
  return (
    <tbody className="is-empty">
      <tr>
        <td
          colSpan={colSpan}
          css={css`
            text-align: center;
            padding: var(--global-dimension-size-500)
              var(--global-dimension-size-500) !important;
          `}
        >
          {children}
        </td>
      </tr>
    </tbody>
  );
}

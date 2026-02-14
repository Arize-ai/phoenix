import { PropsWithChildren } from "react";
import { css } from "@emotion/react";

export function TableEmptyWrap(props: PropsWithChildren) {
  const { children } = props;
  return (
    <tbody className="is-empty">
      <tr>
        <td
          colSpan={100}
          css={css`
            text-align: center;
            padding: var(--global-dimension-size-300)
              var(--global-dimension-size-300) !important;
          `}
        >
          {children}
        </td>
      </tr>
    </tbody>
  );
}

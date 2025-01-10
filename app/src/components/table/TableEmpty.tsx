import React from "react";
import { css } from "@emotion/react";

export function TableEmpty(props: { message?: string }) {
  const { message = "No Data" } = props;
  return (
    <tbody className="is-empty">
      <tr>
        <td
          colSpan={100}
          css={css`
            text-align: center;
            padding: var(--ac-global-dimension-size-300)
              var(--ac-global-dimension-size-300) !important;
          `}
        >
          {message}
        </td>
      </tr>
    </tbody>
  );
}

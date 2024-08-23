import React from "react";
import { css } from "@emotion/react";

export function TableEmpty(props: { message?: string }) {
  const { message = "No Data" } = props;
  return (
    <tbody className="is-empty">
      <tr>
        <td
          colSpan={100}
          css={(theme) => css`
            text-align: center;
            padding: ${theme.spacing.margin24}px ${theme.spacing.margin24}px !important;
          `}
        >
          {message}
        </td>
      </tr>
    </tbody>
  );
}

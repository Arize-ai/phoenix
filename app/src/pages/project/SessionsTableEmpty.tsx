import React from "react";
import { css } from "@emotion/react";

import { Flex } from "@arizeai/components";

export function SessionsTableEmpty() {
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
          <Flex direction="column" gap="size-200" alignItems="center">
            No sessions found for this project
          </Flex>
        </td>
      </tr>
    </tbody>
  );
}

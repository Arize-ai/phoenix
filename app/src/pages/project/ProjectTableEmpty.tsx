import { css } from "@emotion/react";

import { Flex } from "@phoenix/components";

export function ProjectTableEmpty({
  projectName: _projectName,
}: {
  projectName: string;
}) {
  return (
    <>
      <tbody className="is-empty">
        <tr>
          <td
            colSpan={100}
            css={css`
              text-align: center;
              padding: var(--global-dimension-size-300) var(--global-dimension-size-300) !important;
            `}
          >
            <Flex direction="column" gap="size-200" alignItems="center">
              No traces found that match the selected filters
            </Flex>
          </td>
        </tr>
      </tbody>
    </>
  );
}

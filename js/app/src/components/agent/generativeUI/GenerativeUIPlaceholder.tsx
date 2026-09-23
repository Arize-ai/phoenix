import { css } from "@emotion/react";

import { Text } from "@phoenix/components/core/content";

const placeholderCSS = css`
  border: 1px dashed var(--global-color-gray-300);
  border-radius: var(--global-rounding-small);
  padding: var(--global-dimension-size-100);
  background: var(--global-color-gray-50);
`;

export function GenerativeUIPlaceholder({ message }: { message: string }) {
  return (
    <div css={placeholderCSS}>
      <Text color="text-700">{message}</Text>
    </div>
  );
}

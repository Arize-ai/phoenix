import { css } from "@emotion/react";

import { Text } from "@phoenix/components/core/content";

const paragraphCSS = css`
  margin: 0 0 var(--global-dimension-size-200);
`;

export function Paragraph({ text }: { text: string }) {
  return (
    <Text elementType="p" color="text-700" css={paragraphCSS}>
      {text}
    </Text>
  );
}

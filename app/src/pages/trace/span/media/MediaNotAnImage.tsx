import { css } from "@emotion/react";

import { ExternalLink, Icon, Icons, Text } from "@phoenix/components";

const unavailableCSS = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-200);
  text-align: center;
  color: var(--global-text-color-700);
`;

/**
 * Shown in place of a span's image when the browser cannot render it as one.
 *
 * Not everything recorded as image content is an image. A document recorded before
 * documents were named separately lands here, as does an image whose host has
 * stopped serving it. Either way the browser's broken-image icon says nothing, so
 * this offers the media itself instead.
 */
export function MediaNotAnImage({ url }: { url: string }) {
  return (
    <div css={unavailableCSS}>
      <Icon svg={<Icons.FileText />} />
      <Text size="XS" color="text-700">
        Cannot be shown as an image
      </Text>
      <ExternalLink href={url}>Open</ExternalLink>
    </div>
  );
}

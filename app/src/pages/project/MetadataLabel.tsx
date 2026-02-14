import { useMemo } from "react";
import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";

const metadataLabelCSS = css`
  border-radius: var(--global-dimension-size-50);
  border: 1px solid var(--global-color-grey-200);
  padding: var(--global-dimension-size-50)
    var(--global-dimension-size-100);
  transition: background-color 0.2s;

  &[role="button"] {
    cursor: pointer;
    &:hover {
      background-color: var(--global-color-grey-200);
      border-color: var(--global-color-grey-400);
    }
  }
  max-width: 100%;
  height: var(--global-dimension-size-200);
`;

export function MetadataLabel({
  metadata,
  onClick,
}: {
  metadata: string;
  onClick?: () => void;
}) {
  // strip the leading and trailing { or } if they exist
  const label = useMemo(() => {
    let newMetadata = metadata;
    if (newMetadata.startsWith("{")) {
      newMetadata = newMetadata.slice(1);
    }
    if (newMetadata.endsWith("}")) {
      newMetadata = newMetadata.slice(0, -1);
    }
    return newMetadata;
  }, [metadata]);

  return (
    <div
      css={css(metadataLabelCSS)}
      role={onClick ? "button" : "label"}
      aria-label="metadata"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick?.();
      }}
    >
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        height="100%"
      >
        <Truncate maxWidth="100%">
          <Text>{label}</Text>
        </Truncate>
      </Flex>
    </div>
  );
}

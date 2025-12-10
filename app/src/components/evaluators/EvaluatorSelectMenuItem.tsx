import { useState } from "react";
import { css } from "@emotion/react";

import {
  GridListItem,
  Icon,
  IconButton,
  Icons,
  Text,
} from "@phoenix/components";
import { AnnotationNameAndValue } from "@phoenix/components/annotation";
import { Truncate } from "@phoenix/components/utility/Truncate";

export type EvaluatorItem = {
  id: string;
  displayName: string;
  alreadyAdded?: boolean;
  annotationName?: string;
};

type EvaluatorMenuItemProps = {
  evaluator: EvaluatorItem;
  isSelected?: boolean;
  onEdit: () => void;
};

export function EvaluatorSelectMenuItem({
  evaluator,
  isSelected,
  onEdit,
}: EvaluatorMenuItemProps) {
  const { displayName, alreadyAdded } = evaluator;

  const [isHovered, setIsHovered] = useState(false);
  const showAlreadyAddedState = Boolean(
    alreadyAdded && isHovered && !isSelected
  );

  const onMouseEnter = () => {
    setIsHovered(true);
  };
  const onMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <GridListItem
      id={evaluator.id}
      textValue={displayName}
      isDisabled={alreadyAdded}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      subtitle={
        evaluator.annotationName ? (
          <div
            css={css`
              color: var(--ac-global-color-grey-900);
            `}
          >
            <AnnotationNameAndValue
              annotation={{ name: evaluator.annotationName }}
              displayPreference="none"
              size="XS"
              maxWidth="unset"
            />
          </div>
        ) : undefined
      }
      trailingContent={
        <IconButton size="S" aria-label="Edit evaluator" onPress={onEdit}>
          <Icon svg={<Icons.EditOutline />} />
        </IconButton>
      }
    >
      <StableWidthText
        primaryText={displayName}
        secondaryText="Already added"
        showSecondary={showAlreadyAddedState}
      />
    </GridListItem>
  );
}

/**
 * Prevents menu flicker when toggling between two text values by maintaining a stable width.
 * Uses absolute positioning to swap visibility, with a hidden grid underneath to reserve
 * space for whichever text is wider.
 */
function StableWidthText({
  primaryText,
  secondaryText,
  showSecondary,
}: {
  primaryText: string;
  secondaryText: string;
  showSecondary: boolean;
}) {
  return (
    <Text
      color="grey-700"
      css={css`
        overflow: hidden;
        position: relative;
      `}
    >
      <span
        css={css`
          position: absolute;
          max-width: 100%;
          visibility: ${showSecondary ? "hidden" : "visible"};
        `}
      >
        <Truncate maxWidth="100%">{primaryText}</Truncate>
      </span>
      <span
        css={css`
          position: absolute;
          max-width: 100%;
          visibility: ${showSecondary ? "visible" : "hidden"};
        `}
      >
        <Truncate maxWidth="100%">{secondaryText}</Truncate>
      </span>
      <span
        aria-hidden="true"
        css={css`
          display: grid;
          visibility: hidden;
        `}
      >
        <span
          css={css`
            grid-area: 1 / 1;
          `}
        >
          <Truncate maxWidth="100%">{primaryText}</Truncate>
        </span>
        <span
          css={css`
            grid-area: 1 / 1;
          `}
        >
          <Truncate maxWidth="100%">{secondaryText}</Truncate>
        </span>
      </span>
    </Text>
  );
}

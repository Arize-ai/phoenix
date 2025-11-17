import { useState } from "react";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, MenuItem, Text } from "@phoenix/components";
import { AnnotationNameAndValue } from "@phoenix/components/annotation";
import { Truncate } from "@phoenix/components/utility/Truncate";

export type EvaluatorItem = {
  id: string;
  name: string;
  kind: "CODE" | "LLM";
  alreadyAdded?: boolean;
  annotationName?: string;
};

type EvaluatorMenuItemProps = {
  evaluator: EvaluatorItem;
  onSelectionChange: () => void;
  isSelected?: boolean;
};

export function EvaluatorSelectMenuItem({
  evaluator,
  onSelectionChange,
  isSelected,
}: EvaluatorMenuItemProps) {
  const { name, kind, alreadyAdded } = evaluator;

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

  let icon =
    kind === "CODE" ? (
      <Icon svg={<Icons.Code />} />
    ) : (
      <Icon svg={<Icons.Robot />} />
    );
  if (showAlreadyAddedState) {
    icon = <Icon svg={<Icons.Checkmark />} />;
  }

  return (
    <MenuItem
      id={evaluator.id}
      textValue={name}
      onAction={onSelectionChange}
      isDisabled={alreadyAdded}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      trailingContent={
        evaluator.annotationName ? (
          <div
            css={css`
              color: var(--ac-global-color-grey-600);
            `}
          >
            <AnnotationNameAndValue
              annotation={{ name: evaluator.annotationName }}
              displayPreference="none"
              size="XS"
            />
          </div>
        ) : undefined
      }
    >
      <Flex
        alignItems="center"
        gap="size-100"
        css={css`
          color: var(--ac-global-color-grey-700);
          font-size: var(--ac-global-font-size-s);
          overflow: hidden;
        `}
      >
        {icon}
        <StableWidthText
          primaryText={name}
          secondaryText="Already added"
          showSecondary={showAlreadyAddedState}
        />
      </Flex>
    </MenuItem>
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
      color="inherit"
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

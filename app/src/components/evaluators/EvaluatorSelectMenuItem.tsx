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
  const showAlreadyAddedState = alreadyAdded && isHovered && !isSelected;

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
    >
      <Flex
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap="size-300"
        minWidth={0}
        flex={1}
        css={css`
          opacity: ${alreadyAdded ? "0.25" : 1};
        `}
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
          <Text
            color="inherit"
            css={css`
              overflow: hidden;
            `}
          >
            <Truncate maxWidth="100%">
              {showAlreadyAddedState ? "Already added" : name}
            </Truncate>
          </Text>
        </Flex>
        {evaluator.annotationName && (
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
        )}
      </Flex>
    </MenuItem>
  );
}

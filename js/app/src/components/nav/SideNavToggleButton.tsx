import {
  Icon,
  IconButton,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";

export function SideNavToggleButton({
  isExpanded,
  isDisabled,
  onExpandedChange,
}: {
  isExpanded: boolean;
  isDisabled: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
}) {
  return (
    <TooltipTrigger>
      <IconButton
        size="S"
        onPress={() => onExpandedChange(!isExpanded)}
        aria-label={
          isExpanded ? "Collapse side navigation" : "Expand side navigation"
        }
        isDisabled={isDisabled}
      >
        <Icon svg={isExpanded ? <Icons.SlideOut /> : <Icons.SlideIn />} />
      </IconButton>
      <Tooltip placement="bottom" offset={10}>
        {isDisabled
          ? "Side navigation is collapsed at this screen size"
          : isExpanded
            ? "Collapse"
            : "Expand"}
      </Tooltip>
    </TooltipTrigger>
  );
}

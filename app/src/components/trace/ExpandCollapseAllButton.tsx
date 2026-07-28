import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";

export function ExpandCollapseAllButton({
  className,
  contentLabel,
  isCollapsed,
  onCollapsedChange,
}: {
  className?: string;
  contentLabel: string;
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
}) {
  const actionLabel = isCollapsed ? "Expand all" : "Collapse all";
  return (
    <TooltipTrigger>
      <Button
        className={className}
        size="S"
        variant="quiet"
        aria-label={actionLabel}
        onPress={() => onCollapsedChange(!isCollapsed)}
      >
        <Icon svg={isCollapsed ? <Icons.RowCollapse /> : <Icons.RowExpand />} />
      </Button>
      <Tooltip offset={-5}>
        {actionLabel} {contentLabel}
      </Tooltip>
    </TooltipTrigger>
  );
}

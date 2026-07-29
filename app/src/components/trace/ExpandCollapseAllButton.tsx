import {
  Icon,
  IconButton,
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
      <IconButton
        className={className}
        size="S"
        aria-label={actionLabel}
        onPress={() => onCollapsedChange(!isCollapsed)}
      >
        <Icon svg={isCollapsed ? <Icons.RowExpand /> : <Icons.RowCollapse />} />
      </IconButton>
      <Tooltip offset={-5}>
        {actionLabel} {contentLabel}
      </Tooltip>
    </TooltipTrigger>
  );
}

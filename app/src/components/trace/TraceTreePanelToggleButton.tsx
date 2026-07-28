import { Button, Icon, Icons } from "@phoenix/components";

export function TraceTreePanelToggleButton({
  isCollapsed,
  onCollapsedChange,
  className,
}: {
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
  className?: string;
}) {
  const label = isCollapsed
    ? "Expand trace navigation"
    : "Collapse trace navigation";
  return (
    <Button
      className={className}
      size="S"
      variant="quiet"
      aria-label={label}
      leadingVisual={
        <Icon svg={isCollapsed ? <Icons.SlideOut /> : <Icons.SlideIn />} />
      }
      onPress={() => onCollapsedChange(!isCollapsed)}
    />
  );
}

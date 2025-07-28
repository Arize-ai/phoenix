import {
  Icon,
  IconButton,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts";

export function SideNavToggleButton() {
  const { isSideNavExpanded, setIsSideNavExpanded } = usePreferencesContext(
    (state) => ({
      isSideNavExpanded: state.isSideNavExpanded,
      setIsSideNavExpanded: state.setIsSideNavExpanded,
    })
  );
  return (
    <TooltipTrigger>
      <IconButton
        size="S"
        onPress={() => setIsSideNavExpanded(!isSideNavExpanded)}
        aria-label={isSideNavExpanded ? "Collapse side" : "Expand side"}
      >
        <Icon
          svg={isSideNavExpanded ? <Icons.SlideOut /> : <Icons.SlideIn />}
        />
      </IconButton>
      <Tooltip placement="bottom" offset={10}>
        {isSideNavExpanded ? "Collapse" : "Expand"}
      </Tooltip>
    </TooltipTrigger>
  );
}

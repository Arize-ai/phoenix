import { useLocation } from "react-router";

import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { prependBasename } from "@phoenix/utils/routingUtils";

export const ShareLinkButton = ({
  buttonText,
  successText,
  tooltipText = "Copy link to clipboard",
  preserveSearchParams = false,
}: {
  buttonText?: string;
  successText?: string;
  tooltipText?: string;
  preserveSearchParams?: boolean;
}) => {
  const location = useLocation();
  const notifySuccess = useNotifySuccess();
  return (
    <TooltipTrigger delay={200}>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.Share />} />}
        onPress={() => {
          const url = new URL(
            prependBasename(location.pathname),
            window.location.origin
          );
          if (preserveSearchParams) {
            url.search = location.search;
          }
          navigator.clipboard.writeText(url.toString());
          notifySuccess({
            title: successText ?? "Link copied to clipboard",
            expireMs: 1000,
          });
        }}
      >
        {buttonText}
      </Button>
      <Tooltip offset={10}>{tooltipText}</Tooltip>
    </TooltipTrigger>
  );
};

import { Tooltip, TooltipTrigger } from "react-aria-components";
import { useLocation } from "react-router";

import { Button, Icon, Icons, Text, View } from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";

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
        leadingVisual={<Icon svg={<Icons.ShareOutline />} />}
        onPress={() => {
          const url = new URL(location.pathname, window.location.origin);
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
      <Tooltip offset={10}>
        <View
          padding="size-100"
          backgroundColor="light"
          borderColor="dark"
          borderWidth="thin"
          borderRadius="small"
        >
          <Text>{tooltipText}</Text>
        </View>
      </Tooltip>
    </TooltipTrigger>
  );
};

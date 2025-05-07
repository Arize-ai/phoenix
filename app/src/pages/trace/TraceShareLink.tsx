import React from "react";

import { Button, Icon, Icons } from "@phoenix/components";

export const ShareLink = () => {
  return (
    <Button
      size="S"
      leadingVisual={<Icon svg={<Icons.ExternalLinkOutline />} />}
    />
  );
};

import React, { ReactNode, useState } from "react";

import { Button, Icon, Icons } from "@phoenix/components";

export function EditPromptButton() {
  const [dialog, setDialog] = useState<ReactNode>(null);
  return (
    <Button
      size="S"
      icon={<Icon svg={<Icons.SettingsOutline />} />}
      variant="quiet"
      aria-label="configure prompt"
    />
  );
}

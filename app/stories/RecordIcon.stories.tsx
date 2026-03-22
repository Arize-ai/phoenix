import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";

import { Button } from "@phoenix/components/core/button/Button";
import { RecordIcon } from "@phoenix/components/core/icon/RecordIcon";

const meta: Meta = {
  title: "Core/Content/Record Icon",
  component: RecordIcon,
  argTypes: {
    isActive: { control: "boolean" },
  },
};

export default meta;

export const Default = {
  args: {
    isActive: false,
  },
};

export const Active = {
  args: {
    isActive: true,
  },
};

export const InButton: StoryFn = () => {
  const [isActive, setIsActive] = useState(false);
  return (
    <Button
      leadingVisual={<RecordIcon isActive={isActive} />}
      onPress={() => setIsActive((prev) => !prev)}
    >
      {isActive ? "Recording" : "Record"}
    </Button>
  );
};

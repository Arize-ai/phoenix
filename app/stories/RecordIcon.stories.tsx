import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";

import { Button } from "@phoenix/components/core/button/Button";
import type { RecordIconProps } from "@phoenix/components/core/icon/RecordIcon";
import { RecordIcon } from "@phoenix/components/core/icon/RecordIcon";

const meta: Meta = {
  title: "Core/RecordIcon",
  component: RecordIcon,
  argTypes: {
    isActive: { control: "boolean" },
  },
};

export default meta;

const Template: StoryFn<RecordIconProps> = (args) => <RecordIcon {...args} />;

export const Default = Template.bind({});
Default.args = {
  isActive: false,
};

export const Active = Template.bind({});
Active.args = {
  isActive: true,
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

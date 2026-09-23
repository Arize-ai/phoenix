import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Button } from "@phoenix/components/core/button/Button";
import { RecordIcon } from "@phoenix/components/core/icon/RecordIcon";

const meta: Meta = {
  title: "Design System/Icons/Record Icon",
  tags: ["legacy", "unreviewed"],
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

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ display: "flex", gap: 16 }}>
      <Button leadingVisual={<RecordIcon isActive={false} />}>Record</Button>
      <Button leadingVisual={<RecordIcon isActive />}>Recording</Button>
    </div>
  ),
};

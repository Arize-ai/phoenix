import { ReactElement } from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Icon, Icons } from "@phoenix/components";

const meta: Meta = {
  title: "Icons",
  component: Icon,
};

export default meta;

function IconsGrid() {
  const iconsArray: ReactElement[] = [];

  Object.keys(Icons).forEach((name) => {
    const iconKey = name as keyof typeof Icons;
    if (Icons[iconKey]) {
      const Svg = Icons[iconKey];
      iconsArray.push(
        <div
          style={{
            margin: "5px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            width: 50,
            height: 50,
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ac-global-color-grey-800)",
            backgroundColor: "var(--ac-global-color-grey-100)",
            border: "1px solid var(--ac-global-color-grey-300)",
            borderRadius: 3,
          }}
          title={name}
        >
          <Icon svg={<Svg />} />
        </div>
      );
    }
  });

  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        width: 1000,
        flexWrap: "wrap",
      }}
    >
      {iconsArray.map((el, i) => (
        <li key={i}>{el}</li>
      ))}
    </ul>
  );
}

const Template: StoryFn = () => <IconsGrid />;

// By passing using the Args format for exported stories, you can control the props for a component for reuse in a test
// https://storybook.js.org/docs/react/workflows/unit-testing
export const Default = Template.bind({});

Default.args = {};

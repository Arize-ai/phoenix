import type { Meta, StoryObj } from "@storybook/react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  MenuContainer,
  MenuItem,
} from "@phoenix/components";

import { LABELS, LONG_PROMPT_NAMES } from "../../constants/menuFixtures";
import {
  HeldOpenList,
  HeldOpenMenu,
  HeldOpenTriggeredMenu,
} from "../../utils/HeldOpenMenu";
import { OptionGrid } from "../../utils/OptionGrid";

/**
 * The popover surface a menu sits on. It sets the menu's minimum and
 * maximum size and where it opens beside its trigger, and it is non-modal:
 * the page behind stays scrollable and available, and the press outside
 * that closes the menu does not reach what lies beneath. It accepts
 * `Popover`'s props; those not shown here are shown under `Popover`.
 *
 * Figma: https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=321-585
 */
const meta = {
  title: "Design System/Menus/Menu Container",
  tags: ["updated", "unreviewed", "incomplete"],
  component: MenuContainer,
  parameters: {
    layout: "centered",
    themeLayout: "row",
    controls: { disable: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=321-585",
    },
  },
} satisfies Meta<typeof MenuContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

function DatasetActionItems() {
  return (
    <>
      <MenuItem id="edit" leadingContent={<Icon svg={<Icons.Edit2 />} />}>
        Edit
      </MenuItem>
      <MenuItem
        id="duplicate"
        leadingContent={<Icon svg={<Icons.Duplicate />} />}
      >
        Duplicate
      </MenuItem>
      <MenuItem id="delete" leadingContent={<Icon svg={<Icons.Trash />} />}>
        Delete
      </MenuItem>
    </>
  );
}

function LabelList({ items }: { items: { id: string; name: string }[] }) {
  return (
    <HeldOpenList aria-label="Labels" items={items}>
      {({ id, name }) => <MenuItem id={id}>{name}</MenuItem>}
    </HeldOpenList>
  );
}

export const Default: Story = {
  tags: ["!dev"],
  render: () => (
    <HeldOpenMenu height={300}>
      <HeldOpenList aria-label="Dataset actions">
        <DatasetActionItems />
      </HeldOpenList>
    </HeldOpenMenu>
  ),
};

/**
 * Each constraint is a `MenuContainer` prop:
 *
 * - `minHeight` defaults to `var(--global-menu-min-height)`. Pass `0` for a
 *   menu that should be only as tall as its items.
 * - `maxHeight` defaults to `var(--global-menu-max-height-large)`, past which
 *   the list scrolls. Pass `var(--global-menu-max-height-small)` for a
 *   shorter menu.
 * - `minWidth` defaults to `300` and `maxWidth` to `450`. Items shorter than
 *   the minimum leave the menu at its minimum; longer ones widen it up to
 *   the maximum, then wrap.
 */
export const SizeConstraints: Story = {
  tags: ["!dev"],
  render: () => (
    <Flex direction="column" gap="size-400">
      <OptionGrid
        columns={[
          { label: "minHeight default", minHeight: undefined },
          { label: "minHeight={0}", code: true, minHeight: 0 },
        ]}
        renderCell={(_, column) => (
          <HeldOpenMenu height={300} minHeight={column?.minHeight}>
            <LabelList items={LABELS.slice(0, 1)} />
          </HeldOpenMenu>
        )}
      />
      <OptionGrid
        columns={[
          {
            label: "--global-menu-max-height-large",
            code: true,
            maxHeight: "var(--global-menu-max-height-large)",
          },
          {
            label: "--global-menu-max-height-small",
            code: true,
            maxHeight: "var(--global-menu-max-height-small)",
          },
        ]}
        renderCell={(_, column) => (
          <HeldOpenMenu height={650} maxHeight={column?.maxHeight}>
            <LabelList items={LABELS} />
          </HeldOpenMenu>
        )}
      />
      <OptionGrid
        columns={[
          { label: "Short items", items: LABELS.slice(0, 3), width: 320 },
          { label: "Long items", items: LONG_PROMPT_NAMES, width: 470 },
        ]}
        renderCell={(_, column) => (
          <HeldOpenMenu height={220} width={column?.width} minHeight={0}>
            <LabelList items={column?.items ?? []} />
          </HeldOpenMenu>
        )}
      />
    </Flex>
  ),
  parameters: { themeLayout: "column" },
};

export const Placement: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={[
        {
          label: "bottom end",
          code: true,
          placement: "bottom end",
          triggerAlign: "end",
          triggerAtBottom: false,
        },
        {
          label: "bottom start",
          code: true,
          placement: "bottom start",
          triggerAlign: "start",
          triggerAtBottom: false,
        },
        {
          label: "right bottom",
          code: true,
          placement: "right bottom",
          triggerAlign: "start",
          triggerAtBottom: true,
        },
      ]}
      alignRows="start"
      renderCell={(row) => (
        <HeldOpenTriggeredMenu
          height={170}
          width={340}
          minHeight={0}
          placement={row.placement as "bottom end"}
          triggerAlign={row.triggerAlign as "start" | "end"}
          triggerAtBottom={row.triggerAtBottom}
          triggerButton={
            <Button
              size="S"
              aria-label="Dataset actions"
              leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
            />
          }
        >
          <HeldOpenList aria-label="Dataset actions">
            <DatasetActionItems />
          </HeldOpenList>
        </HeldOpenTriggeredMenu>
      )}
    />
  ),
  parameters: { themeLayout: "column" },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ alignSelf: "flex-start", width: "100%" }}>
      <HeldOpenMenu height={180} width={220} maxHeight={170} minWidth={200}>
        <LabelList items={LABELS.slice(0, 8)} />
      </HeldOpenMenu>
    </div>
  ),
};

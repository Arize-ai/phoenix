import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { SubmenuTrigger } from "react-aria-components";

import {
  Checkbox,
  ColorSwatch,
  Flex,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuContainer,
  MenuItem,
  Text,
  Token,
} from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation";
import {
  ChartTypeIcon,
  type ChartTypeIconType,
} from "@phoenix/components/chart";

import {
  DATASET_LABELS,
  LONG_PROMPT_NAMES,
  SPLITS,
} from "../../constants/menuFixtures";
import { OptionGrid } from "../../utils/OptionGrid";

/**
 * One row of a menu. Its `leadingContent` and `trailingContent` slots hold
 * whatever marks the item, and it adds a checkmark when the menu has a
 * selection mode and a chevron when it opens a submenu.
 *
 * These menus render on their own, without the popover surface, as
 * embedded menus such as the annotation config list do.
 *
 * Figma: https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=492-3341
 */
const meta = {
  title: "Design System/Menus/Menu Item",
  tags: ["updated", "unreviewed", "incomplete"],
  component: MenuItem,
  parameters: {
    layout: "centered",
    themeLayout: "row",
    controls: { disable: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=492-3341",
    },
  },
} satisfies Meta<typeof MenuItem>;

export default meta;
type Story = StoryObj<typeof meta>;

const ITEM_WIDTH = 300;

function BareMenu({
  label,
  children,
  width = ITEM_WIDTH,
  ...props
}: {
  label: string;
  children: ReactNode;
  width?: number;
  selectionMode?: "none" | "single" | "multiple";
  selectedKeys?: string[];
  disabledKeys?: string[];
}) {
  return (
    <div style={{ width }}>
      <Menu aria-label={label} {...props}>
        {children}
      </Menu>
    </div>
  );
}

const EVALUATORS = ["correctness", "hallucination", "qa-relevance"];

const METRIC_CHARTS = [
  { id: "Latency", type: "line" },
  { id: "Top spans by latency", type: "barHorizontal" },
  { id: "Trace count", type: "bar" },
] satisfies { id: string; type: ChartTypeIconType }[];

const COLORED_SPLITS = [
  { id: "train", color: "#3B82F6", state: "checked" },
  { id: "validation", color: "#10B981", state: "indeterminate" },
  { id: "test", color: "#F59E0B", state: "unchecked" },
];

const ANNOTATION_CONFIGS = [
  { id: "correctness", type: "categorical" },
  { id: "helpfulness", type: "continuous" },
  { id: "note", type: "freeform" },
];

function LabelSubmenu({ leadingContent }: { leadingContent?: ReactNode }) {
  return (
    <SubmenuTrigger>
      <MenuItem id="label" leadingContent={leadingContent}>
        Label
      </MenuItem>
      <MenuContainer>
        <Menu aria-label="Labels">
          <MenuItem id="golden">golden</MenuItem>
        </Menu>
      </MenuContainer>
    </SubmenuTrigger>
  );
}

export const Default: Story = {
  tags: ["!dev"],
  render: () => (
    <BareMenu label="Dataset actions">
      <MenuItem id="edit" leadingContent={<Icon svg={<Icons.Edit2 />} />}>
        Edit
      </MenuItem>
      <LabelSubmenu leadingContent={<Icon svg={<Icons.PriceTags />} />} />
      <MenuItem id="delete" leadingContent={<Icon svg={<Icons.Trash />} />}>
        Delete
      </MenuItem>
    </BareMenu>
  ),
};

const LEADING_ROWS = [
  {
    label: "Icon",
    render: () => (
      <BareMenu label="Account">
        <MenuItem id="profile" leadingContent={<Icon svg={<Icons.Person />} />}>
          Profile
        </MenuItem>
        <MenuItem id="docs" leadingContent={<Icon svg={<Icons.Book />} />}>
          Documentation
        </MenuItem>
        <MenuItem id="logout" leadingContent={<Icon svg={<Icons.LogOut />} />}>
          Log Out
        </MenuItem>
      </BareMenu>
    ),
  },
  {
    label: "Color swatch",
    render: () => (
      <BareMenu label="Labels">
        {DATASET_LABELS.map(({ id, color }) => (
          <MenuItem
            key={id}
            id={id}
            leadingContent={
              <ColorSwatch color={color} size="M" shape="circle" />
            }
          >
            {id}
          </MenuItem>
        ))}
      </BareMenu>
    ),
  },
  {
    label: "Chart type icon",
    render: () => (
      <BareMenu label="Charts">
        {METRIC_CHARTS.map(({ id, type }) => (
          <MenuItem
            key={id}
            id={id}
            leadingContent={<ChartTypeIcon type={type} size={22} />}
          >
            {id}
          </MenuItem>
        ))}
      </BareMenu>
    ),
  },
  {
    label: "Selection checkmark (built in)",
    render: () => (
      <BareMenu
        label="Splits"
        selectionMode="multiple"
        selectedKeys={["train"]}
      >
        {SPLITS.map(({ id, name }) => (
          <MenuItem key={id} id={id}>
            {name}
          </MenuItem>
        ))}
      </BareMenu>
    ),
  },
];

export const LeadingContent: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={LEADING_ROWS}
      alignRows="start"
      renderCell={(row) => row.render()}
    />
  ),
};

const TRAILING_ROWS = [
  {
    label: "Icon button",
    render: () => (
      <BareMenu label="Evaluators">
        {EVALUATORS.map((name) => (
          <MenuItem
            key={name}
            id={name}
            trailingContent={
              <IconButton size="S" aria-label="Edit evaluator">
                <Icon svg={<Icons.Edit />} />
              </IconButton>
            }
          >
            {name}
          </MenuItem>
        ))}
      </BareMenu>
    ),
  },
  {
    label: "Token",
    render: () => (
      <BareMenu label="Annotation configs">
        {ANNOTATION_CONFIGS.map(({ id, type }) => (
          <MenuItem
            key={id}
            id={id}
            trailingContent={<Token size="S">{type}</Token>}
          >
            {id}
          </MenuItem>
        ))}
      </BareMenu>
    ),
  },
  {
    label: "Submenu chevron (built in)",
    render: () => (
      <BareMenu label="Dataset actions">
        <MenuItem id="edit">Edit</MenuItem>
        <LabelSubmenu />
        <MenuItem id="delete">Delete</MenuItem>
      </BareMenu>
    ),
  },
];

export const TrailingContent: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={TRAILING_ROWS}
      alignRows="start"
      renderCell={(row) => row.render()}
    />
  ),
};

function AnnotationConfigItem({ id, type }: { id: string; type: string }) {
  return (
    <MenuItem
      id={id}
      textValue={id}
      leadingContent={<AnnotationColorSwatch annotationName={id} />}
      trailingContent={<Token size="S">{type}</Token>}
    >
      <Text>{id}</Text>
    </MenuItem>
  );
}

function AnnotationConfigMenu() {
  return (
    <BareMenu label="Annotation configs">
      {ANNOTATION_CONFIGS.map(({ id, type }) => (
        <AnnotationConfigItem key={id} id={id} type={type} />
      ))}
    </BareMenu>
  );
}

const COMPOSITION_ROWS = [
  {
    label: "Leading icon and submenu",
    render: () => (
      <BareMenu label="Dataset actions">
        <MenuItem id="edit" leadingContent={<Icon svg={<Icons.Edit2 />} />}>
          Edit
        </MenuItem>
        <LabelSubmenu leadingContent={<Icon svg={<Icons.PriceTags />} />} />
        <MenuItem id="delete" leadingContent={<Icon svg={<Icons.Trash />} />}>
          Delete
        </MenuItem>
      </BareMenu>
    ),
  },
  {
    label: "Selection and color swatch",
    render: () => (
      <BareMenu
        label="Labels"
        selectionMode="multiple"
        selectedKeys={["golden"]}
      >
        {DATASET_LABELS.map(({ id, color }) => (
          <MenuItem
            key={id}
            id={id}
            leadingContent={
              <ColorSwatch color={color} size="M" shape="circle" />
            }
          >
            {id}
          </MenuItem>
        ))}
      </BareMenu>
    ),
  },
  {
    label: "Color swatch and token",
    render: () => <AnnotationConfigMenu />,
  },
  {
    label: "Checkbox and token",
    render: () => (
      <BareMenu label="Splits">
        {COLORED_SPLITS.map(({ id, color, state }) => (
          <MenuItem key={id} id={id} textValue={id}>
            <Flex alignItems="center" gap="size-200">
              <Checkbox
                excludeFromTabOrder
                isSelected={state === "checked"}
                isIndeterminate={state === "indeterminate"}
              />
              <Token color={color}>{id}</Token>
            </Flex>
          </MenuItem>
        ))}
      </BareMenu>
    ),
  },
  {
    label: "Selection, leading, trailing and submenu",
    render: () => (
      <BareMenu
        label="Annotation configs"
        selectionMode="single"
        selectedKeys={["correctness"]}
      >
        <AnnotationConfigItem id="correctness" type="categorical" />
        <AnnotationConfigItem id="helpfulness" type="continuous" />
        <SubmenuTrigger>
          <AnnotationConfigItem id="note" type="freeform" />
          <MenuContainer>
            <Menu aria-label="Note">
              <MenuItem id="edit-note">Edit</MenuItem>
            </Menu>
          </MenuContainer>
        </SubmenuTrigger>
      </BareMenu>
    ),
  },
];

export const Composition: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={COMPOSITION_ROWS}
      alignRows="start"
      renderCell={(row) => row.render()}
    />
  ),
};

const STATE_CONTENT = [
  {
    label: "Plain",
    render: () => <MenuItem id="item">Duplicate</MenuItem>,
  },
  {
    label: "Leading icon",
    render: () => (
      <MenuItem id="item" leadingContent={<Icon svg={<Icons.Duplicate />} />}>
        Duplicate
      </MenuItem>
    ),
  },
  {
    label: "Trailing icon button",
    render: () => (
      <MenuItem
        id="item"
        trailingContent={
          <IconButton size="S" aria-label="Edit evaluator">
            <Icon svg={<Icons.Edit />} />
          </IconButton>
        }
      >
        correctness
      </MenuItem>
    ),
  },
  {
    label: "Leading and trailing",
    render: () => (
      <MenuItem
        id="item"
        textValue="correctness"
        leadingContent={<AnnotationColorSwatch annotationName="correctness" />}
        trailingContent={<Token size="S">categorical</Token>}
      >
        <Text>correctness</Text>
      </MenuItem>
    ),
  },
  {
    label: "Submenu",
    render: () => (
      <SubmenuTrigger>
        <MenuItem id="item" leadingContent={<Icon svg={<Icons.PriceTags />} />}>
          Label
        </MenuItem>
        <MenuContainer>
          <Menu aria-label="Labels">
            <MenuItem id="golden">golden</MenuItem>
          </Menu>
        </MenuContainer>
      </SubmenuTrigger>
    ),
  },
];

const STATES = [
  { label: "enabled" },
  { label: "disabled" },
  { label: "selected" },
] as const;

export const ContentAndStates: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={STATE_CONTENT}
      columns={STATES}
      renderCell={(row, column) =>
        row.label === "Submenu" && column?.label === "selected" ? null : (
          <BareMenu
            label="Item"
            width={250}
            selectionMode={column?.label === "selected" ? "single" : "none"}
            selectedKeys={column?.label === "selected" ? ["item"] : []}
            disabledKeys={column?.label === "disabled" ? ["item"] : []}
          >
            {row.render()}
          </BareMenu>
        )
      }
    />
  ),
  parameters: { themeLayout: "column" },
};

const TEXT_LENGTHS = [
  { label: "One character", text: "a" },
  { label: "Regular", text: LONG_PROMPT_NAMES[0].name },
  { label: "Long identifier", text: LONG_PROMPT_NAMES[1].name },
  { label: "Long sentence", text: LONG_PROMPT_NAMES[2].name },
];

export const ContentLength: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={TEXT_LENGTHS}
      alignRows="start"
      renderCell={(row) => (
        <BareMenu label="Prompts">
          <MenuItem id="item">{row.text}</MenuItem>
        </BareMenu>
      )}
    />
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => <AnnotationConfigMenu />,
};
